/**
 * DEMO DATA — every name, number and address here is fictional.
 *
 * This file is the only place mock records live. The MockRepository reads
 * from it; a PostgresRepository will replace it in production.
 */
import { DEMO_SHIPPING_RULES, estimateShipping } from "../pricing";
import type {
  Customer,
  Invoice,
  Location,
  Notification,
  Package,
  PackageEvent,
  PackageStatus,
  Quote,
  Shipment,
  ShoppingAddress,
  SupportTicket,
} from "../types";

export const DEMO_CUSTOMER_ID = "c_trevor";

/* ------------------------------------------------------------------ */
/* Locations                                                           */
/* ------------------------------------------------------------------ */

export const locations: Location[] = [
  {
    id: "loc_fl",
    kind: "us_warehouse",
    name: "Florida Warehouse",
    purpose: "Where stores send your packages. We check them in here.",
    addressLines: ["123 Demo Warehouse Way", "Hollywood, FL 33020"],
    hours: "Mon–Fri 8am–6pm · Sat 9am–1pm",
    isDemo: true,
  },
  {
    id: "loc_nassau",
    kind: "pickup_center",
    name: "Nassau Pickup Center",
    purpose: "Pick up your packages in Nassau.",
    island: "nassau",
    addressLines: ["10 Demo Harbour Road", "Nassau, New Providence"],
    hours: "Mon–Fri 9am–6pm · Sat 9am–2pm",
    phone: "(242) 555-0100",
    isDemo: true,
  },
  {
    id: "loc_gb",
    kind: "pickup_center",
    name: "Freeport Pickup Center",
    purpose: "Pick up your packages in Grand Bahama.",
    island: "grand_bahama",
    addressLines: ["4 Demo Mall Drive", "Freeport, Grand Bahama"],
    hours: "Mon–Fri 9am–5pm · Sat 10am–1pm",
    phone: "(242) 555-0140",
    isDemo: true,
  },
  {
    id: "loc_abaco",
    kind: "partner_agent",
    name: "Marsh Harbour Pickup Point",
    purpose: "Our partner in Abaco holds your packages for you.",
    island: "abaco",
    addressLines: ["Demo Bay Street", "Marsh Harbour, Abaco"],
    hours: "Mon–Fri 9am–5pm",
    phone: "(242) 555-0120",
    isDemo: true,
  },
  {
    id: "loc_exuma",
    kind: "partner_agent",
    name: "George Town Pickup Point",
    purpose: "Our partner in Exuma holds your packages for you.",
    island: "exuma",
    addressLines: ["Demo Queen's Highway", "George Town, Exuma"],
    hours: "Mon–Fri 9am–5pm · Sat 9am–12pm",
    phone: "(242) 555-0130",
    isDemo: true,
  },
  {
    id: "loc_eleuthera",
    kind: "partner_agent",
    name: "Governor's Harbour Pickup Point",
    purpose: "Our partner in Eleuthera holds your packages for you.",
    island: "eleuthera",
    addressLines: ["Demo Haynes Avenue", "Governor's Harbour, Eleuthera"],
    hours: "Tue–Sat 10am–4pm",
    phone: "(242) 555-0150",
    isDemo: true,
  },
];

/* ------------------------------------------------------------------ */
/* Customers                                                           */
/* ------------------------------------------------------------------ */

export const customers: Customer[] = [
  {
    id: "c_trevor",
    accountNumber: "TL10284",
    firstName: "Trevor",
    lastName: "Armstrong",
    email: "trevor@example.com",
    phone: "+12425550184",
    type: "personal",
    homeIsland: "nassau",
    preferredPickupLocationId: "loc_nassau",
    deliveryPreference: "pickup",
    createdAt: "2025-11-03T14:00:00Z",
  },
  {
    id: "c_sarah",
    accountNumber: "TL10311",
    firstName: "Sarah",
    lastName: "Knowles",
    email: "sarah@example.com",
    phone: "+12425550111",
    type: "personal",
    homeIsland: "abaco",
    preferredPickupLocationId: "loc_abaco",
    deliveryPreference: "pickup",
    createdAt: "2025-12-19T10:00:00Z",
  },
  {
    id: "c_jason",
    accountNumber: "TL10197",
    firstName: "Jason",
    lastName: "Rolle",
    email: "jason@example.com",
    phone: "+12425550197",
    type: "personal",
    homeIsland: "exuma",
    preferredPickupLocationId: "loc_exuma",
    deliveryPreference: "pickup",
    createdAt: "2025-08-02T10:00:00Z",
  },
  {
    id: "c_monique",
    accountNumber: "TL10422",
    firstName: "Monique",
    lastName: "Ferguson",
    email: "monique@example.com",
    phone: "+12425550142",
    type: "personal",
    homeIsland: "eleuthera",
    preferredPickupLocationId: "loc_eleuthera",
    deliveryPreference: "pickup",
    createdAt: "2026-02-11T10:00:00Z",
  },
  {
    id: "c_kendrick",
    accountNumber: "TL10388",
    firstName: "Kendrick",
    lastName: "Bain",
    email: "orders@example.com",
    phone: "+12425550188",
    type: "business",
    businessName: "Island Hardware Co. (demo)",
    homeIsland: "nassau",
    preferredPickupLocationId: "loc_nassau",
    deliveryPreference: "home_delivery",
    createdAt: "2025-06-20T10:00:00Z",
  },
];

