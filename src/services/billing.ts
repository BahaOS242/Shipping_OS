/**
 * BILLING & PAYMENTS — what Shipping OS charges, what customers paid (DEMO PAYMENT),
 * and reconciliation between the two. No real money moves anywhere.
 */
import { DAY, now, nowIso } from "@/data/clock";
import { db, mutate, nextSeq } from "@/data/store";
import { BILLING_RULES, balanceOf, billStatus, paidOn, reconcile, suggestBillForPayment, withTotals, type BillStatus } from "@/domain/billing";
import { calculateShippingCost } from "@/domain/rates";
import { assert, can, canActOn } from "@/domain/roles";
import type { Actor, Bill, BillLine, ChargeKind, ID, Payment, PaymentMethod } from "@/domain/types";
import { emit } from "@/events/bus";
import { BusinessError, byId, round2 } from "./_shared";
import { getCustomer } from "./customers";
import { autoResolve, ensureException } from "./exceptions";
import { getDestination } from "./locations";

export const getBill = (id: ID) => byId(db().bills, id, "Bill");
export const findBill = (id?: ID) => db().bills.find((b) => b.id === id);

export type BillView = Bill & { status: BillStatus; paid: number; balance: number; payments: Payment[] };

export function billView(b: Bill): BillView {
  const ps = db().payments;
  return { ...b, status: billStatus(b, ps, now()), paid: paidOn(b, ps), balance: balanceOf(b, ps), payments: ps.filter((p) => p.billId === b.id) };
}

export function listBills(f: { customerId?: ID; status?: BillStatus | "open"; shipmentId?: ID } = {}) {
  return db()
    .bills.filter((b) => (!f.customerId || b.customerId === f.customerId) && (!f.shipmentId || b.shipmentId === f.shipmentId))
    .map(billView)
    .filter((b) => !f.status || (f.status === "open" ? ["unpaid", "part_paid", "overdue"].includes(b.status) : b.status === f.status))
    .sort((a, b) => (b.issuedAt ?? b.createdAt).localeCompare(a.issuedAt ?? a.createdAt));
}

let lineSeq = 0;
const line = (kind: ChargeKind, description: string, amount: number, packageId?: ID): BillLine => ({
  id: `L${++lineSeq}-${Math.random().toString(36).slice(2, 6)}`,
  kind,
  description,
  amount: round2(amount),
  packageId,
  taxable: kind !== "customs_duty",
});

function newBill(customerId: ID, lines: BillLine[], extra: Partial<Bill> = {}): Bill {
  const c = getCustomer(customerId);
  const issuedAt = nowIso();
  return withTotals({
    id: `INV-${new Date(now()).getFullYear()}-${String(nextSeq("bill", 100)).padStart(5, "0")}`,
    customerId,
    lifecycle: "issued",
    lines,
    subtotal: 0,
    vat: 0,
    total: 0,
    currency: "USD",
    issuedAt,
    dueAt: new Date(now() + BILLING_RULES.termsDays[c.type] * DAY).toISOString(),
    createdAt: issuedAt,
    ...extra,
  });
}

/** Bill a shipment: shipping by combined billable weight + duty estimate on declared value. */
export function billShipment(actor: Actor, shipmentId: ID) {
  return mutate((s) => {
    const sh = byId(s.shipments, shipmentId, "Shipment");
    if (s.bills.some((b) => b.shipmentId === sh.id && b.lifecycle !== "void")) return s.bills.find((b) => b.shipmentId === sh.id)!;
    const pkgs = s.packages.filter((p) => sh.packageIds.includes(p.id));
    const weights = pkgs.map((p) => ({ actual: p.actualWeight ?? 0, dimensional: p.dimensionalWeight, billable: p.billableWeight ?? p.actualWeight ?? 0.5, basis: "actual" as const }));
    const est = calculateShippingCost({ weights }, getDestination(sh.destinationId), sh.service);
    const lines = est.lines.map((l) => line(l.kind, `${l.label} · ${pkgs.length} package${pkgs.length > 1 ? "s" : ""}`, l.amount));
    for (const p of pkgs) {
      if (p.declaredValue) lines.push(line("customs_duty", `Customs duty estimate (collected for government) · ${p.merchant}`, p.declaredValue * BILLING_RULES.demoDutyRate, p.id));
    }
    const bill = newBill(sh.customerId, lines, { shipmentId: sh.id });
    s.bills.push(bill);
    emit("BILL_ISSUED", { actor, refs: { customerId: sh.customerId, shipmentId: sh.id, billId: bill.id }, summary: `Bill ${bill.id} issued — $${bill.total.toFixed(2)}`, customerSummary: `Your bill for shipment ${sh.id} is ready: $${bill.total.toFixed(2)}.`, data: { total: bill.total } });
    return bill;
  });
}

