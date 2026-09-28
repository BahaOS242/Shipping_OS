/**
 * Critical journey through the real UI (spec §47), as each role would click it.
 *   npm run build && npm start   # then:
 *   node tests/ui-journey.mjs    (needs Playwright)
 */
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright");
const B = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS;
const b = await chromium.launch();
const p = await (await b.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
const errors = [];
p.on("pageerror", (e) => errors.push(e.message));
let n = 0;
const step = async (label, fn) => {
  await fn();
  n++;
  console.log(`✓ ${String(n).padStart(2)}. ${label}`);
  if (SHOTS) await p.screenshot({ path: `${SHOTS}/journey-${String(n).padStart(2, "0")}.png` });
};
const go = async (path) => { await p.goto(B + path, { waitUntil: "networkidle" }); await p.waitForTimeout(250); };
const as = async (role) => { await p.evaluate((r) => (r === "customer" ? window.__theLink.switchCustomer("cus_trevor") : window.__theLink.switchRole(r)), role); await p.waitForTimeout(200); };
const expectText = async (t) => p.getByText(t).first().waitFor({ timeout: 8000 });
const svc = (fn, ...args) => p.evaluate(fn, ...args);

await go("/");
await svc(() => window.__theLink.resetDemoData());
await p.waitForTimeout(300);
await as("customer");
let pkgId = "", shipmentId = "";

await step("Customer buys an Amazon product and tells us it's coming", async () => {
  await go("/packages/new");
  await p.getByLabel("What is it?").fill("USB-C hub");
  await p.getByLabel("Tracking number (if you have it)").fill("TBAUIJOURNEY1");
  await p.getByLabel("Order number (optional)").fill("112-7777777");
  await p.getByRole("button", { name: "Save" }).click();
  await p.waitForURL(/\/packages\/TL-PKG-/);
  pkgId = p.url().split("/").pop();
  await expectText("Coming to our warehouse");
});
await step("Customer ships it to The Link U.S. address (address shown on profile)", async () => { await go("/profile"); await expectText("The Link #TL10284"); });
await step("Customer uploads the Amazon receipt → simulated AI extraction", async () => {
  await go(`/invoices?package=${pkgId}`);
  await p.getByRole("button", { name: "Use a sample receipt" }).click();
  await expectText("This receipt is now attached");
});
await as("warehouse");
await step("Package arrives — warehouse scans the tracking number", async () => {
  await go("/warehouse/scan");
  await p.getByLabel("Code", { exact: true }).fill("TBAUIJOURNEY1");
  await p.getByRole("button", { name: "Scan", exact: true }).click();
  await p.waitForURL(/receive=1/);
  await expectText(`Receive ${pkgId}`);
});
await step("Customer is automatically matched", async () => { await p.getByRole("button", { name: "Next →" }).click(); await expectText("Auto-matched from label"); });
await step("Invoice is processed and linked (receipt found)", async () => { await p.getByRole("button", { name: "Next →" }).click(); await expectText("Receipt found"); });
await step("Weight and dimensions are recorded; billable weight calculated", async () => {
  await p.getByRole("button", { name: "Next →" }).click();
  await p.getByLabel(/Weight on the scale/).fill("0.8");
  await p.getByRole("button", { name: "Next →" }).click();
  await p.getByLabel("Length (in)").fill("10");
  await p.getByLabel("Width (in)").fill("8");
  await p.getByLabel("Height (in)").fill("6");
  await expectText("size-based 3 lb beats actual 0.8 lb");
});
await step("Photographed, checked and marked received", async () => {
  await p.getByRole("button", { name: "Next →" }).click();
  await p.getByRole("button", { name: /Take photo/ }).click();
  for (let i = 0; i < 3; i++) await p.getByRole("button", { name: "Next →" }).click();
  await p.getByRole("button", { name: "✓ Mark received" }).click();
  await expectText("received");
});
await as("customer");
await step('Customer sees "Your package has arrived."', async () => { await go(`/packages/${pkgId}`); await expectText("We have it!"); await expectText("Your package has arrived at our Florida warehouse"); });
await step("Customer has multiple packages and selects two", async () => {
  await go("/packages/together");
  const boxes = p.locator('input[type="checkbox"]');
  const count = await boxes.count();
  for (let i = 0; i < count; i++) {
    const label = await boxes.nth(i).locator("xpath=..").innerText();
    const keep = label.includes("USB-C hub") || label.includes("Wireless keyboard");
    if ((await boxes.nth(i).isChecked()) !== keep) await boxes.nth(i).locator("xpath=..").click();
  }
  await p.getByLabel(/Bring it to me/).check();
});
await step('"Put These Together" → shipment created', async () => {
  await p.getByRole("button", { name: "Put These Together" }).click();
  await expectText("Done!");
  shipmentId = (await p.locator("p.font-mono").first().innerText()).trim();
  if (!shipmentId.startsWith("TL-SHP-")) throw new Error("no shipment id");
});
await as("customs");
await step("Customs receives the shipment with invoice / items / value", async () => { await go(`/customs/${shipmentId}`); await expectText("DEMO PACKET"); await expectText("Wireless keyboard"); });
let exId = "";
await step("Customs requests review → exception created", async () => {
  await p.getByRole("button", { name: "📋 Request Review" }).click();
  await p.getByLabel("What needs attention?").fill("Confirm hub wattage");
  await p.getByRole("button", { name: "Save" }).click();
  await expectText("Customs review required");
  exId = await svc((id) => window.__theLink.listExceptions({ shipmentId: id, status: "active" })[0].id, shipmentId);
});
await step("Staff resolves the exception", async () => {
  await go(`/exceptions?open=${exId}`);
  await p.getByLabel("How was it resolved?").fill("Receipt shows 60W — fine");
  await p.getByRole("button", { name: "✓ Resolve" }).click();
  await expectText("Resolved — linked records updated");
});
await step("Customs approves", async () => {
  await go(`/customs/${shipmentId}`);
  await p.getByRole("button", { name: "✓ Approve" }).click();
  await p.getByRole("dialog").getByRole("button", { name: "Approve" }).click();
  await expectText("Approved — shipment cleared to depart");
});
await as("warehouse");
await step("Shipment departs", async () => {
  await go("/warehouse");
  await p.getByRole("button", { name: /Ready to send/ }).click();
  await p.locator("li", { hasText: shipmentId }).getByRole("button", { name: /Send/ }).click();
  await expectText(`${shipmentId} departed`);
});
await as("customer");
await step("Customer receives a notification (and a simulated WhatsApp message)", async () => {
  await go("/notifications");
  await expectText("Shipment on the way");
  await go("/whatsapp-demo");
  await expectText("coming to The Bahamas");
});
await as("warehouse");
await step("Shipment arrives in The Bahamas", async () => {
  await go("/delivery");
  await p.locator("li", { hasText: shipmentId }).getByRole("button", { name: /Mark arrived/ }).click();
  await expectText(`${shipmentId} arrived`);
});
await step("Delivery is scheduled", async () => {
  await p.locator("li", { hasText: shipmentId }).getByRole("button", { name: "Schedule" }).click();
  await p.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await expectText("Scheduled — customer notified");
});
await step("Package goes out for delivery", async () => {
  await p.locator("li", { hasText: shipmentId }).getByRole("button", { name: "Dispatch" }).click();
  await expectText("Out for delivery — customer notified");
});
await step("Customer receives the package — delivery marked complete with proof", async () => {
  await p.locator("li", { hasText: shipmentId }).getByRole("button", { name: "Delivered" }).click();
  await p.getByRole("dialog").getByRole("button", { name: /Mark delivered/ }).click();
  await expectText("Delivered 🎉");
});
await as("customer");
await step("Customer sees Delivered", async () => { await go(`/shipments/${shipmentId}`); await expectText("Proof of delivery"); });
await step("Payment is recorded (DEMO PAYMENT)", async () => {
  const billId = await svc((id) => window.__theLink.listBills({ shipmentId: id })[0].id, shipmentId);
  await go(`/payments?bill=${billId}`);
  await p.getByRole("dialog").getByRole("button", { name: "Pay Now" }).click();
  await p.getByRole("dialog").getByRole("button", { name: /Pay \$/ }).click();
  await expectText("(demo). Thank you!");
});
await as("accounting");
await step("Accounting sees the payment — reconciled as Matched", async () => {
  const billId = await svc((id) => window.__theLink.listBills({ shipmentId: id })[0].id, shipmentId);
  await go(`/accounting/bills/${billId}`);
  await expectText("matched — Payment equals bill");
});
await as("customer");
await step("Customer timeline shows the entire journey", async () => {
  await go(`/packages/${pkgId}`);
  for (const t of ["You told us your Amazon package", "We read your Amazon receipt", "Your package has arrived", "combine your 2 packages", "paperwork is checked", "coming to The Bahamas", "arrived in The Bahamas", "out for delivery", "Delivered 🎉", "(demo payment)"]) await expectText(t);
});
await as("manager");
await step("Admin searches the package ID and sees everything", async () => {
  await go("/admin");
  await p.getByLabel("Search", { exact: true }).fill(pkgId);
  await p.getByRole("button", { name: "Search" }).click();
  await expectText("Everything connected to");
  for (const t of ["Customer", "Invoice", "Customs", "Payment", "Delivery", "Timeline"]) await p.getByText(t).first().waitFor();
});
if (errors.length) { console.error("Page errors:", errors); process.exit(1); }
console.log(`\nUI journey passed (${n} checks).`);
await b.close();