export function shoppingAddressFor(c: Customer): ShoppingAddress {
  return {
    name: `${c.firstName} ${c.lastName}`,
    line1: `The Link #${c.accountNumber}`,
    line2: "123 Demo Warehouse Way",
    city: "Hollywood",
    state: "FL",
    zip: "33020",
    isDemo: true,
  };
}

/* ------------------------------------------------------------------ */
/* Packages                                                            */
/* ------------------------------------------------------------------ */

const EVENT_NOTE: Record<PackageStatus, string> = {
  incoming: "The store shipped it to our Florida warehouse.",
  received: "Checked in at our Florida warehouse.",
  preparing: "Weighed, checked and packed to travel.",
  in_transit: "Left Florida for The Bahamas.",
  arrived: "Landed in The Bahamas. Going through customs.",
  ready: "Ready for pickup.",
  delivered: "Picked up. Enjoy!",
};

/** Build a believable history up to the package's current status. */
function history(status: PackageStatus, dates: string[]): PackageEvent[] {
  const order: PackageStatus[] = ["incoming", "received", "preparing", "in_transit", "arrived", "ready", "delivered"];
  const upto = order.indexOf(status);
  return order.slice(0, upto + 1).map((s, i) => ({
    status: s,
    at: dates[i] ?? dates[dates.length - 1],
    note: EVENT_NOTE[s],
    locationId: i >= 1 && i <= 2 ? "loc_fl" : undefined,
  }));
}

