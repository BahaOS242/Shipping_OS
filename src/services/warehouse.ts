/** WAREHOUSE SERVICE — queues and demo helpers for the Florida warehouse. */
import { db } from "@/data/store";
import { calculateBillableWeight, isOversized } from "@/domain/rates";
import type { Actor, Package } from "@/domain/types";
import { findPurchaseInvoice } from "./invoiceEngine";
import { isOpen } from "./exceptions";
import { dockScan } from "./packages";
import { requireModule } from "./access";

export function warehouseQueues() {
  requireModule("warehouse");
  const s = db();
  const open = s.exceptions.filter(isOpen);
  const withEx = (p: Package) => open.filter((e) => e.packageId === p.id);
  return {
    arriving: s.packages.filter((p) => p.status === "incoming" && !p.dockedAt),
    atDock: s.packages.filter((p) => p.status === "incoming" && p.dockedAt),
    atWarehouse: s.packages.filter((p) => p.status === "received" && !p.shipmentId),
    packing: s.packages.filter((p) => p.status === "preparing"),
    readyToSend: s.shipments.filter((x) => x.status === "cleared"),
    needsAttention: s.packages.filter((p) => ["incoming", "received", "preparing"].includes(p.status) && withEx(p).length),
    withEx,
  };
}

/** Preview the automatic checks the receive step will run (for the wizard). */
export function previewReceivingChecks(p: Package, m: { actualWeight: number; length?: number; width?: number; height?: number; damaged?: boolean; service: Package["service"] }) {
  const out: { type: string; text: string }[] = [];
  if (!p.customerId) out.push({ type: "CUSTOMER_NOT_MATCHED", text: "No customer matched — package will be held." });
  const inv = findPurchaseInvoice(p.purchaseInvoiceId) ?? db().purchaseInvoices.find((i) => !i.packageId && i.customerId === p.customerId && (i.orderNumber === p.orderNumber || i.merchant === p.merchant));
  if (!inv && p.customerId) out.push({ type: "MISSING_INVOICE", text: "No store receipt — the customer will be asked to upload it." });
  inv?.items.filter((i) => i.reviewFlag).forEach((i) => out.push({ type: "PROHIBITED_ITEM", text: `${i.name}: ${i.reviewFlag} (AI suggestion — human review)` }));
  if (p.carrierWeight && m.actualWeight && Math.abs(m.actualWeight - p.carrierWeight) > Math.max(2, p.carrierWeight * 0.25)) out.push({ type: "WEIGHT_MISMATCH", text: `Carrier said ${p.carrierWeight} lb, scale says ${m.actualWeight} lb.` });
  if (m.service === "air" && isOversized(m, "air")) out.push({ type: "OVERSIZED_ITEM", text: "Too big or heavy to fly — suggest ocean." });
  if (m.damaged) out.push({ type: "DAMAGED_PACKAGE", text: "Damage recorded with photos." });
  if (db().packages.some((x) => x.id !== p.id && x.inboundTracking === p.inboundTracking && x.status !== "incoming")) out.push({ type: "DUPLICATE_PACKAGE", text: "Same tracking number as another package." });
  return { checks: out, invoice: inv, billable: calculateBillableWeight(m, m.service) };
}

const SURPRISES = [
  { labelName: "Trevor Armstrong", labelSuite: "TL10284", merchant: "Apple", itemName: "iPad", carrier: "FedEx" as const, carrierWeight: 2 },
  { labelName: "Sarah Knowles", labelSuite: "TL10311", merchant: "Target", itemName: "School backpack", carrier: "UPS" as const, carrierWeight: 1.5 },
  { labelName: "K. Bethel", labelSuite: undefined, merchant: "Amazon", itemName: "Small box", carrier: "Amazon" as const, carrierWeight: 1 },
];

/** DEMO: a truck drops a box at the dock. Prefers a real pre-alerted package. */
export function simulateTruckArrival(actor: Actor) {
  const expected = db().packages.find((p) => p.status === "incoming" && !p.dockedAt && p.customerId === "cus_trevor") ?? db().packages.find((p) => p.status === "incoming" && !p.dockedAt);
  if (expected) {
    return dockScan(actor, { inboundTracking: expected.inboundTracking, carrier: expected.carrier, labelName: expected.labelName, labelSuite: expected.labelSuite, merchant: expected.merchant, carrierWeight: expected.carrierWeight }).package;
  }
  const s = SURPRISES[db().packages.length % SURPRISES.length];
  return dockScan(actor, { ...s, inboundTracking: `1ZSIM${Date.now().toString().slice(-7)}` }).package;
}
