/**
 * DEMO ORGANIZATIONS — the same platform configured for three other businesses.
 * Created through the real onboarding, network, booking and delivery services
 * (no hand-built records), so they are consistent by construction.
 *
 *   ABC Freight     — Freight Forwarder preset
 *   Island Express  — Mailboat operator: ports, routes, vessels, schedules, trips, bookings, manifests
 *   Swift Courier   — Courier: dispatch, drivers, proof of delivery
 */
import type { Actor, DestinationId, ID } from "@/domain/types";
import * as svc from "@/services/api";
import { DAY, HOUR, atTime } from "./clock";
import { withTenant } from "./store";

function member(owner: Actor, name: string, email: string, role: Parameters<typeof svc.inviteUser>[1]["role"], title: string): Actor {
  const u = svc.inviteUser(owner, { name, email, role, title });
  svc.acceptInvite(u.id);
  return svc.actorFor(u);
}

const person = (firstName: string, lastName: string, island: DestinationId, phone: string, businessName?: string) => ({
  firstName,
  lastName,
  email: `${firstName}.${lastName}@example.com`.toLowerCase(),
  phone,
  homeDestination: island,
  businessName,
});

export function seedOtherOrganizations(T0: number) {
  const at = <T,>(t: number, fn: () => T) => atTime(t, fn);
  const daysAgo = (d: number) => T0 - d * DAY;

  /* ---------------- ABC Freight — freight forwarder ---------------- */
  const abc = at(daysAgo(60), () =>
    svc.createOrganization({
      name: "ABC Freight",
      slug: "abc-freight",
      businessType: "freight_forwarder",
      branding: { primaryColor: "#7c3aed", tagline: "Miami to Nassau, consolidated." },
      contact: { email: "ops@abcfreight.example", phone: "(242) 555-0300" },
      locations: [
        { name: "ABC Miami Warehouse", kind: "us_warehouse", address: "500 Demo Cargo Blvd, Miami, FL 33166", hours: "Mon–Fri 8am–5pm" },
        { name: "ABC Nassau Counter", kind: "pickup_center", island: "nassau", address: "Demo Gladstone Road, Nassau", hours: "Mon–Sat 9am–5pm" },
      ],
      owner: { name: "Alicia Brown", email: "alicia@abcfreight.example" },
    }).organization,
  );
  withTenant(abc.id, () => {
    const o = svc.ownerOf(abc.id);
    const wh = at(daysAgo(59), () => member(o, "Devon Pratt", "devon@abcfreight.example", "warehouse", "Warehouse lead, Miami"));
    member(o, "Rhonda Lightbourn", "rhonda@abcfreight.example", "accounting", "Accounts");
    const nadia = at(daysAgo(50), () => svc.createCustomer(o, person("Nadia", "Rolle", "nassau", "+12425550301")));
    at(daysAgo(40), () => svc.createCustomer(o, person("Chris", "Major", "nassau", "+12425550302", "Major Electrical Ltd.")));
    const p = at(daysAgo(3), () => svc.preAlert(svc.customerActor(nadia), { customerId: nadia.id, merchant: "Amazon", itemName: "Office chair", carrier: "Amazon", inboundTracking: "TBAABC0001", carrierWeight: 32 }));
    at(daysAgo(1), () => svc.dockScan(wh, { inboundTracking: p.inboundTracking, carrier: p.carrier, labelName: "Nadia Rolle", labelSuite: nadia.accountNumber, merchant: "Amazon" }));
  });

  /* ---------------- Island Express — mailboat operator ---------------- */
  const ix = at(daysAgo(90), () =>
    svc.createOrganization({
      name: "Island Express",
      slug: "island-express",
      businessType: "mailboat_operator",
      branding: { primaryColor: "#0369a1", tagline: "Mailboat cargo to the Family Islands." },
      contact: { email: "freight@islandexpress.example", phone: "(242) 555-0400", address: "Demo Potter's Cay Dock, Nassau" },
      locations: [
        { name: "Potter's Cay Freight Office", kind: "pickup_center", island: "nassau", address: "Demo Potter's Cay Dock, Nassau", hours: "Mon–Sat 6am–4pm" },
        { name: "George Town Dock Office", kind: "partner_agent", island: "exuma", address: "Demo Government Dock, George Town", hours: "Sailing days" },
        { name: "Governor's Harbour Dock", kind: "partner_agent", island: "eleuthera", address: "Demo Harbour Front, Governor's Harbour", hours: "Sailing days" },
        { name: "Fresh Creek Dock", kind: "partner_agent", island: "andros", address: "Demo Dock Road, Fresh Creek", hours: "Sailing days" },
      ],
      owner: { name: "Captain Lionel Rolle", email: "lionel@islandexpress.example" },
    }).organization,
  );
  withTenant(ix.id, () => {
    const o = at(daysAgo(89), () => svc.ownerOf(ix.id));
    const dispatch = at(daysAgo(89), () => member(o, "Shawn Ferguson", "shawn@islandexpress.example", "dispatcher", "Dispatcher, Potter's Cay"));
    at(daysAgo(89), () => member(o, "Gina Cartwright", "gina@islandexpress.example", "support", "Customer service"));
    at(daysAgo(89), () => member(o, "Paul Bethel", "paul@islandexpress.example", "accounting", "Accounts"));

    const net = at(daysAgo(88), () => {
      const nas = svc.createPort(o, { code: "NAS-PCD", name: "Potter's Cay Dock, Nassau", kind: "dock", destinationId: "nassau" });
      const ggt = svc.createPort(o, { code: "GGT", name: "George Town, Exuma", kind: "dock", destinationId: "exuma" });
      const ghb = svc.createPort(o, { code: "GHB", name: "Governor's Harbour, Eleuthera", kind: "dock", destinationId: "eleuthera" });
      const fck = svc.createPort(o, { code: "FCK", name: "Fresh Creek, Andros", kind: "dock", destinationId: "andros" });
      const ixv = svc.createVessel(o, { name: "MV Island Express", kind: "mailboat", capacityLb: 60_000, registration: "BHS-MB-114" });
      const pride = svc.createVessel(o, { name: "MV Exuma Pride", kind: "cargo_vessel", capacityLb: 90_000, registration: "BHS-CV-207" });
      const runner = svc.createVessel(o, { name: "MV Andros Runner", kind: "mailboat", capacityLb: 40_000, registration: "BHS-MB-131" });
      const ele = svc.createRoute(o, { code: "NAS-ELE", mode: "ocean", portIds: [nas.id, ghb.id], transitHours: 6 });
      const exu = svc.createRoute(o, { code: "NAS-EXU", mode: "ocean", portIds: [nas.id, ggt.id], transitHours: 14 });
      const and = svc.createRoute(o, { code: "NAS-AND", mode: "ocean", portIds: [nas.id, fck.id], transitHours: 5 });
      const schedules = [
        svc.createSchedule(o, { routeId: ele.id, vesselId: ixv.id, daysOfWeek: [1, 2, 3, 4, 5, 6], departureTime: "07:00" }),
        svc.createSchedule(o, { routeId: exu.id, vesselId: pride.id, daysOfWeek: [2, 5], departureTime: "18:00" }),
        svc.createSchedule(o, { routeId: and.id, vesselId: runner.id, daysOfWeek: [3, 6], departureTime: "08:00" }),
      ];
      return { schedules };
    });
    // Trips for the last week and the next three (generated as if the schedule had been running).
    at(daysAgo(8), () => net.schedules.forEach((sc) => svc.generateTrips(o, sc.id, { days: 30 })));

    const cust = at(daysAgo(80), () => [
      svc.createCustomer(o, person("Marvin", "Seymour", "eleuthera", "+12425550401", "Seymour's Grocery")),
      svc.createCustomer(o, person("Lashan", "Knowles", "exuma", "+12425550402", "Exuma Building Supply")),
      svc.createCustomer(o, person("Patrice", "Rahming", "andros", "+12425550403")),
      svc.createCustomer(o, person("Kevin", "Johnson", "eleuthera", "+12425550404")),
    ]);

    const tripsTo = (dest: DestinationId) => svc.listTrips({ fromDaysAgo: 30, days: 30 }).filter((t) => t.destinationId === dest);
    const past = tripsTo("eleuthera").filter((t) => new Date(t.departsAt).getTime() < T0 - DAY);
    const future = (dest: DestinationId) => tripsTo(dest).filter((t) => new Date(t.departsAt).getTime() > T0);

    // A sailing that already went: booked, checked in, manifest closed, departed, arrived.
    const done = past.at(-1);
    if (done) {
      const dep = new Date(done.departsAt).getTime();
      const b = at(dep - 2 * DAY, () => svc.requestBooking(dispatch, { customerId: cust[0].id, tripId: done.id, description: "Groceries — 40 cases", pieces: 40, weightLb: 1_800 }));
      at(dep - 3 * HOUR, () => svc.checkInBooking(dispatch, b.id, { actualWeight: 1_760 }));
      at(dep, () => svc.departTrip(dispatch, done.id));
      at(new Date(done.arrivesAt).getTime(), () => svc.arriveTrip(dispatch, done.id));
    }

    // Upcoming: one checked in, a nearly full sailing, and a customer request waiting.
    const nextEle = future("eleuthera")[0];
    if (nextEle) {
      const b = at(daysAgo(2), () => svc.requestBooking(dispatch, { customerId: cust[0].id, tripId: nextEle.id, description: "Groceries — 25 cases", pieces: 25, weightLb: 1_100 }));
      at(daysAgo(0.2), () => svc.checkInBooking(dispatch, b.id, { actualWeight: 1_150 }));
      at(daysAgo(1.5), () => svc.requestBooking(dispatch, { customerId: cust[3].id, tripId: nextEle.id, description: "Used car (sedan)", pieces: 1, weightLb: 3_200 }));
      at(daysAgo(1), () => svc.requestBooking(svc.customerActor(cust[3]), { customerId: cust[3].id, tripId: nextEle.id, description: "Furniture — bedroom set", pieces: 6, weightLb: 900 }));
    }
    const nextExu = future("exuma")[0];
    if (nextExu) {
      at(daysAgo(3), () => svc.requestBooking(dispatch, { customerId: cust[1].id, tripId: nextExu.id, description: "Lumber and cement — 2 pallets", pieces: 2, weightLb: 82_000 }));
      at(daysAgo(0.5), () => svc.requestBooking(svc.customerActor(cust[1]), { customerId: cust[1].id, tripId: nextExu.id, description: "Roofing shingles", pieces: 12, weightLb: 2_400 }));
    }
    const nextAnd = future("andros")[0];
    if (nextAnd) at(daysAgo(1), () => svc.requestBooking(dispatch, { customerId: cust[2].id, tripId: nextAnd.id, description: "Household goods", pieces: 8, weightLb: 650 }));
  });

  /* ---------------- Swift Courier — courier ---------------- */
  const swift = at(daysAgo(45), () =>
    svc.createOrganization({
      name: "Swift Courier",
      slug: "swift-courier",
      businessType: "courier",
      branding: { primaryColor: "#ea580c", tagline: "Across Nassau today." },
      contact: { email: "dispatch@swiftcourier.example", phone: "(242) 555-0500" },
      locations: [{ name: "Swift Depot", kind: "pickup_center", island: "nassau", address: "Demo Soldier Road, Nassau", hours: "Mon–Sat 7am–7pm" }],
      owner: { name: "Tia Smith", email: "tia@swiftcourier.example" },
    }).organization,
  );
  withTenant(swift.id, () => {
    const o = svc.ownerOf(swift.id);
    const disp = at(daysAgo(44), () => member(o, "Ramon Davis", "ramon@swiftcourier.example", "dispatcher", "Dispatcher"));
    const kayla = at(daysAgo(44), () => member(o, "Kayla Moss", "kayla@swiftcourier.example", "driver", "Driver · Van 1"));
    const andre = at(daysAgo(44), () => member(o, "Andre Knowles", "andre@swiftcourier.example", "driver", "Driver · Van 2"));
    const people = at(daysAgo(40), () => [
      svc.createCustomer(o, { ...person("Zara", "Moxey", "nassau", "+12425550501"), deliveryAddress: "12 Demo Village Road, Nassau" }),
      svc.createCustomer(o, { ...person("Omar", "Bain", "nassau", "+12425550502", "Bain Pharmacy"), deliveryAddress: "Demo Mackey Street, Nassau" }),
      svc.createCustomer(o, { ...person("Lena", "Curry", "nassau", "+12425550503"), deliveryAddress: "7 Demo Cable Beach, Nassau" }),
    ]);
    const run = (customerId: ID, what: string, lb: number, driver: Actor, ref: string, finish: "deliver" | "dispatch" | "schedule") =>
      at(daysAgo(0.3), () => {
        const pkg = svc.checkInCargoPackage(disp, { customerId, description: what, actualWeight: lb, destinationId: "nassau", service: "air", reference: ref });
        const sh = svc.createShipment(disp, { customerId, packageIds: [pkg.id], deliveryMethod: "home_delivery" });
        svc.departShipment(disp, sh.id);
        svc.arriveShipment(disp, sh.id);
        const d = svc.deliveryForShipment(sh.id)!;
        svc.scheduleDelivery(disp, d.id, { date: new Date(T0).toISOString(), from: "09:00", to: "17:00", driver: driver.name, route: "Nassau East" });
        if (finish !== "schedule") svc.dispatchDelivery(driver, d.id);
        if (finish === "deliver") svc.completeDelivery(driver, d.id, { receivedBy: "Front desk" });
      });
    run(people[1].id, "Pharmacy restock — 3 boxes", 22, kayla, "SWF-1001", "deliver");
    run(people[0].id, "Documents envelope", 1, kayla, "SWF-1002", "dispatch");
    run(people[2].id, "Birthday cake (fragile)", 6, andre, "SWF-1003", "schedule");
  });
}
