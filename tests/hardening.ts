/**
 * HARDENING TESTS — production organization context, module graph, AI tool
 * contract/boundary, WhatsApp tenant isolation. (Concurrency: tests/concurrency.ts.)
 *   npx tsx tests/hardening.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import "@/services";
import { ALL_TOOLS, cancelToolAction, confirmToolAction, customerToolContext, executeTool, runTool, staffToolContext } from "@/ai/executor";
import { STAFF_TOOLS } from "@/ai/staffTools";
import { contractProblems, type ToolSpec } from "@/ai/contract";
import { buildInboundPayload, handleWhatsAppWebhook, demoSender } from "@/ai/whatsapp";
import { HOUR, atTime } from "@/data/clock";
import { db, platform, withTenant } from "@/data/store";
import { ForbiddenError } from "@/domain/roles";
import { BUSINESS_TYPES, BUSINESS_TYPE_IDS, presetModules } from "@/platform/businessTypes";
import { WIDGETS } from "@/platform/dashboard";
import { MODULES, MODULE_IDS, dependentsOf, registryProblems, requirementsOf, resolveModules, toggleModule, validateModules } from "@/platform/modules";
import { CUSTOMER_ROUTES, OPS_NAV, opsNavFor } from "@/platform/navigation";
import { installAsyncTenantScope } from "@/server/tenantScope";
import * as svc from "@/services";

let n = 0;
const test = async (label: string, fn: () => void | Promise<void>) => {
  await fn();
  n++;
  console.log(`✓ ${label}`);
};
const group = (name: string) => console.log(`\n${name}`);
const org = (slug: string) => svc.getOrganizationBySlug(slug)!;
const inOrg = <T,>(slug: string, fn: () => T) => withTenant(org(slug).id, fn);
const member = (slug: string, role: string) => inOrg(slug, () => svc.actorFor(db().staff.find((u) => u.role === role && u.status !== "invited")!));

async function main() {
  /* ------------------------------------------------------------------ */
  group("Production organization context (membership → active organization)");

  await test("no authenticated principal → AuthenticationError (no org is ever guessed)", () => {
    assert.throws(() => svc.resolveActiveOrganization(null, "abc-freight"), svc.AuthenticationError);
  });

  await test("a client-selected organization is only a choice among the principal's memberships", () => {
    const alicia = { subject: "auth0|alicia", email: "alicia@abcfreight.example", kind: "staff" as const };
    const ctx = svc.resolveActiveOrganization(alicia, null);
    assert.equal(ctx.organization.slug, "abc-freight");
    assert.equal(ctx.actor.role, "owner");
    assert.equal(ctx.actor.organizationId, ctx.organization.id);
    assert.throws(() => svc.resolveActiveOrganization(alicia, "island-express"), /don't belong to this organization/);
    assert.throws(() => svc.resolveActiveOrganization(alicia, "shipping-os"), ForbiddenError);
    assert.throws(() => svc.resolveActiveOrganization({ ...alicia, email: "stranger@example.com" }, "abc-freight"), /any organization/);
  });

  await test("several memberships → must select; selection picks that membership's role", () => {
    inOrg("island-express", () => {
      const u = svc.inviteUser(svc.ownerOf(org("island-express").id), { name: "Alicia Brown", email: "alicia@abcfreight.example", role: "accounting" });
      const p = { subject: "s", email: "alicia@abcfreight.example", kind: "staff" as const };
      assert.equal(svc.membershipsOf(p).length, 1, "invited (unaccepted) memberships don't count");
      svc.acceptInvite(u.id);
      assert.throws(() => svc.resolveActiveOrganization(p, null), svc.OrganizationSelectionRequired);
      const ix = svc.resolveActiveOrganization(p, "island-express");
      assert.equal(ix.actor.role, "accounting");
      assert.equal(svc.resolveActiveOrganization(p, "ABC-FREIGHT").actor.role, "owner");
    });
  });

  await test("customer principals resolve to their own customer account", () => {
    const ctx = svc.resolveActiveOrganization({ subject: "c", email: "nadia.rolle@example.com", kind: "customer" }, null);
    assert.equal(ctx.organization.slug, "abc-freight");
    assert.equal(ctx.actor.kind, "customer");
    assert.ok(ctx.actor.customerId);
  });

  /* ------------------------------------------------------------------ */
  group("Module dependency graph");

  await test("registry validation rejects unknown, self and circular dependencies (generic)", () => {
    assert.deepEqual(registryProblems(MODULES), []);
    assert.deepEqual(registryProblems({ a: { dependencies: ["ghost"] } }), ["a depends on unknown module ghost"]);
    assert.deepEqual(registryProblems({ a: { dependencies: ["a"] } }), ["a depends on itself"]);
    const cyc = registryProblems({ a: { dependencies: ["b"] }, b: { dependencies: ["c"] }, c: { dependencies: ["a"] }, d: { dependencies: ["a"] } });
    assert.equal(cyc.length, 1);
    assert.match(cyc[0], /cycle: a → b → c → a/);
  });

  await test("missing dependencies: reported by validation, rejected in strict mode, auto-added otherwise", () => {
    assert.deepEqual(validateModules(["schedules"]), ["Schedules & Trips requires Routes & Ports.", "Schedules & Trips requires Vessels."]);
    inOrg("swift-courier", () => {
      const owner = svc.ownerOf(org("swift-courier").id);
      const before = [...org("swift-courier").modules];
      assert.throws(() => svc.setModules(owner, [...before, "capacity"], { strict: true }), /Capacity requires Vessels/);
      assert.deepEqual(org("swift-courier").modules, before, "rejected config not stored");
      const r = svc.setModules(owner, [...before, "capacity"]);
      assert.deepEqual(sortedArr(r.added), sortedArr(["capacity", "vessels", "routes"]));
      svc.setModules(owner, before);
    });
  });

  await test("presets resolve through the same resolver", () => {
    for (const t of BUSINESS_TYPE_IDS) assert.deepEqual(presetModules(t), resolveModules(BUSINESS_TYPES[t].modules), t);
  });

  await test("custom organizations can modify any preset safely (500 random toggles per preset stay valid)", () => {
    let seed = 42;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (const t of BUSINESS_TYPE_IDS) {
      let mods = presetModules(t);
      for (let i = 0; i < 500; i++) {
        const m = MODULE_IDS[Math.floor(rand() * MODULE_IDS.length)];
        const on = rand() < 0.5;
        mods = toggleModule(mods, m, on);
        assert.deepEqual(validateModules(mods), [], `${t} after toggling ${m}`);
        if (on) [m, ...requirementsOf(m)].forEach((x) => assert.ok(mods.includes(x)));
        else [m, ...dependentsOf(m)].forEach((x) => assert.ok(!mods.includes(x), `${x} still on after ${m} off`));
      }
    }
  });

  await test("planned modules exist as entitlements without pretending to be implemented", () => {
    const planned = MODULE_IDS.filter((m) => MODULES[m].availability === "planned");
    assert.ok(planned.includes("carrier_network"));
    for (const t of BUSINESS_TYPE_IDS) for (const m of planned) assert.ok(!presetModules(t).includes(m), `${t} preset includes planned ${m}`);
    const uses = [...OPS_NAV.flatMap((x) => x.requires), ...CUSTOMER_ROUTES.flatMap((x) => x.requires), ...Object.values(WIDGETS).flatMap((w) => w.requires), ...ALL_TOOLS.map((t) => t.module), ...Object.values(svc.IMPORT_KINDS).map((k) => k.module)];
    for (const m of planned) assert.ok(!uses.includes(m), `${m} is planned but something requires it`);
    const base = resolveModules(["routes"]);
    assert.deepEqual(opsNavFor("owner", resolveModules(["routes", "carrier_network"])), opsNavFor("owner", base), "enabling a planned module adds no screens");
  });

  /* ------------------------------------------------------------------ */
  group("AI tool contract & boundary");

  await test("every tool declares the full contract; consequential staff writes require confirmation", () => {
    for (const t of ALL_TOOLS) {
      assert.deepEqual(contractProblems(t), [], t.name);
      for (const k of ["name", "description", "inputSchema", "audience", "module", "permission", "kind", "confirmation", "service", "audit"] as const) assert.ok(k in t, `${t.name}.${k}`);
    }
    for (const t of STAFF_TOOLS.filter((x) => x.kind === "write")) assert.equal(t.confirmation, "required", t.name);
    const bad = { ...ALL_TOOLS[0], kind: "write", confirmation: "required", audit: "trace", preview: undefined } as ToolSpec;
    assert.deepEqual(contractProblems(bad), ["writes must be audited as events", "confirmation needs a preview"]);
    assert.ok(contractProblems({ ...ALL_TOOLS[0], module: "carrier_network" }).some((p) => /planned/.test(p)));
  });

  await test("each tool delegates to a real service function; no tool can take or move money", () => {
    for (const t of ALL_TOOLS) {
      const fn = t.service.split(".")[1];
      if (!t.service.startsWith("rates.")) assert.equal(typeof (svc as Record<string, unknown>)[fn], "function", `${t.name} → ${t.service}`);
    }
    for (const forbidden of ["demoPay", "recordPayment", "applyPayment", "acceptDifference", "voidBill", "approveCustoms"]) assert.ok(!ALL_TOOLS.some((t) => t.service.endsWith(`.${forbidden}`)), forbidden);
  });

  await test("AI code never imports the store (static check, also enforced by lint)", () => {
    for (const f of readdirSync("src/ai")) {
      const src = readFileSync(`src/ai/${f}`, "utf8");
      assert.ok(!/from "@\/data\/(store|seed)/.test(src), `src/ai/${f} imports the store`);
      if (["agent.ts", "planner.ts", "copy.ts", "types.ts"].includes(f)) assert.ok(!/from "@\/services/.test(src), `src/ai/${f} bypasses tools`);
    }
  });

  const ix = org("island-express");
  const dispatcher = member("island-express", "dispatcher");
  const dctx = () => staffToolContext(dispatcher);
  const nextTrip = () => inOrg("island-express", () => svc.listTrips({ days: 21, routed: true }).find((t) => t.status === "scheduled" && t.destinationId === "andros" && !svc.isManifestClosed(t.id))!);

  await test("reads execute immediately through the service", () => {
    withTenant(ix.id, () => {
      const trip = nextTrip();
      const out = executeTool("getTripCapacity", { tripId: trip.id }, dctx());
      assert.equal(out.status, "done");
      assert.deepEqual(out.status === "done" && out.result, svc.tripCapacity(trip));
    });
  });

  await test("consequential write → proposal only; nothing changes until the same user confirms", () => {
    withTenant(ix.id, () => {
      const trip = nextTrip();
      const customer = db().customers[2];
      const bookingsBefore = db().bookings.length;
      const out = executeTool("createBooking", { customerId: customer.id, tripId: trip.id, description: "Generator", pieces: 1, weightLb: 400 }, dctx());
      assert.equal(out.status, "needs_confirmation");
      if (out.status !== "needs_confirmation") return;
      assert.match(out.proposal.preview.title, /Book 400 lb on/);
      assert.equal(db().bookings.length, bookingsBefore, "proposal mutated nothing");
      const owner = svc.ownerOf(ix.id);
      assert.throws(() => confirmToolAction(out.proposal.id, staffToolContext(owner)), /Only the person who asked/);
      const b = confirmToolAction<{ id: string; status: string }>(out.proposal.id, dctx());
      assert.equal(b.status, "confirmed");
      assert.equal(db().bookings.length, bookingsBefore + 1);
      assert.throws(() => confirmToolAction(out.proposal.id, dctx()), /already confirmed/);
      const types = db().events.slice(-6).map((e) => e.type);
      for (const t of ["AI_ACTION_PROPOSED", "BOOKING_CONFIRMED", "AI_ACTION_EXECUTED", "AI_ACTION_CONFIRMED"]) assert.ok(types.includes(t), t);
      assert.equal(db().events.find((e) => e.type === "BOOKING_CONFIRMED" && e.refs.bookingId === b.id)?.actor.via, "ai", "audit shows the AI acted for the user");
    });
  });

  await test("tools can't bypass role permission, module entitlement or tenant scope", () => {
    withTenant(ix.id, () => {
      const gina = staffToolContext(member("island-express", "support"));
      assert.throws(() => executeTool("closeManifest", { tripId: nextTrip().id }, gina), /role can't use closeManifest/);
      assert.equal(db().aiProposals.filter((p) => p.proposedBy.userId === gina.actor.userId).length, 0, "no proposal for an unauthorized call");
      assert.throws(() => executeTool("summarizeWarehouse", {}, dctx()), svc.ModuleDisabledError);
      const abcOwner = staffToolContext(svc.ownerOf(org("abc-freight").id));
      assert.throws(() => executeTool("listTodaysTrips", {}, abcOwner), /isn't for the organization in scope/);
    });
    inOrg("abc-freight", () => assert.throws(() => executeTool("getTripCapacity", { tripId: nextTrip().id }, staffToolContext(svc.ownerOf(org("abc-freight").id))), svc.ModuleDisabledError));
    inOrg("swift-courier", () => assert.throws(() => executeTool("listDeliveries", {}, staffToolContext(member("swift-courier", "driver"))), /role can't use/));
  });

  await test("a proposal is re-authorized at confirmation (module turned off → fails, recorded)", () => {
    withTenant(ix.id, () => {
      const owner = svc.ownerOf(ix.id);
      const out = executeTool("closeManifest", { tripId: nextTrip().id }, dctx());
      assert.equal(out.status, "needs_confirmation");
      if (out.status !== "needs_confirmation") return;
      svc.setModuleEnabled(owner, "manifest", false);
      assert.throws(() => confirmToolAction(out.proposal.id, dctx()), svc.ModuleDisabledError);
      assert.equal(db().aiProposals.find((p) => p.id === out.proposal.id)!.status, "failed");
      svc.setModuleEnabled(owner, "manifest", true);
    });
  });

  await test("proposals are tenant-scoped, single-use, cancellable and expire", () => {
    const p = withTenant(ix.id, () => {
      const out = executeTool("closeManifest", { tripId: nextTrip().id }, dctx());
      return out.status === "needs_confirmation" ? out.proposal : undefined;
    })!;
    inOrg("abc-freight", () => assert.throws(() => confirmToolAction(p.id, staffToolContext(svc.ownerOf(org("abc-freight").id))), /wasn't found/));
    withTenant(ix.id, () => {
      cancelToolAction(p.id, dctx());
      assert.throws(() => confirmToolAction(p.id, dctx()), /already cancelled/);
      const out = executeTool("closeManifest", { tripId: nextTrip().id }, dctx());
      if (out.status !== "needs_confirmation") throw new Error("expected proposal");
      atTime(Date.now() + 2 * HOUR, () => assert.throws(() => confirmToolAction(out.proposal.id, dctx()), /expired/));
      assert.equal(svc.isManifestClosed(nextTrip().id), false);
    });
  });

  await test("audiences can't be mixed: staff can't use customer tools, customer AI can't use staff tools or others' records", () => {
    withTenant(svc.DEFAULT_ORG_ID, () => {
      const cctx = customerToolContext("cus_trevor", "web");
      assert.throws(() => runTool("searchShipments", {}, cctx), /acts for a staff user/);
      const mg = staffToolContext(svc.staffActor("Renee Thompson", "manager"));
      assert.throws(() => runTool("getPackages", {}, mg), /acts for a signed-in customer/);
      const sarahsPackage = db().packages.find((p) => p.customerId === "cus_sarah")!;
      assert.throws(() => runTool("getPackage", { packageId: sarahsPackage.id }, cctx), /not found on your account/);
      assert.throws(() => runTool("getPackage", { packageId: 42 }, cctx), /packageId must be a string/);
      assert.throws(() => runTool("getPackages", { sneaky: true }, cctx), /unexpected field/);
    });
  });

  /* ------------------------------------------------------------------ */
  group("WhatsApp tenant isolation — conversation identity is (organization, phone)");
  installAsyncTenantScope(); // async webhook handling needs the server's request scope (as in production)

  const PHONE = "+12425559999";
  const wa = PHONE.replace(/\D/g, "");
  const abc = org("abc-freight");
  const abcOwner = svc.ownerOf(abc.id);
  inOrg("abc-freight", () => {
    svc.setModuleEnabled(abcOwner, "assistant", true);
    svc.updateOrganizationProfile(abcOwner, { channels: { whatsappPhoneNumberId: "ABC_PHONE_ID" } });
    svc.createCustomer(abcOwner, { firstName: "Shared", lastName: "Number", phone: PHONE, homeDestination: "nassau" });
  });
  withTenant(svc.DEFAULT_ORG_ID, () => svc.createCustomer(svc.staffActor("Renee Thompson", "manager"), { firstName: "Same", lastName: "Phone", phone: PHONE, homeDestination: "nassau" }));

  const send = (slug: string, text: string, phoneId?: string) => inOrg(slug, () => handleWhatsAppWebhook(buildInboundPayload(wa, "Them", { text }, phoneId), demoSender));

  await test("one organization's half-finished conversation never continues in another", async () => {
    const a1 = await send("abc-freight", "How much to ship to Exuma?");
    assert.equal(a1.results[0].intent, "quote");
    const b = await send("shipping-os", "7");
    assert.ok(!JSON.stringify(b.results[0].outbound).includes("Exuma"), "default org must not continue ABC's quote");
    const a2 = await send("abc-freight", "7");
    assert.equal(a2.results[0].intent, "quote");
    assert.ok(JSON.stringify(a2.results[0].outbound).includes("Exuma"), "ABC continues its own conversation");
  });

  await test("conversation records and memory live in each tenant; histories don't mix", () => {
    const abcConv = inOrg("abc-freight", () => db().conversations.filter((c) => c.channel === "whatsapp" && db().customers.find((x) => x.id === c.customerId)?.phone === PHONE));
    const defConv = inOrg("shipping-os", () => db().conversations.filter((c) => c.channel === "whatsapp" && db().customers.find((x) => x.id === c.customerId)?.phone === PHONE));
    assert.equal(abcConv.length, 1);
    assert.equal(defConv.length, 1);
    assert.ok(abcConv[0].messages.some((m) => /Exuma/.test(m.text)));
    assert.ok(!defConv[0].messages.some((m) => /Exuma/.test(m.text)));
    assert.notEqual(abcConv[0].organizationId, defConv[0].organizationId);
    assert.equal(typeof (abcConv[0].agentContext as { lastPackageId?: unknown } | undefined), "object");
  });

  await test("a message to another organization's business number is ignored, not processed", async () => {
    const r = await send("shipping-os", "where is my package", "ABC_PHONE_ID");
    assert.equal(r.results[0].intent, "wrong_organization");
    assert.equal(svc.organizationForWhatsAppNumber("ABC_PHONE_ID")?.id, abc.id);
    assert.throws(() => inOrg("island-express", () => svc.updateOrganizationProfile(svc.ownerOf(org("island-express").id), { channels: { whatsappPhoneNumberId: "ABC_PHONE_ID" } })), /belongs to another organization/);
  });

  void platform;
  console.log(`\nAll ${n} hardening tests passed.`);
}

const sortedArr = (xs: readonly string[]) => [...xs].sort();

main().catch((e) => {
  console.error("✗ Hardening test failed:", e);
  process.exit(1);
});
