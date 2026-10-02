/**
 * Interactive demo through a real browser: every business type, every step's
 * interaction, Next/Back/Restart/Exit, state kept across Back, completion + CTA,
 * mobile layout. Needs a running server.
 *   npm run build && npm start   # then:
 *   node tests/demo-ui.mjs       (needs Playwright; SHOTS=dir for screenshots)
 */
const { chromium } = await import(process.env.PLAYWRIGHT ?? "playwright");
const B = process.env.BASE_URL ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS;
const b = await chromium.launch();
const errors = [];
const page = async (viewport) => {
  const p = await (await b.newContext({ viewport })).newPage();
  p.on("pageerror", (e) => errors.push(`${p.url()}: ${e.message}`));
  p.on("console", (m) => m.type() === "error" && errors.push(`${p.url()} console: ${m.text()}`));
  return p;
};
const shot = async (p, name) => { if (!SHOTS) return; await p.waitForTimeout(500); await p.screenshot({ path: `${SHOTS}/${name}.png` }); };
let checks = 0;
const ok = (label) => { checks++; console.log(`✓ ${label}`); };
const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

const p = await page({ width: 1440, height: 900 });
const main = () => p.locator("main");
const walk = () => p.locator('aside[aria-label="Guided walkthrough"]');
const btn = (name) => main().getByRole("button", { name }).first();
const taskDone = async (label) => { await walk().getByText("Done", { exact: true }).first().waitFor({ timeout: 6000 }); ok(`  ${label}`); };

/** One generic driver per screen kind (the same config-driven contract the UI renders). */
const DRIVE = {
  async dashboard() { await main().locator("ul li button").first().click(); },
  async receive() { await main().getByRole("button", { name: /Receive|Scan & receive/ }).click(); await main().getByText("What happened automatically").waitFor(); await p.waitForTimeout(1300); },
  async manifest() { await btn(/Build Manifest/).click(); await p.waitForTimeout(1700); await main().getByRole("button", { name: /Close manifest|Clear for departure|Dispatch/ }).click(); await main().getByRole("status").first().waitFor(); },
  async timeline() { for (let i = 0; i < 6; i++) { const r = main().getByRole("button", { name: /^Record:/ }); if (!(await r.count())) break; await r.click(); await p.waitForTimeout(150); } await main().getByRole("button", { name: "Delivered" }).waitFor(); },
  async portal() { await main().getByRole("tab", { name: "Documents" }).click(); await btn("Get updates on WhatsApp").click(); await main().getByText("just now").waitFor(); },
  async ai() { await main().getByRole("button", { name: /^“/ }).click(); await p.waitForTimeout(1400); const d = main().getByRole("button", { name: /Review|Create work queue/ }); if (await d.count()) { await d.first().click(); await main().getByText("Draft · not applied").waitFor(); } },
  async vessel() { await btn("Check all").click(); await btn(/Mark ready/).click(); },
  async bookings() { const opener = main().locator("tbody tr").filter({ hasText: "Pending" }).first().getByRole("button"); await opener.click(); await main().getByRole("button", { name: /Confirm booking|Mark ready for dispatch/ }).click(); },
  async capacity() { const acc = main().getByRole("button", { name: /^Accept / }); let blocked = false; for (let i = 0; i < 6 && (await acc.count()); i++) { await acc.first().click(); await p.waitForTimeout(100); if (await main().getByRole("alert").count()) { blocked = true; break; } } if (blocked) ok("  capacity limit blocks an over-capacity request"); },
  async dispatch() { for (let i = 0; i < 6; i++) { const a = main().getByRole("button", { name: "Assign", exact: true }); if (!(await a.count())) break; await a.first().click(); } await main().getByText(/All deliveries assigned/).waitFor(); },
  async driver() { await btn("Start run").click(); await main().getByRole("button", { name: /^Arrived at/ }).click(); },
  async pod() { await main().getByLabel("Received by").fill("Omar Bain"); await btn("Capture signature").click(); await btn("Take photo").click(); await btn("Complete delivery").click(); await main().getByText(/received by Omar Bain/).waitFor(); },
  async storage() { await btn("Suggest bins").click(); await main().getByText(/Every package has a location/).waitFor(); },
  async grouping() { await btn("Select all ready").click(); await btn("Create shipment").click(); },
  async schedule() { await btn("Depart").click(); await main().getByText(/Departed · customers notified/).waitFor(); },
  async flow() { await btn(/Run the shipment through/).click(); await p.waitForTimeout(2900); await main().getByRole("button", { name: /Billing/ }).click(); },
  async billing() { await btn("Issue invoice").click(); await btn(/Record payment/).click(); await main().getByText(/reconciled automatically/).waitFor(); },
};

