/**
 * Billing rules — pure functions. Bills are what The Link charges;
 * payments are simulated (DEMO PAYMENT). Reconciliation compares them.
 */
import type { Bill, BillLine, LandedCost, Payment } from "./types";

export const BILLING_RULES = {
  vatRate: 0.1,
  /** Placeholder rate on declared value — real duty depends on each item's tariff. */
  demoDutyRate: 0.1,
  termsDays: { personal: 14, business: 30 },
  /** Differences under this are treated as rounding. */
  tolerance: 0.01,
} as const;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function withTotals<T extends { lines: BillLine[] }>(bill: T): T & { subtotal: number; vat: number; total: number } {
  const subtotal = round2(bill.lines.reduce((s, l) => s + l.amount, 0));
  const vat = round2(bill.lines.filter((l) => l.taxable).reduce((s, l) => s + l.amount, 0) * BILLING_RULES.vatRate);
  return { ...bill, subtotal, vat, total: round2(subtotal + vat) };
}

export const paidOn = (bill: Bill, payments: Payment[]) => round2(payments.filter((p) => p.billId === bill.id).reduce((s, p) => s + p.amount, 0));

export type BillStatus = "draft" | "unpaid" | "part_paid" | "overdue" | "paid" | "overpaid" | "void";

export const BILL_STATUS_COPY: Record<BillStatus, { label: string; icon: string; tone: "neutral" | "warn" | "good" | "bad" | "done" }> = {
  draft: { label: "Draft", icon: "✎", tone: "neutral" },
  unpaid: { label: "To pay", icon: "○", tone: "warn" },
  part_paid: { label: "Part paid", icon: "◐", tone: "good" },
  overdue: { label: "Overdue", icon: "⚠", tone: "bad" },
  paid: { label: "Paid", icon: "✓", tone: "done" },
  overpaid: { label: "Overpaid", icon: "≠", tone: "warn" },
  void: { label: "Void", icon: "⊘", tone: "neutral" },
};

export function billStatus(bill: Bill, payments: Payment[], now = Date.now()): BillStatus {
  if (bill.lifecycle === "void") return "void";
  if (bill.lifecycle === "draft") return "draft";
  const paid = paidOn(bill, payments);
  if (paid - bill.total > BILLING_RULES.tolerance) return "overpaid";
  if (bill.total - paid <= BILLING_RULES.tolerance || bill.reconciledBy) return "paid";
  if (bill.dueAt && new Date(bill.dueAt).getTime() < now) return "overdue";
  return paid > 0 ? "part_paid" : "unpaid";
}

export function balanceOf(bill: Bill, payments: Payment[]) {
  if (bill.lifecycle !== "issued" || bill.reconciledBy) return 0;
  return round2(Math.max(0, bill.total - paidOn(bill, payments)));
}

/* ---------------- Reconciliation ---------------- */

export type ReconStatus = "matched" | "needs_review" | "awaiting_payment" | "unmatched_payment" | "accepted";

export const RECON_COPY: Record<ReconStatus, { label: string; icon: string; tone: "done" | "bad" | "neutral" | "warn" }> = {
  matched: { label: "Matched", icon: "✓", tone: "done" },
  accepted: { label: "Accepted by accounting", icon: "✓", tone: "done" },
  needs_review: { label: "Needs review", icon: "⚠", tone: "bad" },
  awaiting_payment: { label: "Awaiting payment", icon: "○", tone: "neutral" },
  unmatched_payment: { label: "Unmatched payment", icon: "≠", tone: "warn" },
};

export type ReconRow = {
  billId?: ID;
  paymentIds: string[];
  customerId: string;
  billed: number;
  paid: number;
  difference: number;
  status: ReconStatus;
  reason: string;
};
type ID = string;

/**
 * Rules:
 *  - paid == billed → Matched
 *  - some payment but paid ≠ billed → Needs review (short or over)
 *  - no payment yet → Awaiting payment
 *  - payment with no bill → Unmatched payment
 *  - accounting accepted a difference → Accepted (with note)
 */
export function reconcile(bills: Bill[], payments: Payment[]): ReconRow[] {
  const rows: ReconRow[] = [];
  for (const b of bills) {
    if (b.lifecycle !== "issued") continue;
    const ps = payments.filter((p) => p.billId === b.id);
    const paid = round2(ps.reduce((s, p) => s + p.amount, 0));
    const difference = round2(b.total - paid);
    let status: ReconStatus;
    let reason: string;
    if (b.reconciledBy) {
      status = "accepted";
      reason = b.reconciliationNote ?? "Difference accepted";
    } else if (!ps.length) {
      status = "awaiting_payment";
      reason = "No payment yet";
    } else if (Math.abs(difference) <= BILLING_RULES.tolerance) {
      status = "matched";
      reason = ps.length > 1 ? `${ps.length} payments add up to the bill` : "Payment equals bill";
    } else {
      status = "needs_review";
      reason = difference > 0 ? `Short by $${difference.toFixed(2)}` : `Overpaid by $${Math.abs(difference).toFixed(2)}`;
    }
    rows.push({ billId: b.id, paymentIds: ps.map((p) => p.id), customerId: b.customerId, billed: b.total, paid, difference, status, reason });
  }
  for (const p of payments.filter((p) => !p.billId)) {
    rows.push({ paymentIds: [p.id], customerId: p.customerId, billed: 0, paid: p.amount, difference: -p.amount, status: "unmatched_payment", reason: "Payment not linked to a bill" });
  }
  return rows;
}

/** Suggest the bill a stray payment most likely belongs to. */
export function suggestBillForPayment(payment: Payment, bills: Bill[], payments: Payment[]) {
  const open = bills.filter((b) => b.customerId === payment.customerId && balanceOf(b, payments) > 0);
  return open.sort((a, b) => Math.abs(balanceOf(a, payments) - payment.amount) - Math.abs(balanceOf(b, payments) - payment.amount))[0];
}

/* ---------------- Procurement ---------------- */

export function landedCostTotal(c: LandedCost) {
  return round2(c.purchasePrice + c.supplierShipping + c.salesTax + c.freight + c.customsDuty + c.storage + c.delivery);
}

export function customerPrice(c: LandedCost, marginRate: number) {
  const landed = landedCostTotal(c);
  const price = round2(landed * (1 + marginRate));
  return { landed, price, margin: round2(price - landed) };
}
