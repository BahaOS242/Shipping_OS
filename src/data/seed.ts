/**
 * DEMO DATA — fictional people, packages and money.
 *
 * Reference data (destinations, locations, voyages, customers, staff) is
 * declared here. Everything else is created by REPLAYING HISTORY through the
 * real services with a backdated clock, so invoices, shipments, bills,
 * payments, exceptions, notifications and timelines are always consistent.
 */
import type { Customer, Package, Voyage } from "@/domain/types";\nimport { ORGANIZATION_PRESETS, type Organization } from "@/domain/modules";
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