export const packages: Package[] = [
  /* Trevor — the demo customer */
  {
    id: "p_1001",
    customerId: "c_trevor",
    merchant: "Amazon",
    itemName: "Wireless keyboard",
    weight: 4.2,
    status: "received",
    destination: "nassau",
    mode: "air",
    inboundTracking: "TBA000000001",
    declaredValue: 49.99,
    currentLocationId: "loc_fl",
    receivedAt: "2026-09-26T15:12:00Z",
    history: history("received", ["2026-09-24T09:00:00Z", "2026-09-26T15:12:00Z"]),
    staffNotes: ["Box in good condition."],
  },
  {
    id: "p_1002",
    customerId: "c_trevor",
    merchant: "Walmart",
    itemName: "Kitchen blender",
    weight: 3.8,
    status: "incoming",
    destination: "nassau",
    mode: "air",
    inboundTracking: "1Z000DEMO000002",
    declaredValue: 39.0,
    expectedAt: "2026-09-30T18:00:00Z",
    history: history("incoming", ["2026-09-27T11:00:00Z"]),
  },
  {
    id: "p_1003",
    customerId: "c_trevor",
    merchant: "Target",
    itemName: "Kids' sneakers",
    weight: 2.1,
    status: "received",
    destination: "nassau",
    mode: "air",
    inboundTracking: "9400000000DEMO0003",
    declaredValue: 34.99,
    currentLocationId: "loc_fl",
    receivedAt: "2026-09-27T13:40:00Z",
    history: history("received", ["2026-09-25T08:00:00Z", "2026-09-27T13:40:00Z"]),
  },
  {
    id: "p_0990",
    customerId: "c_trevor",
    merchant: "Best Buy",
    itemName: "Headphones",
    weight: 1.2,
    status: "delivered",
    destination: "nassau",
    mode: "air",
    shipmentId: "shp_201",
    receivedAt: "2026-09-08T12:00:00Z",
    history: history("delivered", [
      "2026-09-06T10:00:00Z",
      "2026-09-08T12:00:00Z",
      "2026-09-09T09:00:00Z",
      "2026-09-10T07:00:00Z",
      "2026-09-10T14:00:00Z",
      "2026-09-11T10:00:00Z",
      "2026-09-12T16:20:00Z",
    ]),
  },
  {
    id: "p_0985",
    customerId: "c_trevor",
    merchant: "Shein",
    itemName: "Beach towels (3)",
    weight: 2.6,
    status: "delivered",
    destination: "nassau",
    mode: "air",
    receivedAt: "2026-08-28T12:00:00Z",
    history: history("delivered", [
      "2026-08-25T10:00:00Z",
      "2026-08-28T12:00:00Z",
      "2026-08-29T09:00:00Z",
      "2026-08-31T07:00:00Z",
      "2026-08-31T15:00:00Z",
      "2026-09-01T10:00:00Z",
      "2026-09-03T11:05:00Z",
    ]),
  },

  /* Sarah — Abaco */
  {
    id: "p_1010",
    customerId: "c_sarah",
    merchant: "Walmart",
    itemName: "Patio chairs (set of 2)",
    weight: 18.5,
    status: "ready",
    destination: "abaco",
    mode: "sea",
    shipmentId: "shp_202",
    currentLocationId: "loc_abaco",
    receivedAt: "2026-09-11T12:00:00Z",
    history: history("ready", [
      "2026-09-09T10:00:00Z",
      "2026-09-11T12:00:00Z",
      "2026-09-12T09:00:00Z",
      "2026-09-14T07:00:00Z",
      "2026-09-20T14:00:00Z",
      "2026-09-26T10:00:00Z",
    ]),
  },
  {
    id: "p_1011",
    customerId: "c_sarah",
    merchant: "Amazon",
    itemName: "Phone case",
    weight: 0.4,
    status: "preparing",
    destination: "abaco",
    mode: "air",
    currentLocationId: "loc_fl",
    receivedAt: "2026-09-26T10:00:00Z",
    history: history("preparing", ["2026-09-24T10:00:00Z", "2026-09-26T10:00:00Z", "2026-09-27T16:00:00Z"]),
  },
  {
    id: "p_1012",
    customerId: "c_sarah",
    merchant: "Wayfair",
    itemName: "Bedside lamp",
    weight: 6.1,
    status: "in_transit",
    destination: "abaco",
    mode: "air",
    shipmentId: "shp_203",
    receivedAt: "2026-09-23T10:00:00Z",
    history: history("in_transit", [
      "2026-09-21T10:00:00Z",
      "2026-09-23T10:00:00Z",
      "2026-09-25T09:00:00Z",
      "2026-09-28T07:30:00Z",
    ]),
  },

  /* Jason — Exuma */
  {
    id: "p_1020",
    customerId: "c_jason",
    merchant: "Home Depot",
    itemName: "Cordless drill kit",
    weight: 7.4,
    status: "in_transit",
    destination: "exuma",
    mode: "air",
    shipmentId: "shp_204",
    receivedAt: "2026-09-22T10:00:00Z",
    history: history("in_transit", [
      "2026-09-19T10:00:00Z",
      "2026-09-22T10:00:00Z",
      "2026-09-24T09:00:00Z",
      "2026-09-27T07:00:00Z",
    ]),
  },
  {
    id: "p_1021",
    customerId: "c_jason",
    merchant: "Amazon",
    itemName: "Snorkel set",
    weight: 3.0,
    status: "arrived",
    destination: "exuma",
    mode: "air",
    shipmentId: "shp_206",
    receivedAt: "2026-09-19T10:00:00Z",
    needsAttention: "Customs asked for the store receipt.",
    history: history("arrived", [
      "2026-09-17T10:00:00Z",
      "2026-09-19T10:00:00Z",
      "2026-09-21T09:00:00Z",
      "2026-09-24T07:00:00Z",
      "2026-09-24T15:00:00Z",
    ]),
    staffNotes: ["Customs broker requested receipt 09/25. Customer not yet contacted."],
  },
  {
    id: "p_1022",
    customerId: "c_jason",
    merchant: "Lowe's",
    itemName: "Ceiling fan",
    weight: 14.0,
    status: "incoming",
    destination: "exuma",
    mode: "sea",
    inboundTracking: "1Z000DEMO000022",
    needsAttention: "Carrier says delivered, but we haven't scanned it in yet.",
    history: history("incoming", ["2026-09-23T10:00:00Z"]),
    staffNotes: ["Check dock 3 overflow shelf."],
  },

  /* Monique — Eleuthera */
  {
    id: "p_1030",
    customerId: "c_monique",
    merchant: "Amazon",
    itemName: "Baby monitor",
    weight: 2.8,
    status: "arrived",
    destination: "eleuthera",
    mode: "air",
    shipmentId: "shp_207",
    receivedAt: "2026-09-20T10:00:00Z",
    needsAttention: "Customs needs an invoice before release.",
    history: history("arrived", [
      "2026-09-18T10:00:00Z",
      "2026-09-20T10:00:00Z",
      "2026-09-22T09:00:00Z",
      "2026-09-25T07:00:00Z",
      "2026-09-25T16:00:00Z",
    ]),
    staffNotes: ["Customer sent screenshot on WhatsApp — not an itemised invoice."],
  },
  {
    id: "p_1031",
    customerId: "c_monique",
    merchant: "Target",
    itemName: "School uniforms",
    weight: 5.2,
    status: "received",
    destination: "eleuthera",
    mode: "air",
    currentLocationId: "loc_fl",
    receivedAt: "2026-09-27T10:00:00Z",
    history: history("received", ["2026-09-25T10:00:00Z", "2026-09-27T10:00:00Z"]),
  },
  {
    id: "p_1032",
    customerId: "c_monique",
    merchant: "Macy's",
    itemName: "Dress shoes",
    weight: 2.4,
    status: "ready",
    destination: "eleuthera",
    mode: "air",
    currentLocationId: "loc_eleuthera",
    receivedAt: "2026-09-15T10:00:00Z",
    history: history("ready", [
      "2026-09-13T10:00:00Z",
      "2026-09-15T10:00:00Z",
      "2026-09-16T09:00:00Z",
      "2026-09-18T07:00:00Z",
      "2026-09-18T15:00:00Z",
      "2026-09-22T10:00:00Z",
    ]),
  },

  /* Kendrick — business account */
  {
    id: "p_1040",
    customerId: "c_kendrick",
    merchant: "Uline",
    itemName: "Shipping boxes (bulk)",
    weight: 42.0,
    status: "preparing",
    destination: "nassau",
    mode: "sea",
    currentLocationId: "loc_fl",
    receivedAt: "2026-09-24T10:00:00Z",
    history: history("preparing", ["2026-09-22T10:00:00Z", "2026-09-24T10:00:00Z", "2026-09-26T10:00:00Z"]),
  },
  {
    id: "p_1041",
    customerId: "c_kendrick",
    merchant: "Grainger",
    itemName: "Paint sprayer",
    weight: 22.5,
    status: "in_transit",
    destination: "nassau",
    mode: "sea",
    shipmentId: "shp_205",
    receivedAt: "2026-09-18T10:00:00Z",
    history: history("in_transit", [
      "2026-09-16T10:00:00Z",
      "2026-09-18T10:00:00Z",
      "2026-09-20T09:00:00Z",
      "2026-09-23T07:00:00Z",
    ]),
  },
  {
    id: "p_1042",
    customerId: "c_kendrick",
    merchant: "Amazon",
    itemName: "Label printer",
    weight: 5.9,
    status: "received",
    destination: "nassau",
    mode: "air",
    currentLocationId: "loc_fl",
    receivedAt: "2026-09-27T09:00:00Z",
    needsAttention: "Box arrived damaged — photos taken.",
    history: history("received", ["2026-09-25T10:00:00Z", "2026-09-27T09:00:00Z"]),
    staffNotes: ["Corner crushed. Photos in intake folder. Item powers on."],
  },
  {
    id: "p_1043",
    customerId: "c_kendrick",
    merchant: "Home Depot",
    itemName: "PVC pipe bundle",
    weight: 65.0,
    status: "incoming",
    destination: "nassau",
    mode: "sea",
    inboundTracking: "DEMO-FREIGHT-0043",
    expectedAt: "2026-10-01T18:00:00Z",
    history: history("incoming", ["2026-09-26T10:00:00Z"]),
  },
];

