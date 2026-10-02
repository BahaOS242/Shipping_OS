/**
 * PLATFORM TESTS — modules, presets, onboarding, tenant isolation,
 * module gating, authorization and the inter-island booking flow.
 *   npx tsx tests/platform.ts
 */
import assert from "node:assert/strict";
import "@/services";
import { db, platform, withTenant } from "@/data/store";
import { ForbiddenError } from "@/domain/roles";
import { BUSINESS_TYPES, BUSINESS_TYPE_IDS, presetModules, type BusinessType } from "@/platform/businessTypes";
import { MODULES, MODULE_IDS, dependentsOf, resolveModules, toggleModule, validateModules, type ModuleId } from "@/platform/modules";
import { opsNavFor, opsPathAccess, customerPathMissing } from "@/platform/navigation";
import * as svc from "@/services";

let n = 0;
const groups: string[] = [];
function test(label: string, fn: () => void) {
  fn();
  n++;
  console.log(`✓ ${label}`);
}
function group(name: string) {
  groups.push(name);
  console.log(`\n${name}`);
}
const orgBySlug = (slug: string) => svc.getOrganizationBySlug(slug)!;
const DEFAULT = svc.DEFAULT_ORG_ID;
const in_ = <T,>(slug: string, fn: () => T) => withTenant(orgBySlug(slug).id, fn);
const sorted = (xs: readonly string[]) => [...xs].sort();

/* ------------------------------------------------------------------ */
group("Module registry & dependency resolver");

test("every dependency is a registered module and the graph has no cycles", () => {
  for (const m of MODULE_IDS) {
    for (const d of MODULES[m].dependencies) assert.ok(MODULE_IDS.includes(d), `${m} → unknown ${d}`);
    const seen = new Set<ModuleId>();
    const walk = (x: ModuleId, path: ModuleId[]) => {
      assert.ok(!path.includes(x), `cycle: ${[...path, x].join(" → ")}`);
      if (seen.has(x)) return;
      seen.add(x);
      MODULES[x].dependencies.forEach((d) => walk(d, [...path, x]));
    };
    walk(m, []);
  }
});

test("enable capacity → vessels and routes automatically enabled", () => {
  const r = resolveModules(["capacity"]);
  assert.ok(r.includes("vessels") && r.includes("routes") && r.includes("capacity"));
});

test("warehouse → shipments → customers; manifest → shipments; customer_portal → customers + tracking", () => {
  assert.deepEqual(sorted(resolveModules(["warehouse"])), sorted(["warehouse", "shipments", "customers"]));
  assert.ok(resolveModules(["manifest"]).includes("shipments"));
  const cp = resolveModules(["customer_portal"]);
  assert.ok(cp.includes("customers") && cp.includes("tracking") && cp.includes("shipments"));
});

test("unknown modules are rejected; invalid stored configurations are reported", () => {
  assert.throws(() => resolveModules(["teleporter"]), /Unknown module/);
  assert.deepEqual(validateModules(["capacity"]), ["Capacity requires Vessels.", "Capacity requires Routes & Ports."]);
  assert.deepEqual(validateModules(resolveModules(["capacity"])), []);
});

test("disabling a module also disables everything that depends on it", () => {
  const all = resolveModules(["booking", "capacity"]);
  const next = toggleModule(all, "vessels", false);
  for (const m of ["vessels", "capacity", "schedules", "booking"] as ModuleId[]) assert.ok(!next.includes(m), `${m} still on`);
  assert.ok(next.includes("routes") && next.includes("shipments"));
  assert.deepEqual(validateModules(next), []);
  assert.ok(dependentsOf("vessels").includes("capacity"));
});

/* ------------------------------------------------------------------ */
group("Onboarding presets");

const EXPECTED: Record<Exclude<BusinessType, "logistics_company" | "custom">, ModuleId[]> = {
  freight_forwarder: ["customers", "quotes", "billing", "shipments", "warehouse", "customs", "manifest", "tracking", "delivery", "support", "customer_portal", "analytics"],
  mailboat_operator: ["customers", "billing", "shipments", "manifest", "tracking", "vessels", "routes", "schedules", "capacity", "booking", "customer_portal", "analytics"],
  charter_operator: ["customers", "quotes", "billing", "shipments", "manifest", "tracking", "vessels", "routes", "schedules", "capacity", "booking", "customer_portal"],
  courier: ["customers", "quotes", "billing", "shipments", "tracking", "delivery", "driver_portal", "customer_portal", "analytics"],
  warehouse: ["customers", "shipments", "warehouse", "manifest", "tracking", "customer_portal"],
};

