/**
 * CONCURRENT TENANT ISOLATION — many organizations' requests interleaved across
 * awaits, using the same AsyncLocalStorage scope the server uses, plus the real
 * API route handlers and WhatsApp webhook called concurrently.
 *   npx tsx tests/concurrency.ts
 */
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import "@/services";
import { db, tenantId, withTenant, TenantScopeError } from "@/data/store";
import { setAuthenticator } from "@/server/requestContext";
import { installAsyncTenantScope } from "@/server/tenantScope";
import * as svc from "@/services";
import { POST as toolPOST } from "@/app/api/tools/[name]/route";
import { POST as webhookPOST } from "@/app/api/channels/whatsapp/webhook/route";
import { buildInboundPayload } from "@/ai/whatsapp";

installAsyncTenantScope();

let n = 0;
const test = async (label: string, fn: () => Promise<void> | void) => {
  await fn();
  n++;
  console.log(`✓ ${label}`);
};
let seed = 7;
const jitter = () => sleep(Math.floor(((seed = (seed * 48271) % 2147483647) / 2147483647) * 8));
const ORGS = ["shipping-os", "abc-freight", "island-express", "swift-courier"].map((s) => svc.getOrganizationBySlug(s)!);
/** The organization's owner (or admin, for the original demo org). */
const lead = (orgId: string) => withTenant(orgId, () => svc.actorFor(db().staff.find((u) => u.role === "owner") ?? db().staff.find((u) => u.role === "admin")!));
const snapshot = (orgId: string) => withTenant(orgId, () => ({ customers: db().customers.map((c) => c.id), shipments: db().shipments.map((s) => s.id), bills: db().bills.map((b) => `${b.id}:${b.lifecycle}:${b.total}`) }));