/* ------------------------------------------------------------------ */
/* Shipments                                                           */
/* ------------------------------------------------------------------ */

export const shipments: Shipment[] = [
  {
    id: "shp_201",
    label: "Flight LK-198",
    mode: "air",
    origin: "loc_fl",
    destination: "nassau",
    status: "cleared",
    departsAt: "2026-09-10T07:00:00Z",
    arrivesAt: "2026-09-10T09:00:00Z",
    packageIds: ["p_0990"],
  },
  {
    id: "shp_202",
    label: "Boat Sea Link 12",
    mode: "sea",
    origin: "loc_fl",
    destination: "abaco",
    status: "cleared",
    departsAt: "2026-09-14T07:00:00Z",
    arrivesAt: "2026-09-20T14:00:00Z",
    packageIds: ["p_1010"],
  },
  {
    id: "shp_203",
    label: "Flight LK-214",
    mode: "air",
    origin: "loc_fl",
    destination: "abaco",
    status: "departed",
    departsAt: "2026-09-28T07:30:00Z",
    arrivesAt: "2026-09-29T11:00:00Z",
    packageIds: ["p_1012"],
  },
  {
    id: "shp_204",
    label: "Flight LK-215",
    mode: "air",
    origin: "loc_fl",
    destination: "exuma",
    status: "departed",
    departsAt: "2026-09-27T07:00:00Z",
    arrivesAt: "2026-09-29T12:00:00Z",
    packageIds: ["p_1020"],
  },
  {
    id: "shp_205",
    label: "Boat Sea Link 14",
    mode: "sea",
    origin: "loc_fl",
    destination: "nassau",
    status: "departed",
    departsAt: "2026-09-23T07:00:00Z",
    arrivesAt: "2026-10-02T14:00:00Z",
    packageIds: ["p_1041"],
  },
  {
    id: "shp_206",
    label: "Flight LK-209",
    mode: "air",
    origin: "loc_fl",
    destination: "exuma",
    status: "arrived",
    departsAt: "2026-09-24T07:00:00Z",
    arrivesAt: "2026-09-24T15:00:00Z",
    packageIds: ["p_1021"],
  },
  {
    id: "shp_207",
    label: "Flight LK-211",
    mode: "air",
    origin: "loc_fl",
    destination: "eleuthera",
    status: "arrived",
    departsAt: "2026-09-25T07:00:00Z",
    arrivesAt: "2026-09-25T16:00:00Z",
    packageIds: ["p_1030"],
  },
];