for (const t of Object.keys(EXPECTED) as (keyof typeof EXPECTED)[]) {
  test(`${BUSINESS_TYPES[t].label} preset gets exactly its modules`, () => assert.deepEqual(sorted(presetModules(t)), sorted(EXPECTED[t])));
}

test("Full Logistics gets every available module; Custom starts minimal", () => {
  assert.deepEqual(sorted(presetModules("logistics_company")), sorted(MODULE_IDS.filter((m) => MODULES[m].availability === "available")));
  assert.deepEqual(presetModules("custom"), ["customers"]);
});

test("every preset is dependency-complete", () => {
  for (const t of BUSINESS_TYPE_IDS) assert.deepEqual(validateModules(presetModules(t)), [], t);
});

/* ------------------------------------------------------------------ */
group("Definition of done — same platform, different organizations");

test('"ABC Freight" (Freight Forwarder) gets forwarding modules, not vessels/capacity/charter/driver portal', () => {
  const abc = orgBySlug("abc-freight");
  for (const m of ["customers", "quotes", "billing", "shipments", "warehouse", "manifest", "tracking", "customer_portal"] as ModuleId[]) assert.ok(abc.modules.includes(m), `missing ${m}`);
  for (const m of ["vessels", "capacity", "carrier_network", "driver_portal"] as ModuleId[]) assert.ok(!abc.modules.includes(m), `unexpected ${m}`);
  const nav = opsNavFor("admin", abc.modules).map((x) => x.href);
  assert.ok(nav.includes("/warehouse") && nav.includes("/manifest") && nav.includes("/accounting"));
  for (const h of ["/vessels", "/trips", "/capacity", "/driver", "/bookings"]) assert.ok(!nav.includes(h), `ABC sees ${h}`);
});

test('"Island Express" (Mailboat) sees Vessels, Routes, Trips, Schedules, Capacity, Manifest — and no Warehouse', () => {
  const ix = orgBySlug("island-express");
  const nav = opsNavFor("admin", ix.modules).map((x) => x.href);
  for (const h of ["/vessels", "/routes", "/trips", "/schedules", "/capacity", "/manifest", "/bookings"]) assert.ok(nav.includes(h), `missing ${h}`);
  for (const h of ["/warehouse", "/customs", "/delivery"]) assert.ok(!nav.includes(h), `unexpected ${h}`);
  assert.deepEqual(svc.dashboardFor(ix).slice(0, 3), ["todays_trips", "capacity", "bookings"]);
});

test("route guard: module checked before role; URL-typing a disabled page is refused", () => {
  const abc = orgBySlug("abc-freight");
  const r = opsPathAccess("admin", "/vessels", abc.modules);
  assert.ok(!r.ok && r.reason === "module" && r.missing.includes("vessels"));
  const w = opsPathAccess("customs", "/warehouse", abc.modules);
  assert.ok(!w.ok && w.reason === "role");
  assert.ok(opsPathAccess("warehouse", "/warehouse/scan", abc.modules).ok);
  assert.deepEqual(customerPathMissing("/book", abc.modules), ["booking"]);
  assert.deepEqual(customerPathMissing("/packages/TL-PKG-1", abc.modules), []);
});

/* ------------------------------------------------------------------ */
group("Tenant isolation (service layer)");

const defaultShipment = withTenant(DEFAULT, () => db().shipments[0]);
const defaultBill = withTenant(DEFAULT, () => db().bills.find((b) => b.lifecycle === "issued")!);
const defaultCustomer = withTenant(DEFAULT, () => db().customers[0]);
const abcOwner = svc.ownerOf(orgBySlug("abc-freight").id);

