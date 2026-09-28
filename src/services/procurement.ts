/**
 * PROCUREMENT — "Tell us what you need and we'll get it to you."
 * request → quote (supplier + landed cost) → customer approves → purchased
 * (supplier invoice + expected package) → received → shipped → delivered.
 */
import { nowIso } from "@/data/clock";
import { db, mutate, nextSeq } from "@/data/store";
import { customerPrice, landedCostTotal } from "@/domain/billing";
import { assert, can, canActOn } from "@/domain/roles";
import type { Actor, ID, LandedCost, Procurement } from "@/domain/types";
import { SYSTEM, emit } from "@/events/bus";
import { BusinessError, byId } from "./_shared";
import { addCharge } from "./billing";
import { uploadInvoice } from "./invoiceEngine";
import { preAlert } from "./packages";

export const getProcurement = (id: ID) => byId(db().procurements, id, "Request");
export const listProcurements = (customerId?: ID) =>
  db().procurements.filter((p) => !customerId || p.customerId === customerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export function procurementPricing(p: Procurement) {
  if (!p.costs) return undefined;
  return { ...customerPrice(p.costs, p.marginRate), landedCost: landedCostTotal(p.costs) };
}

export function requestProcurement(actor: Actor, customerId: ID, request: string, quantity = 1) {
  assert(canActOn(actor, "procurement.manage", { customerId }));
  if (request.trim().length < 4) throw new BusinessError("Tell us what you need.");
  return mutate((s) => {
    const p: Procurement = { id: `PRC-${nextSeq("prc", 900)}`, customerId, request: request.trim(), status: "requested", quantity, marginRate: 0.12, createdAt: nowIso(), notes: [] };
    s.procurements.push(p);
    emit("PROCUREMENT_REQUESTED", { actor, refs: { customerId, procurementId: p.id }, summary: `Buy-for-me request: ${p.request}`, customerSummary: `We got your request: “${p.request}”. We'll find it and send you a price.` });
    return p;
  });
}

function update(actor: Actor, id: ID, fn: (p: Procurement) => void, summary: string, customerSummary?: string) {
  return mutate(() => {
    const p = getProcurement(id);
    fn(p);
    emit("PROCUREMENT_UPDATED", { actor, refs: { customerId: p.customerId, procurementId: p.id, packageId: p.packageId }, summary: `${p.id}: ${summary}`, customerSummary });
    return p;
  });
}

export function quoteProcurement(actor: Actor, id: ID, input: { supplier: string; product: string; costs: LandedCost; marginRate?: number }) {
  assert(can(actor, "procurement.manage"));
  return update(actor, id, (p) => {
    if (p.status !== "requested" && p.status !== "quoted") throw new BusinessError("Already approved.");
    Object.assign(p, { supplier: input.supplier, product: input.product, costs: input.costs, marginRate: input.marginRate ?? p.marginRate, status: "quoted" });
  }, `quoted ${input.product} from ${input.supplier}`, `We found it: ${input.product}. Your all-in price is ready to approve.`);
}

export function approveProcurement(actor: Actor, id: ID) {
  const p = getProcurement(id);
  assert(canActOn(actor, "procurement.manage", p));
  if (p.status !== "quoted" || !p.costs) throw new BusinessError("There's no price to approve yet.");
  return mutate(() => {
    const price = customerPrice(p.costs!, p.marginRate);
    // Bill the goods + service fee now; freight is billed on the shipment as usual.
    const goods = p.costs!.purchasePrice + p.costs!.supplierShipping + p.costs!.salesTax;
    const bill = addCharge(SYSTEM, { customerId: p.customerId, kind: "procurement", description: `Buy for me: ${p.product} (goods ${goods.toFixed(2)} + service fee)`, amount: goods + price.margin, procurementId: p.id });
    p.billId = bill.id;
    return update(actor, id, (x) => (x.status = "approved"), "approved by customer", "Thanks! We'll buy it and let you know when it reaches our warehouse.");
  });
}

export function markPurchased(actor: Actor, id: ID) {
  assert(can(actor, "procurement.manage"));
  const p = getProcurement(id);
  if (p.status !== "approved") throw new BusinessError("Customer must approve first.");
  return mutate(() => {
    const order = `PO-${p.id.slice(4)}-${Date.now().toString().slice(-4)}`;
    const pkg = preAlert(SYSTEM, { customerId: p.customerId, merchant: p.supplier!, itemName: p.product!, carrier: "Freight", inboundTracking: `FRT-${p.id}`, orderNumber: order });
    const inv = uploadInvoice({ ...SYSTEM, role: "admin" }, { fileName: `${p.supplier}-supplier-invoice-${order}.pdf`, fileType: "pdf", customerId: p.customerId, packageId: pkg.id, merchant: p.supplier, orderNumber: order, itemHint: p.product, uploadedBy: "staff" });
    pkg.procurementId = p.id;
    return update(actor, id, (x) => {
      x.status = "purchased";
      x.packageId = pkg.id;
      x.supplierInvoiceId = inv.id;
    }, `purchased — supplier order ${order}, expected package ${pkg.id}`, `We bought your ${p.product}. It's on the way to our warehouse (${pkg.id}).`);
  });
}

/** Keep procurement status in step with its package. */
export function syncProcurementStatus(p: Procurement) {
  const pkg = db().packages.find((x) => x.id === p.packageId);
  if (!pkg || ["cancelled", "requested", "quoted", "approved"].includes(p.status)) return p.status;
  if (pkg.status === "delivered") return "delivered";
  if (["in_transit", "arrived", "ready"].includes(pkg.status)) return "shipped";
  if (["received", "preparing"].includes(pkg.status)) return "received";
  return "purchased";
}
