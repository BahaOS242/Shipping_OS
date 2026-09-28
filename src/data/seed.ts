/**
 * DEMO DATA — fictional people, packages and money.
 *
 * Reference data (destinations, locations, voyages, customers, staff) is
 * declared here. Everything else is created by REPLAYING HISTORY through the
 * real services with a backdated clock, so invoices, shipments, bills,
 * payments, exceptions, notifications and timelines are always consistent.
 */
import type { Customer, Package, Voyage } from "@/domain/types";
import { destinations, locations, staff } from "./reference";
import * as svc from "@/services/api";
import { DAY, HOUR, atTime } from "./clock";
import { SCHEMA_VERSION, registerSeeder, withState, type DbState } from "./store";

/* ------------------------------------------------------------------ */
/* Reference data                                                      */
/* ------------------------------------------------------------------ */

function customers(T0: number): Customer[] {
  const since = (days: number) => new Date(T0 - days * DAY).toISOString();
  const c = (id: string, acct: string, first: string, last: string, phone: string, home: Customer["homeDestination"], pref: Customer["deliveryPreference"], svcPref: Customer["preferredService"], address: string, days: number, extra: Partial<Customer> = {}): Customer => ({
    id, accountNumber: acct, firstName: first, lastName: last, email: `${first.toLowerCase()}.${last.toLowerCase()}@example.com`, phone, type: "personal",
    homeDestination: home, deliveryAddress: address, preferredPickupLocationId: destinations.find((x) => x.id === home)!.pickupLocationIds[0],
    deliveryPreference: pref, preferredService: svcPref, createdAt: since(days), ...extra,
  });
  return [
    c("cus_trevor", "TL10284", "Trevor", "Armstrong", "+12425550184", "nassau", "pickup", "air", "14 Demo Palm Close, Nassau", 330),
    c("cus_sarah", "TL10311", "Sarah", "Knowles", "+12425550111", "abaco", "pickup", "air", "Demo Lane, Marsh Harbour, Abaco", 280),
    c("cus_jason", "TL10197", "Jason", "Rolle", "+12425550197", "exuma", "home_delivery", "air", "Demo Hill, George Town, Exuma", 420),
    c("cus_monique", "TL10422", "Monique", "Ferguson", "+12425550142", "eleuthera", "pickup", "air", "Demo Road, Governor's Harbour", 230),
    c("cus_kendrick", "TL10388", "Kendrick", "Bain", "+12425550188", "nassau", "home_delivery", "ocean", "22 Demo Industrial Park, Nassau", 460, { type: "business", businessName: "Island Hardware Co.", email: "orders@islandhardware.example" }),
    c("cus_alicia", "TL10401", "Alicia", "Pinder", "+12425550166", "nassau", "home_delivery", "air", "8 Demo Coral Way, Nassau", 150),
    c("cus_dwayne", "TL10433", "Dwayne", "Moss", "+12425550177", "grand_bahama", "pickup", "air", "Demo Avenue, Freeport", 95),
    c("cus_keisha", "TL10415", "Keisha", "Cartwright", "+12425550155", "long_island", "pickup", "air", "Demo Settlement, Clarence Town", 120),
    c("cus_marcus", "TL10455", "Marcus", "Sands", "+12425550133", "nassau", "pickup", "air", "5 Demo Street, Nassau", 6),
    c("cus_tamika", "TL10447", "Tamika", "Rahming", "+12425550122", "andros", "pickup", "ocean", "Demo Creek, Fresh Creek, Andros", 18),
    c("cus_breeze", "TL10399", "Latoya", "Smith", "+12425550199", "nassau", "home_delivery", "ocean", "Demo Bay Street, Nassau", 210, { type: "business", businessName: "Bahama Breeze Café", email: "kitchen@bahamabreeze.example" }),
    c("cus_coral", "TL10366", "Devon", "Sweeting", "+12425550144", "exuma", "home_delivery", "ocean", "Demo Beach Road, Exuma", 26, { type: "business", businessName: "Coral Cay Resort", email: "purchasing@coralcay.example" }),
  ];
}