/** Add a charge: onto the shipment's open bill if nothing is paid yet, else a new bill. */
export function addCharge(actor: Actor, input: { customerId: ID; kind: ChargeKind; description: string; amount: number; shipmentId?: ID; packageId?: ID; procurementId?: ID }) {
  assert(can(actor, "billing.record_payment") || can(actor, "delivery.manage") || can(actor, "package.edit") || can(actor, "procurement.manage") || actor.kind === "system");
  if (!(input.amount > 0)) throw new BusinessError("Charge must be above $0.");
  return mutate((s) => {
    const l = line(input.kind, input.description, input.amount, input.packageId);
    const open = input.shipmentId ? s.bills.find((b) => b.shipmentId === input.shipmentId && b.lifecycle === "issued" && paidOn(b, s.payments) === 0 && !b.reconciledBy) : undefined;
    let bill: Bill;
    if (open) {
      Object.assign(open, withTotals({ ...open, lines: [...open.lines, l] }));
      bill = open;
    } else {
      bill = newBill(input.customerId, [l], { shipmentId: input.shipmentId, procurementId: input.procurementId });
      s.bills.push(bill);
      emit("BILL_ISSUED", { actor, refs: { customerId: input.customerId, billId: bill.id, shipmentId: input.shipmentId }, summary: `Bill ${bill.id} issued — $${bill.total.toFixed(2)}`, customerSummary: `New bill: ${input.description} — $${bill.total.toFixed(2)}.` });
    }
    emit("CHARGE_ADDED", { actor, refs: { customerId: input.customerId, billId: bill.id, shipmentId: input.shipmentId, packageId: input.packageId }, summary: `${input.description}: $${l.amount.toFixed(2)} added to ${bill.id}` });
    return bill;
  });
}

function checkMismatch(bill: Bill) {
  const v = billView(bill);
  if (v.status === "overpaid" || (v.paid > 0 && v.balance > 0 && v.payments.at(-1)?.reference?.includes("FULL"))) {
    ensureException({ type: "PAYMENT_MISMATCH", customerId: bill.customerId, billId: bill.id, detail: v.status === "overpaid" ? `Paid $${v.paid.toFixed(2)} on a $${v.total.toFixed(2)} bill.` : `Bill $${v.total.toFixed(2)}, paid $${v.paid.toFixed(2)} — short $${v.balance.toFixed(2)}.` });
  }
  if (v.balance === 0) {
    autoResolve("CUSTOMER_OWES_MONEY", { billId: bill.id }, "Bill paid");
    if (v.status === "paid") autoResolve("PAYMENT_MISMATCH", { billId: bill.id }, "Now matches");
  }
}

/** Staff records money received. `settles` = payer said this pays the bill in full. */
export function recordPayment(actor: Actor, input: { customerId: ID; billId?: ID; amount: number; method: PaymentMethod; reference?: string; settles?: boolean }) {
  assert(can(actor, "billing.record_payment") || can(actor, "delivery.manage"), "Only accounting can record payments.");
  const amount = round2(Number(input.amount));
  if (!(amount > 0)) throw new BusinessError("Enter an amount above $0.");
  return mutate((s) => {
    if (input.billId) {
      const b = getBill(input.billId);
      if (b.customerId !== input.customerId) throw new BusinessError("That bill belongs to another customer.");
      if (b.lifecycle !== "issued") throw new BusinessError("Payments can only go on issued bills.");
    }
    const p: Payment = {
      id: `PAY-${nextSeq("pay", 5000)}`,
      customerId: input.customerId,
      billId: input.billId,
      amount,
      method: input.method,
      reference: [input.reference, input.settles ? "FULL" : ""].filter(Boolean).join(" ") || undefined,
      receivedAt: nowIso(),
      recordedBy: actor.name,
      demo: true,
    };
    s.payments.push(p);
    emit("PAYMENT_RECEIVED", { actor, refs: { customerId: p.customerId, billId: p.billId, paymentId: p.id, shipmentId: findBill(p.billId)?.shipmentId }, summary: `DEMO PAYMENT $${amount.toFixed(2)} (${input.method})${p.billId ? ` on ${p.billId}` : " — not linked to a bill"}`, customerSummary: `We received your payment of $${amount.toFixed(2)}. Thank you!` });
    if (p.billId) checkMismatch(getBill(p.billId));
    return p;
  });
}

