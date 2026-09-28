/**
 * CRITICAL INTERACTION TEST (spec §47) — runs the full journey through the
 * service layer, the same code the UI, AI and WhatsApp use.
 *   npx tsx tests/journey.ts
 */
import assert from "node:assert/strict";
import "@/services";
import { handleAgentRequest } from "@/ai/agent";
import { handleWhatsAppWebhook, buildInboundPayload } from "@/ai/whatsapp";
import { db } from "@/data/store";
import * as svc from "@/services";

const s = db();
const staff = (role: "warehouse" | "customs" | "accounting" | "manager" | "support") => {
  const u = s.staff.find((x) => x.role === role)!;
  return svc.staffActor(u.name, u.role);
};
const WH = staff("warehouse"), CU = staff("customs"), AC = staff("accounting"), MG = staff("manager");
const trevor = svc.getCustomer("cus_trevor");
const T = svc.customerActor(trevor);
let n = 0;
const step = (label: string, fn: () => void | Promise<void>) => Promise.resolve(fn()).then(() => console.log(`✓ ${String(++n).padStart(2)}. ${label}`));

async function main() {
  let pkgId = "";
  let shipmentId = "";
  let exceptionId = "";

  await step("Customer buys an Amazon product (pre-alert)", () => {
    pkgId = svc.preAlert(T, { customerId: trevor.id, merchant: "Amazon", itemName: "USB-C charging cable", carrier: "Amazon", inboundTracking: "TBATEST0001", orderNumber: "112-0000001" }).id;
    assert.equal(svc.getPackage(pkgId).status, "incoming");
  });
  await step("Customer ships it to The Link U.S. address", () => assert.match(svc.shoppingAddress(trevor).line1, /#TL10284/));
  await step("Package arrives at the dock", () => {
    const r = svc.dockScan(WH, { inboundTracking: "TBATEST0001", carrier: "Amazon", labelName: "Trevor Armstrong", labelSuite: "TL10284", merchant: "Amazon" });
    assert.equal(r.package.id, pkgId);
  });
  await step("Warehouse scans the package (same ID everywhere)", () => assert.equal(svc.findPackage(pkgId.toLowerCase())?.id, pkgId));
  await step("Customer is automatically matched", () => assert.equal(svc.matchCustomerFromLabel("anything", "TL10284")?.customer.id, trevor.id));
  await step("Invoice is processed (customer uploads receipt → simulated AI extraction)", () => {
    const inv = svc.uploadInvoice(T, { fileName: "amazon-order-112-0000001.pdf", fileType: "pdf", merchant: "Amazon", orderNumber: "112-0000001", itemHint: "USB-C charging cable" });
    assert.ok(inv.confidence > 0.6);
    assert.ok(s.events.some((e) => e.type === "INVOICE_PROCESSED" && e.refs.purchaseInvoiceId === inv.id));
  });
  await step("Invoice is linked to the package", () => assert.ok(svc.getPackage(pkgId).purchaseInvoiceId));
  await step("Weight and dimensions are recorded", () => {
    svc.receivePackage(WH, pkgId, { actualWeight: 0.8, length: 10, width: 8, height: 6, photos: 2 });
    assert.equal(svc.getPackage(pkgId).actualWeight, 0.8);
  });
  await step("System calculates billable weight (dimensional wins)", () => {
    const p = svc.getPackage(pkgId);
    assert.equal(p.dimensionalWeight, 3); // 480/166 = 2.9 → 3
    assert.equal(p.billableWeight, 3);
  });
  await step('Customer sees "Your package has arrived."', () => {
    assert.ok(svc.listNotifications({ customerId: trevor.id }).some((x) => x.refs.packageId === pkgId && /arrived/.test(x.body)));
    assert.ok(svc.timeline({ packageId: pkgId }, { customerView: true }).some((e) => /arrived/.test(e.customerSummary ?? "")));
  });
  let chosen: string[] = [];
  await step("Customer has multiple packages", () => {
    chosen = svc.consolidationCandidates(trevor.id).map((p) => p.id);
    assert.ok(chosen.length >= 2);
  });
  await step("Customer selects two", () => {
    chosen = [pkgId, chosen.find((id) => id !== pkgId)!];
    assert.equal(chosen.length, 2);
  });
  await step('"Put These Together" creates a real Shipment → Packages[]', () => {
    const sh = svc.createShipment(T, { customerId: trevor.id, packageIds: chosen });
    shipmentId = sh.id;
    assert.deepEqual(svc.getShipment(shipmentId).packageIds, chosen);
    chosen.forEach((id) => assert.equal(svc.getPackage(id).shipmentId, shipmentId));
  });
  await step("Shipment is created (and billed)", () => assert.ok(svc.listBills({ shipmentId }).length === 1));
  await step("Customs receives the shipment", () => assert.ok(svc.customsQueue().some((x) => x.id === shipmentId)));
  await step("Customs sees invoice / items / declared value", () => {
    const pk = svc.customsPacket(shipmentId);
    assert.equal(pk.missing.length, 0);
    assert.ok(pk.totals.declaredValueUsd > 0 && pk.lines.every((l) => l.items.length));
  });
  await step("Customs requests review", () => {
    svc.requestCustomsReview(CU, shipmentId, "Confirm cable wattage on receipt");
    assert.equal(svc.getShipment(shipmentId).customs.status, "needs_attention");
  });
  await step("Exception is created", () => {
    exceptionId = svc.listExceptions({ shipmentId, status: "active" }).find((e) => e.type === "CUSTOMS_REVIEW_REQUIRED")!.id;
    assert.ok(exceptionId);
    assert.throws(() => svc.approveCustoms(CU, shipmentId), /Resolve/);
    assert.throws(() => svc.approveCustoms(T, shipmentId), /customs team/); // customers can't approve
  });
  await step("Staff resolves the exception", () => {
    svc.resolveException(CU, exceptionId, "Receipt shows 60W cable — fine");
    assert.equal(svc.getShipment(shipmentId).customs.status, "ready_for_review");
    svc.approveCustoms(CU, shipmentId);
  });
  await step("Shipment departs", () => {
    svc.departShipment(WH, shipmentId);
    assert.ok(chosen.every((id) => svc.getPackage(id).status === "in_transit"));
  });
  await step("Customer receives a notification (in-app + simulated WhatsApp)", () => {
    assert.ok(svc.listNotifications({ customerId: trevor.id }).some((x) => x.refs.shipmentId === shipmentId && x.title === "Shipment on the way"));
    assert.ok(svc.getConversation(trevor.id, "whatsapp")!.messages.some((m) => /coming to The Bahamas/.test(m.text)));
  });
  await step("Shipment arrives in The Bahamas", () => {
    svc.arriveShipment(WH, shipmentId);
    assert.equal(svc.getShipment(shipmentId).status, "ready_for_pickup"); // Trevor prefers pickup
  });
  // Switch this shipment to home delivery to exercise the delivery lifecycle.
  const d = svc.deliveryForShipment(shipmentId)!;
  d.method = "home_delivery";
  d.status = "not_scheduled";
  d.fee = 15;
  await step("Delivery is scheduled", () => {
    svc.scheduleDelivery(WH, d.id, { date: new Date().toISOString(), from: "10:00", to: "12:00", driver: "Andre (Van 2)" });
    assert.equal(svc.getDelivery(d.id).status, "scheduled");
  });
  await step("Package goes out for delivery", () => {
    svc.dispatchDelivery(WH, d.id);
    assert.ok(svc.listNotifications({ customerId: trevor.id }).some((x) => /out for delivery/.test(x.body)));
  });
  await step("Customer receives the package", () => svc.completeDelivery(WH, d.id, { receivedBy: "Trevor Armstrong" }));
  await step("Delivery is marked complete (with proof)", () => {
    assert.equal(svc.getDelivery(d.id).status, "delivered");
    assert.ok(svc.getDelivery(d.id).proof?.signature);
    assert.ok(chosen.every((id) => svc.getPackage(id).status === "delivered"));
  });
  const bill = svc.listBills({ shipmentId })[0];
  await step("Payment is recorded (DEMO PAYMENT)", () => {
    assert.ok(bill.lines.some((l) => l.kind === "delivery"));
    svc.demoPay(T, bill.id);
    assert.equal(svc.billView(svc.getBill(bill.id)).balance, 0);
  });
  await step("Accounting sees the payment, reconciled as Matched", () => {
    const row = svc.reconciliationRows().find((r) => r.billId === bill.id)!;
    assert.equal(row.status, "matched");
  });
  await step("Customer timeline shows the entire journey", () => {
    const types = new Set(svc.timeline({ packageId: pkgId }).map((e) => e.type));
    for (const t of ["PACKAGE_EXPECTED", "INVOICE_PROCESSED", "PACKAGE_RECEIVED", "PACKAGE_WEIGHT_UPDATED", "PACKAGE_CONSOLIDATED", "SHIPMENT_CREATED", "CUSTOMS_REVIEW_REQUIRED", "CUSTOMS_APPROVED", "SHIPMENT_DEPARTED", "SHIPMENT_ARRIVED", "OUT_FOR_DELIVERY", "PACKAGE_DELIVERED", "PAYMENT_RECEIVED"]) {
      assert.ok(types.has(t), `timeline missing ${t}`);
    }
  });
  await step("Admin searches the package ID and sees everything", () => {
    const c = svc.connected(pkgId)!;
    assert.equal(c.customer?.id, trevor.id);
    assert.equal(c.shipment?.id, shipmentId);
    assert.ok(c.invoice && c.bills.length && c.payments.length && c.delivery && c.timeline.length > 10);
    assert.equal(svc.search(pkgId)[0].id, pkgId);
  });

  // Bonus: AI + WhatsApp read the same data and respect authorization.
  const ai = await handleAgentRequest({ channel: "web", customerId: trevor.id, input: { kind: "text", text: "Where's my package?" } });
  assert.ok(ai.trace.some((t) => t.tool === "getPackages"));
  const wa = await handleWhatsAppWebhook(buildInboundPayload(trevor.phone.replace(/\D/g, ""), "Trevor", { text: "Hey, where's my package?" }));
  assert.ok(JSON.stringify(wa.results[0].outbound).includes("Found it"));
  const open = svc.listBills({ customerId: trevor.id, status: "open" })[0];
  assert.throws(() => svc.demoPay(svc.aiActor(trevor.id), open.id), /only pay your own/);
  assert.throws(() => svc.createShipment(svc.aiActor(trevor.id), { customerId: trevor.id, packageIds: ["TL-PKG-10474"] }), /only ship your own/);
  console.log("✓ AI + WhatsApp use the same tools; AI cannot take payments");
  void MG;
  void AC;
  console.log(`\nAll ${n} journey steps passed.`);
}

main().catch((e) => {
  console.error("✗ Journey failed:", e);
  process.exit(1);
});