/* ------------------------------------------------------------------ */
/* Quotes, invoices                                                    */
/* ------------------------------------------------------------------ */

function seedQuote(id: string, customerId: string, destination: Quote["destination"], weight: number, mode: Quote["mode"], createdAt: string): Quote {
  const e = estimateShipping({ destination, weight, mode }, DEMO_SHIPPING_RULES);
  return { id, customerId, destination, weight, mode, packageCount: 1, lines: e.lines, total: e.total, transitDays: e.transitDays, isDemo: true, createdAt };
}

export const quotes: Quote[] = [
  seedQuote("q_501", "c_trevor", "nassau", 20, "air", "2026-09-20T10:00:00Z"),
  seedQuote("q_502", "c_sarah", "abaco", 40, "sea", "2026-09-21T10:00:00Z"),
  seedQuote("q_503", "c_kendrick", "nassau", 250, "sea", "2026-09-25T10:00:00Z"),
];

export const invoices: Invoice[] = [
  { id: "inv_7001", customerId: "c_trevor", packageIds: ["p_0990"], total: 12.5, status: "paid", issuedAt: "2026-09-10T12:00:00Z", isDemo: true },
  { id: "inv_7002", customerId: "c_sarah", packageIds: ["p_1010"], total: 45.35, status: "unpaid", issuedAt: "2026-09-26T12:00:00Z", isDemo: true },
  { id: "inv_7003", customerId: "c_monique", packageIds: ["p_1032"], total: 23.8, status: "unpaid", issuedAt: "2026-09-22T12:00:00Z", isDemo: true },
];

/* ------------------------------------------------------------------ */
/* Support conversations                                               */
/* ------------------------------------------------------------------ */