test("Org A cannot read Org B's shipment, customer or invoice by ID", () => {
  in_("abc-freight", () => {
    assert.throws(() => svc.getShipment(defaultShipment.id), svc.NotFoundError);
    assert.throws(() => svc.getCustomer(defaultCustomer.id), svc.NotFoundError);
    assert.throws(() => svc.getBill(defaultBill.id), svc.NotFoundError);
    assert.equal(svc.listShipments().some((s) => s.id === defaultShipment.id), false);
    assert.equal(svc.search(defaultShipment.id).length, 0);
  });
});

test("Org A cannot modify Org B's invoice — not from its own scope, not by acting inside B's", () => {
  in_("abc-freight", () => assert.throws(() => svc.voidBill(abcOwner, defaultBill.id, "nope"), svc.NotFoundError));
  withTenant(DEFAULT, () => {
    assert.throws(() => svc.voidBill(abcOwner, defaultBill.id, "nope"), /don't belong/);
    assert.throws(() => svc.recordPayment(abcOwner, { customerId: defaultBill.customerId, billId: defaultBill.id, amount: 1, method: "cash" }), /don't belong/);
    assert.equal(svc.getBill(defaultBill.id).lifecycle, "issued");
  });
});

test("a customer of Org A is not a member of Org B", () => {
  const nadia = in_("abc-freight", () => db().customers[0]);
  withTenant(DEFAULT, () => assert.throws(() => svc.createClaim(svc.customerActor(nadia), { customerId: nadia.id, reason: "other", description: "Trying another tenant" }), ForbiddenError));
});

test("records carry their organizationId and partitions never mix", () => {
  for (const o of platform().organizations) {
    const t = platform().tenants[o.id];
    for (const [k, rows] of Object.entries(t)) {
      if (!Array.isArray(rows)) continue;
      for (const r of rows as { organizationId?: string }[]) assert.equal(r.organizationId, o.id, `${o.slug}.${k}`);
    }
  }
});

test("IDs are unique across tenants (platform-wide sequences)", () => {
  const ids = platform().organizations.flatMap((o) => platform().tenants[o.id].packages.map((p) => p.id));
  assert.equal(new Set(ids).size, ids.length);
});

/* ------------------------------------------------------------------ */
group("Module gating (service layer)");

test("warehouse disabled → warehouse services reject, even for the owner", () => {
  const ix = orgBySlug("island-express");
  const owner = svc.ownerOf(ix.id);
  withTenant(ix.id, () => {
    assert.throws(() => svc.dockScan(owner, { inboundTracking: "X1", carrier: "UPS", labelName: "Someone", merchant: "Amazon" }), svc.ModuleDisabledError);
    assert.throws(() => svc.warehouseQueues(), /Warehouse & Receiving isn't enabled for Island Express/);
  });
});

test("ABC (no vessels) cannot create vessels or bookings; courier has no customs queue", () => {
  in_("abc-freight", () => {
    assert.throws(() => svc.createVessel(abcOwner, { name: "Sneaky", kind: "barge", capacityLb: 1000 }), svc.ModuleDisabledError);
    assert.throws(() => svc.listBookings(), svc.ModuleDisabledError);
  });
  in_("swift-courier", () => assert.throws(() => svc.customsQueue(), svc.ModuleDisabledError));
});

test("turning a module off takes effect immediately in the services", () => {
  const sw = orgBySlug("swift-courier");
  const owner = svc.ownerOf(sw.id);
  withTenant(sw.id, () => {
    const c = db().customers[0];
    svc.createQuote(svc.customerActor(c), { destinationId: "nassau", service: "air", actualWeight: 2 });
    svc.setModuleEnabled(owner, "quotes", false);
    assert.throws(() => svc.createQuote(svc.customerActor(c), { destinationId: "nassau", service: "air", actualWeight: 2 }), svc.ModuleDisabledError);
    svc.setModuleEnabled(owner, "quotes", true);
  });
});

test("modules change config-driven behaviour: no customs module → shipments skip customs review", () => {
  in_("island-express", () => assert.ok(db().shipments.every((s) => s.customs.status === "approved" && s.status !== "awaiting_customs")));
});

/* ------------------------------------------------------------------ */
group("Authorization (module enabled + role)");

test("manifest enabled + Customer Service role → cannot close a manifest", () => {
  const ix = orgBySlug("island-express");
  withTenant(ix.id, () => {
    const gina = svc.actorFor(db().staff.find((u) => u.role === "support")!);
    const trip = svc.listTrips({ days: 14, routed: true }).find((t) => t.status === "scheduled")!;
    assert.throws(() => svc.closeManifest(gina, trip.id), /Only dispatch or the warehouse/);
  });
});

test("delivery enabled + driver role → can work own run, cannot schedule or touch another driver's delivery", () => {
  in_("swift-courier", () => {
    const kayla = svc.actorFor(db().staff.find((u) => u.name === "Kayla Moss")!);
    const andreDelivery = db().deliveries.find((d) => d.driver === "Andre Knowles")!;
    assert.throws(() => svc.scheduleDelivery(kayla, andreDelivery.id, { date: new Date().toISOString(), from: "09:00", to: "10:00", driver: "Kayla Moss" }), /delivery team/);
    assert.throws(() => svc.dispatchDelivery(kayla, andreDelivery.id), /isn't on your run/);
    const own = db().deliveries.find((d) => d.driver === "Kayla Moss" && d.status === "out_for_delivery")!;
    svc.completeDelivery(kayla, own.id, { receivedBy: "Zara Moxey" });
    assert.equal(svc.getDelivery(own.id).status, "delivered");
    assert.ok(svc.getDelivery(own.id).proof?.signature);
  });
});

test("invited members can't act until they accept", () => {
  in_("abc-freight", () => {
    const u = svc.inviteUser(abcOwner, { name: "Pending Person", email: "pending@abcfreight.example", role: "warehouse" });
    assert.throws(() => svc.dockScan(svc.actorFor(u), { inboundTracking: "Z", carrier: "UPS", labelName: "X", merchant: "Y" }), /Accept your invitation/);
    svc.acceptInvite(u.id);
    svc.dockScan(svc.actorFor(u), { inboundTracking: "ZZZ-1", carrier: "UPS", labelName: "Unknown Label", merchant: "Y" });
  });
});

test("only owners/admins can change organization settings", () => {
  in_("abc-freight", () => {
    const wh = svc.actorFor(db().staff.find((u) => u.role === "warehouse" && u.status === "active")!);
    assert.throws(() => svc.setModuleEnabled(wh, "vessels", true), /owner or admin/);
    assert.throws(() => svc.inviteUser(wh, { name: "X", email: "x@y.z", role: "admin" }), /owner or admin/);
  });
});

/* ------------------------------------------------------------------ */
group("Onboarding workflow");

test("create organization → partition, owner, resolved modules, branding, locations", () => {
  const { organization: org, owner } = svc.createOrganization({
    name: "Harbour Charters",
    businessType: "custom",
    modules: ["capacity", "booking", "billing"],
    branding: { primaryColor: "#123456" },
    locations: [{ name: "Harbour Dock", kind: "pickup_center", island: "exuma", address: "Demo Dock, Exuma" }],
    owner: { name: "Rae Owner", email: "rae@harbour.example" },
  });
  assert.equal(org.slug, "harbour-charters");
  for (const m of ["capacity", "vessels", "routes", "booking", "schedules", "shipments", "customers", "billing"] as ModuleId[]) assert.ok(org.modules.includes(m), m);
  assert.equal(owner.role, "owner");
  withTenant(org.id, () => {
    assert.equal(db().locations.length, 1);
    assert.ok(db().destinations.find((d) => d.id === "exuma")!.pickupLocationIds.includes(db().locations[0].id));
    const o = svc.ownerOf(org.id);
    const { created, errors } = svc.importCsv(o, "customers", 'firstName,lastName,email,phone,island,businessName\nAmy,Sands,amy@x.example,+1242,exuma,\n"Ben, Jr",Cox,ben@x.example,+1243,atlantis,\n');
    assert.equal(created, 1);
    assert.match(errors[0], /Row 3: Unknown island/);
    assert.equal(svc.importCsv(o, "vessels", "name,kind,capacityLb\nSea Spirit,ferry,20000\n").created, 1);
    const r = svc.setModuleEnabled(o, "delivery", true);
    assert.deepEqual(r.added, ["delivery"]);
  });
});

test("slugs are unique and validated; business type required", () => {
  assert.throws(() => svc.createOrganization({ name: "Dup", slug: "abc-freight", businessType: "courier", owner: { name: "A", email: "a@b.co" } }), /already taken/);
  assert.throws(() => svc.createOrganization({ name: "Bad", slug: "Bad Slug!", businessType: "courier", owner: { name: "A", email: "a@b.co" } }), /lowercase/);
  assert.throws(() => svc.createOrganization({ name: "X", businessType: "spaceport" as BusinessType, owner: { name: "A", email: "a@b.co" } }), /business type/);
  assert.throws(() => svc.createOrganization({ name: "X2", businessType: "custom", modules: ["warp_drive"], owner: { name: "A", email: "a@b.co" } }), /Unknown module/);
});

/* ------------------------------------------------------------------ */
group("Inter-island flow: booking → shipment → trip → manifest → depart → arrive");

test("capacity blocks overbooking; check-in creates a real shipment on the trip; manifest + departure follow", () => {
  const ix = orgBySlug("island-express");
  withTenant(ix.id, () => {
    const dispatch = svc.actorFor(db().staff.find((u) => u.role === "dispatcher")!);
    const customer = db().customers[1];
    const trip = svc.listTrips({ days: 21, routed: true }).find((t) => t.status === "scheduled" && t.destinationId === "exuma" && new Date(t.departsAt).getTime() > Date.now())!;
    const before = svc.tripCapacity(trip);
    assert.equal(before.capacityLb, 90_000);
    assert.throws(() => svc.requestBooking(dispatch, { customerId: customer.id, tripId: trip.id, description: "Too much", pieces: 1, weightLb: before.remainingLb! + 1 }), /doesn't have room/);

    const req = svc.requestBooking(svc.customerActor(customer), { customerId: customer.id, tripId: trip.id, description: "Tiles", pieces: 3, weightLb: 500 });
    assert.equal(req.status, "requested");
    assert.throws(() => svc.confirmBooking(svc.customerActor(customer), req.id), /Only staff/);
    svc.confirmBooking(dispatch, req.id);
    const { shipment } = svc.checkInBooking(dispatch, req.id, { actualWeight: 480 });
    assert.equal(shipment.voyageId, trip.id);
    assert.equal(shipment.status, "cleared");
    assert.ok(svc.listBills({ shipmentId: shipment.id }).length === 1, "billed (billing module on)");

    const m = svc.manifestFor(trip.id);
    assert.ok(m.lines.some((l) => l.shipment.id === shipment.id && l.weightLb === 480));
    svc.closeManifest(dispatch, trip.id);
    assert.throws(() => svc.requestBooking(dispatch, { customerId: customer.id, tripId: trip.id, description: "Late", pieces: 1, weightLb: 10 }), /closed for loading/);

    svc.departTrip(dispatch, trip.id);
    assert.equal(svc.getShipment(shipment.id).status, "departed");
    svc.arriveTrip(dispatch, trip.id);
    assert.equal(svc.getShipment(shipment.id).status, "arrived");
    const types = new Set(svc.timeline({ shipmentId: shipment.id }).map((e) => e.type));
    for (const t of ["SHIPMENT_CREATED", "SHIPMENT_DEPARTED", "SHIPMENT_ARRIVED"]) assert.ok(types.has(t), t);
  });
});

test("forwarder load planning: a cleared shipment can be put on a specific flight and departs on it", () => {
  withTenant(DEFAULT, () => {
    const mg = svc.staffActor("Renee Thompson", "manager");
    const trevor = svc.getCustomer("cus_trevor");
    const pkgs = svc.consolidationCandidates(trevor.id).filter((p) => p.purchaseInvoiceId);
    const sh = svc.createShipment(svc.customerActor(trevor), { customerId: trevor.id, packageIds: [pkgs[0].id] });
    svc.approveCustoms(svc.staffActor("Nadia Seymour", "customs"), sh.id);
    const trips = db().voyages.filter((v) => v.destinationId === sh.destinationId && v.mode === sh.service && v.status === "scheduled" && new Date(v.departsAt).getTime() > Date.now());
    const later = trips.sort((a, b) => a.departsAt.localeCompare(b.departsAt))[1];
    svc.assignShipmentToTrip(mg, sh.id, later.id);
    svc.departShipment(mg, sh.id);
    assert.equal(svc.getShipment(sh.id).voyageId, later.id);
  });
});

console.log(`\nAll ${n} platform tests passed (${groups.length} groups).`);