async function main() {
  await test("outside a request scope there is no organization (no silent fallback)", () => {
    assert.throws(() => tenantId(), TenantScopeError);
    assert.throws(() => svc.listShipments(), TenantScopeError);
  });

  const before = Object.fromEntries(ORGS.map((o) => [o.id, snapshot(o.id)]));
  const created: Record<string, string[]> = Object.fromEntries(ORGS.map((o) => [o.id, []]));
  const foreign = Object.fromEntries(ORGS.map((o) => [o.id, ORGS.filter((x) => x.id !== o.id).flatMap((x) => [...before[x.id].shipments.slice(0, 3), ...before[x.id].customers.slice(0, 3)])]));

  await test("80 interleaved requests across 4 organizations: reads, cross-tenant probes and writes stay in their tenant", async () => {
    await Promise.all(
      Array.from({ length: 80 }, (_, i) => {
        const org = ORGS[i % ORGS.length];
        return withTenant(org.id, async () => {
          await jitter();
          assert.equal(tenantId(), org.id);
          for (const c of svc.listCustomers()) assert.equal(c.organizationId, org.id);
          for (const s of svc.listShipments()) assert.equal(s.organizationId, org.id);
          await jitter();
          for (const id of foreign[org.id]) {
            assert.equal(svc.findShipment(id), undefined, `${org.slug} saw shipment ${id}`);
            assert.equal(svc.findCustomer(id), undefined, `${org.slug} saw customer ${id}`);
          }
          await jitter();
          const c = svc.createCustomer(lead(org.id), { firstName: `Req${i}`, lastName: org.slug, phone: `+1242000${i}` });
          created[org.id].push(c.id);
          await jitter();
          assert.equal(tenantId(), org.id, "scope survives awaits");
          assert.equal(svc.findCustomer(c.id)?.organizationId, org.id);
        });
      }),
    );
  });

  await test("each organization gained exactly its own writes; nothing else changed", () => {
    for (const o of ORGS) {
      const after = snapshot(o.id);
      assert.equal(created[o.id].length, 20);
      assert.deepEqual(after.customers, [...before[o.id].customers, ...created[o.id]]);
      assert.deepEqual(after.shipments, before[o.id].shipments);
      assert.deepEqual(after.bills, before[o.id].bills);
    }
  });

  await test("A cannot mutate B's records even when B's IDs are used inside A's concurrent request", async () => {
    const [a, b] = [ORGS[1], ORGS[0]];
    const bBill = withTenant(b.id, () => db().bills.find((x) => x.lifecycle === "issued" && !db().payments.some((p) => p.billId === x.id))!);
    await Promise.all([
      withTenant(a.id, async () => {
        await jitter();
        assert.throws(() => svc.voidBill(lead(a.id), bBill.id, "cross-tenant"), svc.NotFoundError);
      }),
      withTenant(b.id, async () => {
        await jitter();
        assert.throws(() => svc.voidBill(lead(a.id), bBill.id, "foreign actor"), /don't belong/);
      }),
    ]);
    withTenant(b.id, () => assert.equal(svc.getBill(bBill.id).lifecycle, "issued"));
  });

  await test("functions and timers can't carry one request's organization into another", async () => {
    let readOrg: (() => string) | undefined;
    let timerSaw = "";
    await withTenant(ORGS[1].id, async () => {
      readOrg = () => svc.currentOrganization().id; // a "scoped service instance" captured in A
      setTimeout(() => (timerSaw = tenantId()), 5); // scheduled in A
      await jitter();
    });
    await withTenant(ORGS[2].id, async () => {
      await sleep(10);
      assert.equal(readOrg!(), ORGS[2].id, "captured function runs with the CALLER's organization");
    });
    assert.equal(timerSaw, ORGS[1].id, "work started by A finishes as A");
    assert.throws(() => readOrg!(), TenantScopeError, "and outside any request, nothing at all");
  });

  await test("module entitlement is per organization under concurrency (toggling one org's module never affects another)", async () => {
    const swift = ORGS[3];
    const abc = ORGS[1];
    const owner = svc.ownerOf(swift.id);
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) =>
        i % 3 === 0
          ? withTenant(swift.id, async () => {
              await jitter();
              svc.setModuleEnabled(owner, "quotes", i % 2 === 0);
              return "toggle";
            })
          : withTenant(i % 3 === 1 ? abc.id : ORGS[2].id, async () => {
              await jitter();
              const c = svc.listCustomers()[0];
              if (svc.currentOrganization().modules.includes("quotes")) {
                svc.createQuote(svc.customerActor(c), { destinationId: "nassau", service: "air", actualWeight: 1 });
                return "quoted";
              }
              assert.throws(() => svc.createQuote(svc.customerActor(c), { destinationId: "nassau", service: "air", actualWeight: 1 }), svc.ModuleDisabledError);
              return "refused";
            }),
      ),
    );
    assert.ok(results.filter((r) => r === "quoted").length > 0);
    withTenant(swift.id, () => svc.setModuleEnabled(owner, "quotes", true));
    assert.ok(svc.getOrganizationBySlug("island-express")!.modules.includes("quotes") === false, "Island Express never had quotes");
  });

  await test("real API route handlers, called concurrently for different organizations, return only their own data (demo transport)", async () => {
    const abc = ORGS[1];
    withTenant(abc.id, () => svc.setModuleEnabled(svc.ownerOf(abc.id), "api", true));
    const own = Object.fromEntries([ORGS[0], abc].map((o) => [o.slug, new Set(withTenant(o.id, () => db().packages.map((p) => p.id)))]));
    const calls = Array.from({ length: 24 }, (_, i) => (i % 2 ? "abc-freight" : "shipping-os"));
    const res = await Promise.all(calls.map((slug) => toolPOST(new Request(`http://x/api/tools/getPackages`, { method: "POST", headers: { "x-organization": slug }, body: "{}" }), { params: Promise.resolve({ name: "getPackages" }) })));
    for (const [i, r] of res.entries()) {
      assert.equal(r.status, 200);
      assert.equal(r.headers.get("x-shipping-os-auth"), "demo", "demo transport is labelled");
      const body = (await r.json()) as { result: { id: string }[] };
      for (const p of body.result) assert.ok(own[calls[i]].has(p.id), `${calls[i]} got foreign package ${p.id}`);
    }
    const blocked = await toolPOST(new Request("http://x/api/tools/getPackages", { method: "POST", headers: { "x-organization": "island-express" }, body: "{}" }), { params: Promise.resolve({ name: "getPackages" }) });
    assert.equal(blocked.status, 403);
  });

  await test("session mode: identity comes from authentication; the org header is only a selection among memberships", async () => {
    process.env.SHIPPING_OS_AUTH_MODE = "session";
    setAuthenticator((req) => {
      const email = req.headers.get("x-test-user");
      return email ? { subject: email, email, kind: "customer" } : null;
    });
    const call = (headers: Record<string, string>) => toolPOST(new Request("http://x/api/tools/getCustomer", { method: "POST", headers, body: "{}" }), { params: Promise.resolve({ name: "getCustomer" }) });
    const [anon, foreign, own, implicit] = await Promise.all([
      call({ "x-organization": "abc-freight" }),
      call({ "x-test-user": "nadia.rolle@example.com", "x-organization": "shipping-os" }),
      call({ "x-test-user": "nadia.rolle@example.com", "x-organization": "abc-freight" }),
      call({ "x-test-user": "trevor.armstrong@example.com" }),
    ]);
    assert.equal(anon.status, 401, "no principal → no access, whatever the header says");
    assert.equal(foreign.status, 403, "header naming an org you don't belong to → refused");
    assert.equal(own.status, 200);
    assert.equal(((await own.json()) as { result: { firstName: string } }).result.firstName, "Nadia");
    assert.equal(((await implicit.json()) as { result: { firstName: string } }).result.firstName, "Trevor");
    delete process.env.SHIPPING_OS_AUTH_MODE;
    setAuthenticator(() => null);
  });

  await test("concurrent WhatsApp webhooks for the same phone number in two organizations keep separate conversations", async () => {
    const abc = ORGS[1];
    const PHONE = "+12425558888";
    withTenant(abc.id, () => {
      const o = svc.ownerOf(abc.id);
      svc.setModuleEnabled(o, "assistant", true);
      svc.updateOrganizationProfile(o, { channels: { whatsappPhoneNumberId: "ABC_PHONE_ID" } });
      svc.createCustomer(o, { firstName: "Twin", lastName: "A", phone: PHONE });
    });
    withTenant(ORGS[0].id, () => svc.createCustomer(svc.staffActor("Renee Thompson", "manager"), { firstName: "Twin", lastName: "B", phone: PHONE }));
    const hook = (phoneId: string, text: string) => webhookPOST(new Request("http://x/api/channels/whatsapp/webhook", { method: "POST", body: JSON.stringify(withTenant(ORGS[0].id, () => buildInboundPayload(PHONE.replace(/\D/g, ""), "Twin", { text }, phoneId))) }));
    // ABC starts a quote while the default org's thread is busy with something else.
    await Promise.all([hook("ABC_PHONE_ID", "How much to ship to Exuma?"), hook("DEMO_PHONE_ID", "where is my package"), hook("DEMO_PHONE_ID", "thanks")]);
    const [inAbc, inDefault] = await Promise.all([hook("ABC_PHONE_ID", "7"), hook("DEMO_PHONE_ID", "7")]);
    const abcBody = JSON.stringify(await inAbc.json());
    const defBody = JSON.stringify(await inDefault.json());
    assert.ok(abcBody.includes("Exuma"), "ABC continues its own quote");
    assert.ok(!defBody.includes("Exuma"), "default org's thread did not inherit ABC's state");
    const unknownNumber = () => webhookPOST(new Request("http://x/api/channels/whatsapp/webhook", { method: "POST", body: JSON.stringify(withTenant(ORGS[0].id, () => buildInboundPayload("1999", "X", { text: "hi" }, "NOBODY_ID"))) }));
    assert.equal((await unknownNumber()).headers.get("x-shipping-os-auth"), "demo", "demo build: unregistered numbers use the labelled demo transport");
    process.env.SHIPPING_OS_AUTH_MODE = "session";
    assert.equal((await unknownNumber()).status, 404, "session mode: a number no organization owns is rejected");
    delete process.env.SHIPPING_OS_AUTH_MODE;
  });

  console.log(`\nAll ${n} concurrency tests passed.`);
}

main().catch((e) => {
  console.error("✗ Concurrency test failed:", e);
  process.exit(1);
});