export const supportTickets: SupportTicket[] = [
  {
    id: "t_301",
    customerId: "c_monique",
    channel: "whatsapp",
    subject: "Customs needs an invoice",
    packageId: "p_1030",
    status: "waiting_on_staff",
    priority: "high",
    createdAt: "2026-09-26T09:10:00Z",
    messages: [
      { id: "m1", author: "customer", text: "Hi, why is my baby monitor still not ready?", at: "2026-09-26T09:10:00Z" },
      { id: "m2", author: "assistant", text: "It's in The Bahamas! 🏝️ Customs needs the store invoice before they can release it. Can you send it here?", at: "2026-09-26T09:10:05Z" },
      { id: "m3", author: "customer", text: "I sent a screenshot. Is that ok?", at: "2026-09-26T09:14:00Z" },
      { id: "m4", author: "assistant", text: "Thanks! I've passed this to our team so a person can check it for you.", at: "2026-09-26T09:14:04Z" },
    ],
  },
  {
    id: "t_302",
    customerId: "c_kendrick",
    channel: "web",
    subject: "Label printer box damaged",
    packageId: "p_1042",
    status: "waiting_on_staff",
    priority: "high",
    createdAt: "2026-09-27T11:00:00Z",
    messages: [
      { id: "m1", author: "customer", text: "Got a message that my printer box was damaged. Is the printer ok?", at: "2026-09-27T11:00:00Z" },
      { id: "m2", author: "assistant", text: "I'm sorry about that. Our team took photos when it arrived. I'm connecting you with a person now.", at: "2026-09-27T11:00:06Z" },
    ],
  },
  {
    id: "t_303",
    customerId: "c_sarah",
    channel: "whatsapp",
    subject: "When can I pick up my chairs?",
    packageId: "p_1010",
    status: "resolved",
    priority: "normal",
    createdAt: "2026-09-26T15:00:00Z",
    messages: [
      { id: "m1", author: "customer", text: "Are my chairs in Abaco yet?", at: "2026-09-26T15:00:00Z" },
      { id: "m2", author: "assistant", text: "Yes! ✅ Your patio chairs are ready at the Marsh Harbour Pickup Point. Open Mon–Fri 9am–5pm.", at: "2026-09-26T15:00:04Z" },
      { id: "m3", author: "customer", text: "Perfect thank you!", at: "2026-09-26T15:02:00Z" },
    ],
  },
  {
    id: "t_304",
    customerId: "c_jason",
    channel: "web",
    subject: "Is my drill on the plane?",
    packageId: "p_1020",
    status: "resolved",
    priority: "normal",
    createdAt: "2026-09-27T08:00:00Z",
    messages: [
      { id: "m1", author: "customer", text: "Is my drill on the plane?", at: "2026-09-27T08:00:00Z" },
      { id: "m2", author: "assistant", text: "Yes ✈️ Your Home Depot drill kit is coming to The Bahamas on Flight LK-215.", at: "2026-09-27T08:00:03Z" },
    ],
  },
  {
    id: "t_305",
    customerId: "c_trevor",
    channel: "web",
    subject: "Can you put my packages together?",
    status: "resolved",
    priority: "normal",
    createdAt: "2026-09-02T10:00:00Z",
    messages: [
      { id: "m1", author: "customer", text: "Can you put my packages together?", at: "2026-09-02T10:00:00Z" },
      { id: "m2", author: "assistant", text: "Yes! Open My Packages and tap “Put Them Together”. It can save you money.", at: "2026-09-02T10:00:03Z" },
    ],
  },
];

export const notifications: Notification[] = [
  { id: "n_1", customerId: "c_trevor", channel: "whatsapp", text: "📦 We have your Target package (Kids' sneakers)!", packageId: "p_1003", at: "2026-09-27T13:41:00Z", read: false },
  { id: "n_2", customerId: "c_trevor", channel: "whatsapp", text: "📦 We have your Amazon package (Wireless keyboard)!", packageId: "p_1001", at: "2026-09-26T15:13:00Z", read: false },
  { id: "n_3", customerId: "c_trevor", channel: "email", text: "🎉 Your Best Buy headphones were delivered.", packageId: "p_0990", at: "2026-09-12T16:21:00Z", read: true },
  { id: "n_4", customerId: "c_sarah", channel: "whatsapp", text: "✅ Your patio chairs are ready for pickup in Marsh Harbour.", packageId: "p_1010", at: "2026-09-26T10:01:00Z", read: true },
];

/** Warehouse-wide operations snapshot (demo numbers for the staff dashboard). */
export const operationsSnapshot = {
  packagesReceivedToday: 38,
  readyForShipment: 21,
  inTransit: 47,
  needsAttention: 4,
};
