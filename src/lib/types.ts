/**
 * Domain model for The Link.
 *
 * These types intentionally mirror what the production schema (PostgreSQL)
 * is expected to look like. The demo fills them with mock data; production
 * swaps the repository implementation, not the types.
 */

export type ID = string;
export type ISODate = string;

/* ------------------------------------------------------------------ */
/* Places                                                              */
/* ------------------------------------------------------------------ */

export type IslandId =
  | "nassau"
  | "abaco"
  | "exuma"
  | "grand_bahama"
  | "eleuthera"
  | "andros"
  | "long_island"
  | "bimini"
  | "cat_island";

export type Island = {
  id: IslandId;
  name: string;
  /** Nassau is the main hub; other islands need an extra hop. */
  zone: "hub" | "family_island";
};

export type LocationKind = "us_warehouse" | "pickup_center" | "partner_agent";

export type Location = {
  id: ID;
  kind: LocationKind;
  name: string;
  /** Plain-language one-liner shown to customers. */
  purpose: string;
  island?: IslandId;
  addressLines: string[];
  hours: string;
  phone?: string;
  /** Demo locations are illustrative, not real operating addresses. */
  isDemo: true;
};

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

export type Customer = {
  id: ID;
  /** Customer's personal box number at the U.S. warehouse, e.g. TL10284. */
  accountNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  type: "personal" | "business";
  businessName?: string;
  homeIsland: IslandId;
  preferredPickupLocationId: ID;
  deliveryPreference: "pickup" | "home_delivery";
  createdAt: ISODate;
};

/** The U.S. address a customer types into Amazon, Walmart, etc. */
export type ShoppingAddress = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
  isDemo: true;
};

/* ------------------------------------------------------------------ */
/* Packages & shipments                                                */
/* ------------------------------------------------------------------ */

export const PACKAGE_STATUSES = [
  "incoming",
  "received",
  "preparing",
  "in_transit",
  "arrived",
  "ready",
  "delivered",
] as const;

export type PackageStatus = (typeof PACKAGE_STATUSES)[number];

export type ShippingMode = "air" | "sea";

export type PackageEvent = {
  status: PackageStatus;
  at: ISODate;
  /** Customer-friendly description of what happened. */
  note: string;
  locationId?: ID;
};

export type Package = {
  id: ID;
  customerId: ID;
  merchant: string;
  itemName: string;
  /** Pounds. */
  weight: number;
  status: PackageStatus;
  destination: IslandId;
  mode: ShippingMode;
  /** Carrier tracking from the store (UPS/FedEx/USPS/Amazon). */
  inboundTracking?: string;
  declaredValue?: number;
  shipmentId?: ID;
  /** Set when a customer asks us to put packages together. */
  consolidationId?: ID;
  currentLocationId?: ID;
  receivedAt?: ISODate;
  expectedAt?: ISODate;
  history: PackageEvent[];
  /** Internal staff notes — never shown to customers or the AI. */
  staffNotes?: string[];
  needsAttention?: string;
};

export type Shipment = {
  id: ID;
  /** Human-friendly reference, e.g. "Flight LK-204". */
  label: string;
  mode: ShippingMode;
  origin: ID;
  destination: IslandId;
  status: "loading" | "departed" | "arrived" | "cleared";
  departsAt: ISODate;
  arrivesAt: ISODate;
  packageIds: ID[];
};

/* ------------------------------------------------------------------ */
/* Money                                                               */
/* ------------------------------------------------------------------ */

export type ShippingRules = {
  currency: "USD";
  isDemo: true;
  air: { perLb: number; minimum: number; days: string };
  sea: { perLb: number; minimum: number; days: string };
  familyIsland: { perLbSurcharge: number; flatFee: number };
  handlingPerPackage: number;
  disclaimers: string[];
};

export type QuoteLine = { label: string; amount: number };

export type Quote = {
  id: ID;
  customerId?: ID;
  destination: IslandId;
  weight: number;
  mode: ShippingMode;
  packageCount: number;
  lines: QuoteLine[];
  total: number;
  transitDays: string;
  isDemo: true;
  createdAt: ISODate;
};

export type Invoice = {
  id: ID;
  customerId: ID;
  packageIds: ID[];
  total: number;
  status: "unpaid" | "paid";
  issuedAt: ISODate;
  isDemo: true;
};

/* ------------------------------------------------------------------ */
/* Conversations & support                                             */
/* ------------------------------------------------------------------ */

export type Channel = "web" | "whatsapp" | "staff";

export type ConversationAuthor = "customer" | "assistant" | "staff";

export type ConversationMessage = {
  id: ID;
  author: ConversationAuthor;
  text: string;
  at: ISODate;
  staffName?: string;
};

export type SupportTicket = {
  id: ID;
  customerId: ID;
  channel: Channel;
  subject: string;
  packageId?: ID;
  status: "open" | "waiting_on_staff" | "resolved";
  priority: "normal" | "high";
  createdAt: ISODate;
  messages: ConversationMessage[];
};

export type Notification = {
  id: ID;
  customerId: ID;
  channel: "whatsapp" | "email" | "sms";
  text: string;
  packageId?: ID;
  at: ISODate;
  read: boolean;
};