await p.goto(`${B}/demo`, { waitUntil: "networkidle" });
assert((await p.textContent("h1")).includes("One operating system for your entire logistics operation."), "hero headline");
const cards = await p.locator("#operations article").count();
assert(cards === 6, `6 business cards, got ${cards}`);
ok("landing: hero + 6 operation cards");
await shot(p, "landing");

const scenarios = await p.locator("#operations article h3").allTextContents();
for (const label of scenarios) {
  await p.goto(`${B}/demo`, { waitUntil: "networkidle" });
  await p.getByRole("link", { name: `Explore the ${label} demo` }).click();
  await walk().waitFor();
  const total = Number((await p.getByText(/^Step 1 of \d$/).first().textContent()).match(/of (\d)/)[1]);
  console.log(`\n${label} — ${total} steps`);
  for (let i = 0; i < total; i++) {
    const kind = await p.evaluate(() => document.querySelector("main [data-screen]")?.getAttribute("data-screen"));
    const title = (await main().locator("h1").textContent()).trim();
    await DRIVE[kind]();
    await taskDone(`step ${i + 1} · ${title} (${kind})`);
    await shot(p, `${label.replace(/\W+/g, "-").toLowerCase()}-${i + 1}-${kind}`);
    if (i === 1) {
      // Back keeps what the visitor did; Next returns.
      await walk().getByRole("button", { name: "Back" }).last().click();
      await walk().getByRole("button", { name: "Next" }).last().click();
      await taskDone("  Back → Next keeps the step's state");
    }
    await walk().getByRole("button", { name: i === total - 1 ? "Finish" : "Next" }).last().click();
  }
  await main().getByText("Ready to see Shipping OS configured around your operation?").waitFor();
  assert(await main().getByRole("link", { name: "Book a Personalized Demo" }).count(), "book CTA");
  assert(await main().getByRole("button", { name: "Restart Demo" }).count(), "restart CTA");
  ok(`${label}: completion + CTA`);
  await shot(p, `${label.replace(/\W+/g, "-").toLowerCase()}-complete`);
}

// Restart clears state; Exit returns to the landing.
await main().getByRole("button", { name: "Restart Demo" }).click();
await p.getByText(/^Step 1 of/).first().waitFor();
assert(!(await walk().getByText("Done", { exact: true }).count()), "restart clears progress");
ok("Restart → step 1 with a clean slate");
await p.getByRole("button", { name: /Exit demo/ }).click();
await p.locator("#operations").waitFor();
ok("Exit → landing");

// Sidebar: tour item jumps; non-tour item explains instead of breaking the flow.
await p.goto(`${B}/demo?op=freight-forwarder`, { waitUntil: "networkidle" });
await p.locator('nav[aria-label="Workspace"]').getByRole("button", { name: "Manifest" }).click();
assert((await main().locator("h1").textContent()).includes("Manifest"), "sidebar jump");
await p.locator('nav[aria-label="Workspace"]').getByRole("button", { name: "Customers" }).click();
await p.getByText(/not in this 6-step tour/).waitFor();
ok("sidebar jumps to tour steps and explains the rest");
// Deep link
await p.goto(`${B}/demo?op=mailboat&step=4`, { waitUntil: "networkidle" });
assert((await main().locator("h1").textContent()).includes("Capacity"), "deep link to step 4");
ok("deep link ?op=mailboat&step=4 opens Capacity");

// Mobile
const m = await page({ width: 390, height: 844 });
await m.goto(`${B}/demo`, { waitUntil: "networkidle" });
await shot(m, "mobile-landing");
await m.getByRole("link", { name: "Explore the Courier demo" }).click();
await m.getByRole("button", { name: "Open menu" }).click();
await m.getByRole("dialog", { name: "Workspace menu" }).waitFor();
await shot(m, "mobile-drawer");
await m.getByRole("button", { name: "Close menu" }).click();
assert(await m.getByText(/^Step 1 of 6$/).first().isVisible(), "progress visible on mobile");
await m.locator("main ul li button").first().click();
await m.locator('aside[aria-label="Guided walkthrough"]').getByText("Done", { exact: true }).first().waitFor();
const overflow = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
assert(overflow <= 0, `no horizontal page scroll on mobile (${overflow}px)`);
await shot(m, "mobile-step1");
await m.locator('aside[aria-label="Guided walkthrough"]').getByRole("button", { name: "Next" }).last().click();
await shot(m, "mobile-step2");
ok("mobile: drawer, visible progress, bottom-sheet walkthrough, no horizontal scroll");

console.log(errors.length ? `\nERRORS:\n${errors.join("\n")}` : "\nNo page errors.");
await b.close();
if (errors.length) process.exit(1);
console.log(`Demo UI passed (${checks} checks).`);