function voyages(T0: number): Voyage[] {
  const out: Voyage[] = [];
  let n = 180;
  for (const dest of destinations) {
    for (const mode of ["air", "ocean"] as const) {
      const hub = dest.zone === "hub";
      const every = mode === "air" ? (hub ? 2 : 3) : hub ? 7 : 10;
      const transit = mode === "air" ? (hub ? 0.25 : 1) : hub ? 3 : 7;
      for (let day = -60 + (dest.name.length % every); day <= 30; day += every) {
        const dep = T0 + day * DAY + (7 - 10) * HOUR;
        n++;
        out.push({
          id: `VOY-${n}`,
          label: mode === "air" ? `Flight LK-${n} → ${dest.name}` : `Sea Link ${n} → ${dest.name}`,
          mode,
          destinationId: dest.id,
          departsAt: new Date(dep).toISOString(),
          arrivesAt: new Date(dep + transit * DAY).toISOString(),
          status: "scheduled",
        });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* History replay                                                      */
/* ------------------------------------------------------------------ */

function build(): DbState {
  const T0 = Date.now();
  const s: DbState = {
    schema: SCHEMA_VERSION,
    seededAt: new Date(T0).toISOString(),
    customers: customers(T0),
    staff,
    destinations,
    locations,
    voyages: voyages(T0),
    packages: [],
    shipments: [],
    purchaseInvoices: [],
    bills: [],
    payments: [],
    exceptions: [],
    deliveries: [],
    claims: [],
    tickets: [],
    conversations: [],
    notifications: [],
    events: [],
    procurements: [],
    quotes: [],
    session: { role: "customer", customerId: "cus_trevor", staffId: "stf_renee" },
    seq: {},
  };

  withState(s, () => {
    const at = <T,>(daysAgo: number, fn: () => T) => atTime(T0 - daysAgo * DAY, fn);
    const cust = (id: string) => s.customers.find((c) => c.id === id)!;
    const who = (id: string) => svc.customerActor(cust(id));
    const staffA = (id: string) => {
      const u = staff.find((x) => x.id === id)!;
      return svc.staffActor(u.name, u.role);
    };
    const WH = staffA("stf_marcus");
    const CU = staffA("stf_nadia");
    const AC = staffA("stf_colin");
    const SU = staffA("stf_shanice");
    const MG = staffA("stf_renee");

    let trk = 7100;
    type It = { merchant: string; item: string; w: number; dims?: [number, number, number]; carrier?: Package["carrier"]; receipt?: "customer" | "email" | "none"; currency?: "USD" | "GBP" | "CAD"; blurry?: boolean; carrierWeight?: number; service?: "air" | "ocean"; damaged?: boolean };

    const pre = (cid: string, day: number, it: It) =>
      at(day, () => {
        const p = svc.preAlert(who(cid), {
          customerId: cid,
          merchant: it.merchant,
          itemName: it.item,
          carrier: it.carrier ?? (it.merchant.startsWith("Amazon") ? "Amazon" : it.w > 60 ? "Freight" : "UPS"),
          inboundTracking: `${it.merchant.startsWith("Amazon") ? "TBA" : "1Z"}DEMO${++trk}`,
          orderNumber: `${it.merchant.slice(0, 2).toUpperCase()}-${40000 + trk}`,
          service: it.service,
          carrierWeight: it.carrierWeight ?? it.w,
          expectedAt: new Date(T0 - (day - 2) * DAY).toISOString(),
        });
        if (it.receipt !== "none") {
          const byEmail = it.receipt === "email";
          svc.uploadInvoice(byEmail ? WH : who(cid), {
            fileName: it.blurry ? `photo_${trk}_blurry.jpg` : byEmail ? `${it.merchant.replace(/\W/g, "")}-invoice-${trk}.pdf` : `${it.merchant.toLowerCase().replace(/\W/g, "")}-order-${trk}.pdf`,
            fileType: it.blurry ? "image" : byEmail ? "email" : "pdf",
            customerId: cid,
            packageId: p.id,
            merchant: it.merchant,
            itemHint: it.item,
            currency: it.currency,
            uploadedBy: byEmail ? "merchant_email" : "customer",
          });
        }
        return p;
      });
    const recv = (day: number, p: Package, it: It) =>
      at(day, () => svc.receivePackage(WH, p.id, { actualWeight: it.w, length: it.dims?.[0], width: it.dims?.[1], height: it.dims?.[2], photos: it.damaged ? 3 : 1, damaged: it.damaged, conditionNote: it.damaged ? "Corner crushed, box torn. Item inside looks intact." : undefined }).package);
    const ship = (cid: string, day: number, pkgs: Package[], method?: "pickup" | "home_delivery", service?: "air" | "ocean") =>
      at(day, () => svc.createShipment(who(cid), { customerId: cid, packageIds: pkgs.map((p) => p.id), deliveryMethod: method, service }));
    const approve = (day: number, id: string) => at(day, () => svc.approveCustoms(CU, id, "Invoices and values match (demo review)."));
    const depart = (day: number, id: string) => at(day, () => svc.departShipment(WH, id));
    const arrive = (day: number, id: string) => at(day, () => svc.arriveShipment(WH, id));
    const dlv = (id: string) => svc.deliveryForShipment(id)!;
    const schedule = (day: number, id: string, forDay: number, driver: string) =>
      at(day, () => svc.scheduleDelivery(WH, dlv(id).id, { date: new Date(T0 - forDay * DAY).toISOString(), from: "10:00", to: "14:00", driver, route: "Route A" }));
    const out = (day: number, id: string) => at(day, () => svc.dispatchDelivery(WH, dlv(id).id));
    const done = (day: number, id: string, by: string) => at(day, () => svc.completeDelivery(WH, dlv(id).id, { receivedBy: by }));
    const billOf = (shipmentId: string) => s.bills.find((b) => b.shipmentId === shipmentId)!;
    const journey = (cid: string, start: number, items: It[], o: { method?: "pickup" | "home_delivery"; service?: "air" | "ocean"; until: "delivered" | "arrived" | "departed" | "approved" | "shipped"; by?: string; driver?: string }) => {
      const pk = items.map((it) => pre(cid, start, it));
      pk.forEach((p, i) => recv(start - 2, p, items[i]));
      const sh = ship(cid, start - 2.3, pk, o.method, o.service);
      if (o.until === "shipped") return sh;
      approve(start - 2.6, sh.id);
      if (o.until === "approved") return sh;
      depart(start - 3, sh.id);
      if (o.until === "departed") return sh;
      const transit = sh.service === "air" ? 0.4 : 3;
      arrive(start - 3 - transit, sh.id);
      if (o.until === "arrived") return sh;
      if (dlv(sh.id).method === "home_delivery") {
        schedule(start - 3.2 - transit, sh.id, start - 4 - transit, o.driver ?? "Andre (Van 2)");
        out(start - 4 - transit + 0.05, sh.id);
      }
      done(start - 4 - transit + 0.2, sh.id, o.by ?? `${cust(cid).firstName} ${cust(cid).lastName}`);
      return sh;
    };
    const exFor = (type: string, packageId?: string) => s.exceptions.find((e) => e.type === type && e.packageId === packageId && svc.isOpen(e));
    const chat = (cid: string, ch: "web" | "whatsapp", day: number, lines: [("customer" | "assistant"), string, string?][]) =>
      lines.forEach(([a, t, intent], i) => at(day - i * 0.0005, () => svc.logConversation(cid, ch, a, t, undefined, intent)));

    /* Trevor — the demo customer (Nassau, pickup) */
    const tShein = journey("cus_trevor", 33, [{ merchant: "Shein", item: "Summer dresses", w: 2.6, dims: [12, 10, 3] }], { until: "delivered" });
    at(29, () => svc.recordPayment(AC, { customerId: "cus_trevor", billId: billOf(tShein.id).id, amount: billOf(tShein.id).total, method: "card", reference: "Counter card payment" }));
    const tBest = journey("cus_trevor", 24, [{ merchant: "Best Buy", item: "Noise-cancelling headphones", w: 1.9, dims: [10, 9, 5] }], { until: "delivered" });
    at(20, () => svc.demoPay(who("cus_trevor"), billOf(tBest.id).id));
    journey("cus_trevor", 12, [{ merchant: "Wayfair", item: "Bedside lamp", w: 9, dims: [14, 14, 18] }], { method: "home_delivery", until: "delivered", driver: "Kayla (Van 1)" });
    at(26, () => svc.createClaim(who("cus_trevor"), { customerId: "cus_trevor", reason: "missing_item", description: "Ordered 3 dresses, only 2 were in the bag.", packageId: tShein.packageIds[0] }));
    at(25, () => svc.updateClaim(SU, s.claims.at(-1)!.id, "resolved", "Shein confirmed a short shipment. They're sending the missing dress — we'll ship it free."));
    const tAmazon = pre("cus_trevor", 5, { merchant: "Amazon", item: "Wireless keyboard", w: 4.2 });
    recv(2, tAmazon, { merchant: "Amazon", item: "Wireless keyboard", w: 4.2, dims: [18, 8, 3] });
    const tTarget = pre("cus_trevor", 4, { merchant: "Target", item: "Kids' sneakers", w: 2.1 });
    recv(1, tTarget, { merchant: "Target", item: "Kids' sneakers", w: 2.1, dims: [13, 9, 5] });
    pre("cus_trevor", 1, { merchant: "Walmart", item: "Kitchen blender", w: 3.8, receipt: "none" });
    chat("cus_trevor", "web", 2, [["customer", "Where's my package?", "find_package"], ["assistant", "I found it! Your Amazon package (Wireless keyboard) arrived at our Florida warehouse.", "find_package"]]);

    /* Sarah — Abaco */
    const sChairs = journey("cus_sarah", 20, [{ merchant: "Walmart", item: "Patio chairs", w: 18.5, dims: [30, 24, 20], service: "ocean" }], { service: "ocean", until: "arrived" });
    at(8, () => svc.recordPayment(AC, { customerId: "cus_sarah", billId: billOf(sChairs.id).id, amount: 40, method: "cash", reference: "Partial — balance at pickup" }));
    const sLamp = pre("cus_sarah", 9, { merchant: "Wayfair", item: "Bedside lamp", w: 6.1, blurry: true });
    recv(6, sLamp, { merchant: "Wayfair", item: "Bedside lamp", w: 6.1, dims: [14, 14, 18] });
    at(5.8, () => svc.verifyInvoice(WH, s.purchaseInvoices.find((i) => i.packageId === sLamp.id)!.id, "Checked against the order email."));
    const sLampShip = ship("cus_sarah", 5.5, [sLamp]);
    approve(5, sLampShip.id);
    depart(0.8, sLampShip.id);
    const sCase = pre("cus_sarah", 8, { merchant: "Amazon", item: "Phone case", w: 0.4, receipt: "none" });
    recv(6, sCase, { merchant: "Amazon", item: "Phone case", w: 0.4, dims: [8, 5, 1] });
    chat("cus_sarah", "whatsapp", 3, [["customer", "Are my chairs in Abaco yet?", "find_package"], ["assistant", "Yes! Your patio chairs are ready at the Marsh Harbour Pickup Point.", "find_package"], ["customer", "Perfect thank you!"]]);

    /* Jason — Exuma (home delivery) */
    const jDrill = pre("cus_jason", 6, { merchant: "Home Depot", item: "Cordless drill kit", w: 7.4 });
    recv(4, jDrill, { merchant: "Home Depot", item: "Cordless drill kit", w: 7.4, dims: [16, 12, 6] });
    ship("cus_jason", 3.5, [jDrill]);
    journey("cus_jason", 9, [{ merchant: "Amazon", item: "Snorkel set", w: 3, dims: [16, 10, 6] }], { until: "arrived" });
    const jFan = pre("cus_jason", 3, { merchant: "Lowe's", item: "Ceiling fan", w: 18, carrierWeight: 18 });
    at(0.1, () => svc.dockScan(WH, { inboundTracking: jFan.inboundTracking, carrier: jFan.carrier, labelName: "Jason Rolle", labelSuite: "TL10197", merchant: "Lowe's" }));
    at(4, () => svc.createTicket(who("cus_jason"), { customerId: "cus_jason", channel: "web", subject: "Can my drill batteries fly?", message: "Will the drill batteries be a problem?", packageId: jDrill.id }));
    at(3.9, () => svc.replyTicket(SU, s.tickets.at(-1)!.id, "Customs is checking the lithium batteries. We'll confirm today whether it can fly or needs to go by boat."));
    chat("cus_jason", "web", 7, [["customer", "How much does 20 lbs cost to Exuma?", "quote"], ["assistant", "About $80.00 by air, $47.00 by boat (demo estimate).", "quote"]]);

    /* Monique — Eleuthera */
    journey("cus_monique", 32, [{ merchant: "Macy's", item: "Dress shoes", w: 2.4, dims: [14, 9, 5] }], { until: "delivered" });
    const mMonitor = pre("cus_monique", 7, { merchant: "Amazon", item: "Baby monitor", w: 2.8, receipt: "none" });
    recv(5, mMonitor, { merchant: "Amazon", item: "Baby monitor", w: 2.8, dims: [10, 8, 6] });
    ship("cus_monique", 4, [mMonitor]);
    const mUni = pre("cus_monique", 22, { merchant: "Target", item: "School uniforms", w: 5.2 });
    recv(20, mUni, { merchant: "Target", item: "School uniforms", w: 5.2, dims: [14, 12, 6] });
    at(3.5, () => svc.createTicket(who("cus_monique"), { customerId: "cus_monique", channel: "whatsapp", subject: "Customs needs an invoice", message: "Why is my baby monitor not moving?", packageId: mMonitor.id, priority: "high" }));
    chat("cus_monique", "whatsapp", 3.5, [["customer", "Why is my baby monitor not moving?", "find_package"], ["assistant", "It needs the store receipt before it can travel. I've asked our team to help.", "human"]]);
    at(3.49, () => svc.markEscalated("cus_monique", "whatsapp", s.tickets.at(-1)!.id));

    /* Kendrick — Island Hardware Co. (business, ocean, home delivery) */
    const kPast = journey("cus_kendrick", 44, [{ merchant: "Uline", item: "Shipping boxes", w: 120, dims: [48, 40, 30], receipt: "email", service: "ocean" }], { until: "delivered", by: "K. Bain (store)", driver: "Rodney (Truck 1)" });
    at(30, () => svc.recordPayment(AC, { customerId: "cus_kendrick", billId: billOf(kPast.id).id, amount: billOf(kPast.id).total, method: "bank_transfer", reference: "BT-IHC-0811" }));
    const kPvc = journey("cus_kendrick", 24, [{ merchant: "Home Depot", item: "PVC pipe bundle", w: 180, dims: [120, 12, 12], receipt: "email", service: "ocean" }], { until: "delivered", by: "K. Bain (store)", driver: "Rodney (Truck 1)" });
    at(10, () => svc.recordPayment(AC, { customerId: "cus_kendrick", billId: billOf(kPvc.id).id, amount: Math.round((billOf(kPvc.id).total - 42) * 100) / 100, method: "bank_transfer", reference: "BT-IHC-0917", settles: true }));
    const kSpray = pre("cus_kendrick", 9, { merchant: "Grainger", item: "Airless paint sprayer", w: 38, receipt: "email", service: "ocean" });
    const kAero = pre("cus_kendrick", 9, { merchant: "Grainger", item: "Aerosol spray paint", w: 14, receipt: "email", service: "ocean" });
    recv(8, kSpray, { merchant: "Grainger", item: "", w: 38, dims: [30, 20, 18] });
    recv(8, kAero, { merchant: "Grainger", item: "", w: 14, dims: [12, 10, 10] });
    const kShip = ship("cus_kendrick", 7.5, [kSpray, kAero], "home_delivery", "ocean");
    at(7.2, () => svc.resolveException(CU, exFor("PROHIBITED_ITEM", kAero.id)!.id, "Ocean only — aerosols packed to sea-freight rules (demo)."));
    approve(2.5, kShip.id);
    depart(2, kShip.id);
    const kPrinter = pre("cus_kendrick", 3, { merchant: "Amazon Business", item: "Label printer", w: 5.9, service: "air" });
    recv(1, kPrinter, { merchant: "Amazon Business", item: "Label printer", w: 5.9, dims: [16, 12, 10], damaged: true });
    at(0.8, () => svc.createClaim(who("cus_kendrick"), { customerId: "cus_kendrick", reason: "damaged", description: "Got a message that my label printer box was damaged. Is the printer ok?", packageId: kPrinter.id, photos: ["claim-photo-1"] }));
    at(0.5, () => svc.updateClaim(SU, s.claims.at(-1)!.id, "under_review", "Our warehouse is testing the printer and will send photos today."));
    const kBoxes = pre("cus_kendrick", 4, { merchant: "Uline", item: "Shipping boxes", w: 42, receipt: "email" });
    recv(3, kBoxes, { merchant: "Uline", item: "", w: 42, dims: [36, 24, 24] });
    pre("cus_kendrick", 1, { merchant: "Home Depot", item: "PVC pipe bundle", w: 150, receipt: "email", service: "ocean" });

    /* Alicia — Nassau home delivery, charged twice */
    const aShip = journey("cus_alicia", 6, [{ merchant: "Walmart", item: "School backpack", w: 1.8, dims: [18, 13, 6] }, { merchant: "Amazon", item: "USB-C charging cable", w: 0.5, dims: [8, 6, 2] }], { method: "home_delivery", until: "arrived" });
    at(2.7, () => svc.demoPay(who("cus_alicia"), billOf(aShip.id).id));
    at(2.6, () => svc.recordPayment(AC, { customerId: "cus_alicia", billId: billOf(aShip.id).id, amount: billOf(aShip.id).total, method: "card", reference: "Card terminal — batch 0921" }));
    at(1, () => svc.scheduleDelivery(WH, dlv(aShip.id).id, { date: new Date(T0).toISOString(), from: "09:00", to: "12:00", driver: "Kayla (Van 1)", route: "Route B" }));
    at(0.1, () => svc.dispatchDelivery(WH, dlv(aShip.id).id));
    chat("cus_alicia", "web", 1.5, [["customer", "I was charged twice.", "billing"], ["assistant", "I can see two payment records. I'm going to send this to our support team so they can review it.", "billing"]]);
    at(1.49, () => {
      const t = svc.createTicket(svc.aiActor("cus_alicia"), { customerId: "cus_alicia", channel: "web", subject: "Customer says they were charged twice", message: "I was charged twice.", billId: billOf(aShip.id).id, priority: "high" });
      svc.markEscalated("cus_alicia", "web", t.id);
    });

    /* Dwayne — Grand Bahama: oversized TV + an unmatched label */
    const dTv = pre("cus_dwayne", 4, { merchant: "Best Buy", item: "65-inch 4K TV", w: 48, carrier: "FedEx" });
    recv(2, dTv, { merchant: "Best Buy", item: "", w: 48, dims: [63, 38, 8] });
    at(1, () => {
      const r = svc.dockScan(WH, { inboundTracking: "TBADEMO9912", carrier: "Amazon", labelName: "D. Moss", merchant: "Amazon", itemName: "Small box", carrierWeight: 3 });
      svc.receivePackage(WH, r.package.id, { actualWeight: 3, length: 12, width: 9, height: 4, photos: 1 });
    });

    /* Keisha — Long Island: GBP receipt; weight mismatch + lithium */
    const kSh = journey("cus_keisha", 18, [{ merchant: "ASOS", item: "Linen shirt", w: 1.2, dims: [12, 10, 2], currency: "GBP" }], { until: "delivered" });
    at(13, () => svc.demoPay(who("cus_keisha"), billOf(kSh.id).id));
    const kPb = pre("cus_keisha", 3, { merchant: "Amazon", item: "Power bank", w: 1.1, carrierWeight: 1.1 });
    recv(1, kPb, { merchant: "Amazon", item: "", w: 6.4, dims: [10, 8, 6] });
    chat("cus_keisha", "whatsapp", 9, [["customer", "What's my US address again?", "address"], ["assistant", "Keisha Cartwright, The Link #TL10415, 123 Demo Warehouse Way, Hollywood, FL 33020", "address"]]);

    /* Marcus — new customer; duplicate scan */
    const mcCable = pre("cus_marcus", 5, { merchant: "Amazon", item: "USB-C charging cable", w: 0.6 });
    recv(3, mcCable, { merchant: "Amazon", item: "", w: 0.6, dims: [8, 6, 2] });
    at(0.4, () => {
      const r = svc.dockScan(WH, { inboundTracking: mcCable.inboundTracking, carrier: "Amazon", labelName: "Marcus Sands", labelSuite: "TL10455", merchant: "Amazon", itemName: "USB-C charging cable", carrierWeight: 0.6 });
      svc.receivePackage(WH, r.package.id, { actualWeight: 0.6, length: 8, width: 6, height: 2 });
    });

    /* Tamika — Andros ocean shipment running late */
    const tamShip = journey("cus_tamika", 25, [{ merchant: "Roots", item: "Fleece hoodie", w: 2, dims: [14, 12, 4], currency: "CAD", service: "ocean" }], { service: "ocean", until: "departed" });
    at(3, () => svc.createClaim(who("cus_tamika"), { customerId: "cus_tamika", reason: "delivery", description: "My shipment was due last week and it's still not here.", shipmentId: tamShip.id }));
    at(2, () => svc.createTicket(who("cus_tamika"), { customerId: "cus_tamika", channel: "whatsapp", subject: "Shipment to Andros is late", message: "Where is my hoodie? It's very late.", shipmentId: tamShip.id, priority: "urgent" }));
    at(22, () => svc.demoPay(who("cus_tamika"), billOf(tamShip.id).id));

    /* Bahama Breeze Café — procurement quote waiting for approval */
    const bPast = journey("cus_breeze", 16, [{ merchant: "Uline", item: "Shipping boxes", w: 30, dims: [24, 18, 18], receipt: "email", service: "ocean" }], { service: "ocean", method: "home_delivery", until: "delivered", driver: "Rodney (Truck 1)" });
    at(10, () => svc.recordPayment(AC, { customerId: "cus_breeze", billId: billOf(bPast.id).id, amount: billOf(bPast.id).total, method: "bank_transfer", reference: "BT-BBC-0918" }));
    at(4, () => svc.requestProcurement(who("cus_breeze"), "cus_breeze", "We need a 2-door commercial reach-in refrigerator for the kitchen."));
    at(2, () =>
      svc.quoteProcurement(MG, s.procurements.at(-1)!.id, {
        supplier: "WebstaurantStore",
        product: "Commercial reach-in refrigerator, 2-door",
        costs: { purchasePrice: 2150, supplierShipping: 180, salesTax: 0, freight: 420, customsDuty: 537.5, storage: 0, delivery: 85 },
      }),
    );

    /* Coral Cay Resort — procurement in progress, failed delivery, stray payment */
    at(8, () => svc.requestProcurement(who("cus_coral"), "cus_coral", "12 outdoor lounge chairs for the pool deck.", 12));
    const cp = s.procurements.at(-1)!;
    at(7, () => svc.quoteProcurement(MG, cp.id, { supplier: "Frontgate", product: "Teak outdoor lounge chair ×12", costs: { purchasePrice: 3840, supplierShipping: 250, salesTax: 0, freight: 690, customsDuty: 960, storage: 0, delivery: 120 } }));
    at(6, () => svc.approveProcurement(who("cus_coral"), cp.id));
    at(5, () => svc.markPurchased(MG, cp.id));
    const cShip = journey("cus_coral", 12, [{ merchant: "Walmart", item: "Patio chairs", w: 18.5, dims: [30, 24, 20], service: "ocean" }], { service: "ocean", method: "home_delivery", until: "arrived" });
    at(5.9, () => svc.scheduleDelivery(WH, dlv(cShip.id).id, { date: new Date(T0 - 5 * DAY).toISOString(), from: "10:00", to: "13:00", driver: "Partner courier — Exuma" }));
    at(5, () => svc.dispatchDelivery(WH, dlv(cShip.id).id));
    at(4.8, () => svc.failDelivery(WH, dlv(cShip.id).id, "Gate locked — address not found"));
    at(4, () => svc.recordPayment(AC, { customerId: "cus_coral", amount: 250, method: "bank_transfer", reference: "CORAL CAY SEPT" }));
    at(3, () => svc.createClaim(who("cus_coral"), { customerId: "cus_coral", reason: "billing", description: "We were billed delivery for a delivery that didn't happen.", billId: billOf(cShip.id).id }));
    at(2.5, () => svc.updateClaim(AC, s.claims.at(-1)!.id, "waiting_for_customer", "Can you confirm the gate code so we can deliver? We'll waive the second delivery fee."));

    // Unassigned work so queues look real
    at(0.3, () => {
      const ex = exFor("DAMAGED_PACKAGE", kPrinter.id);
      if (ex) svc.assignException(MG, ex.id, "Marcus Pratt");
    });

    at(0, () => svc.runSystemChecks());
    // History older than two days has already been seen.
    for (const n of s.notifications) if (T0 - new Date(n.at).getTime() > 2 * DAY) n.read = true;
  });

  return s;
}

registerSeeder(build);