/** Customer pays their balance on a bill (simulated — DEMO PAYMENT). */
export function demoPay(actor: Actor, billId: ID) {
  const b = getBill(billId);
  assert(canActOn(actor, "billing.record_payment", b), "You can only pay your own bills.");
  const balance = balanceOf(b, db().payments);
  if (balance <= 0) throw new BusinessError("Nothing to pay on this bill.");
  return mutate((s) => {
    const p: Payment = { id: `PAY-${nextSeq("pay", 5000)}`, customerId: b.customerId, billId: b.id, amount: balance, method: "online", reference: "DEMO PAYMENT", receivedAt: nowIso(), recordedBy: actor.name, demo: true };
    s.payments.push(p);
    emit("PAYMENT_RECEIVED", { actor, refs: { customerId: b.customerId, billId: b.id, paymentId: p.id, shipmentId: b.shipmentId }, summary: `DEMO PAYMENT $${balance.toFixed(2)} online on ${b.id}`, customerSummary: `You paid $${balance.toFixed(2)} (demo payment). Thank you!` });
    checkMismatch(b);
    return p;
  });
}

/** Accounting links a stray payment to a bill. */
export function applyPayment(actor: Actor, paymentId: ID, billId: ID) {
  assert(can(actor, "billing.reconcile"), "Only accounting can reconcile payments.");
  return mutate((s) => {
    const p = byId(s.payments, paymentId, "Payment");
    const b = getBill(billId);
    if (p.customerId !== b.customerId) throw new BusinessError("Payment and bill belong to different customers.");
    p.billId = b.id;
    emit("PAYMENT_RECONCILED", { actor, refs: { customerId: b.customerId, billId: b.id, paymentId: p.id, shipmentId: b.shipmentId }, summary: `${p.id} applied to ${b.id}` });
    checkMismatch(b);
    return b;
  });
}

/** Accounting accepts a difference (e.g. short $42 written off) — requires a note. */
export function acceptDifference(actor: Actor, billId: ID, note: string) {
  assert(can(actor, "billing.reconcile"), "Only accounting can approve reconciliation.");
  if (!note.trim()) throw new BusinessError("Add a note explaining the difference.");
  return mutate(() => {
    const b = getBill(billId);
    b.reconciledBy = actor.name;
    b.reconciliationNote = note.trim();
    emit("PAYMENT_RECONCILED", { actor, refs: { customerId: b.customerId, billId: b.id }, summary: `Difference accepted on ${b.id}: ${note.trim()}` });
    autoResolve("PAYMENT_MISMATCH", { billId: b.id }, `Accepted by ${actor.name}`);
    autoResolve("CUSTOMER_OWES_MONEY", { billId: b.id }, `Accepted by ${actor.name}`);
    return b;
  });
}

export function voidBill(actor: Actor, billId: ID, reason: string) {
  assert(can(actor, "billing.void"));
  return mutate((s) => {
    const b = getBill(billId);
    if (s.payments.some((p) => p.billId === b.id)) throw new BusinessError("This bill has payments. Refunds must be handled first.");
    b.lifecycle = "void";
    b.voidReason = reason;
    emit("PAYMENT_RECONCILED", { actor, refs: { customerId: b.customerId, billId: b.id }, summary: `${b.id} voided: ${reason}` });
    return b;
  });
}

/** The customer's money picture. */
export function customerBalance(customerId: ID) {
  const bills = listBills({ customerId }).filter((b) => b.lifecycle === "issued");
  const byKind: Record<string, number> = {};
  for (const b of bills.filter((x) => x.balance > 0)) {
    const share = b.total ? b.balance / b.total : 0;
    for (const l of b.lines) byKind[l.kind] = round2((byKind[l.kind] ?? 0) + l.amount * share * (l.taxable ? 1 + BILLING_RULES.vatRate : 1));
  }
  return {
    balance: round2(bills.reduce((s, b) => s + b.balance, 0)),
    overdue: round2(bills.filter((b) => b.status === "overdue").reduce((s, b) => s + b.balance, 0)),
    paid: round2(db().payments.filter((p) => p.customerId === customerId).reduce((s, p) => s + p.amount, 0)),
    nextDue: bills.filter((b) => b.balance > 0).sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""))[0],
    openBills: bills.filter((b) => b.balance > 0),
    byKind,
    payments: db().payments.filter((p) => p.customerId === customerId).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
  };
}

export function reconciliationRows() {
  const s = db();
  return reconcile(s.bills, s.payments).map((r) => ({
    ...r,
    suggestion: r.status === "unmatched_payment" ? suggestBillForPayment(s.payments.find((p) => p.id === r.paymentIds[0])!, s.bills, s.payments)?.id : undefined,
  }));
}

export const listPayments = () => [...db().payments].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
export const shipmentPackagesById = (shipmentId?: ID) => {
  const sh = db().shipments.find((s) => s.id === shipmentId);
  return sh ? db().packages.filter((p) => sh.packageIds.includes(p.id)) : [];
};
