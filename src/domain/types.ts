/**
 * SHIPPING OS — domain model (one source of truth).
 *
 * Every screen, the AI assistant, WhatsApp and the API read these entities
 * through the service layer. Shapes mirror the intended PostgreSQL schema.
 * All records in the demo are fictional (DEMO DATA).
 */

import type { BusinessType } from "@/platform/businessTypes";
import type { WidgetId } from "@/platform/dashboard";
import type { ModuleId } from "@/platform/modules";

export type ID = string;
export type ISODate = string;

/* ------------------------------------------------------------------ */
/* Organizations (tenants)                                             */
/* ------------------------------------------------------------------ */

/**
 * Every organization-owned record carries its tenant. Data is also partitioned
 * per organization in the store (production: `organization_id` column + RLS).
 */
export type TenantOwned = { organizationId: ID };

export type Organization = {
  id: ID;
  /** URL-safe, unique: lowercase letters, digits, dashes. */
  slug: string;
  name: string;
  businessType: BusinessType;
  status: "active" | "suspended";
  /** Entitlements — always dependency-complete (see resolveModules). */
  modules: ModuleId[];
  branding: { primaryColor: string; logoText: string; logoUrl?: string; tagline?: string };
  contact: { email?: string; phone?: string; address?: string };
  /** Optional dashboard override; defaults to the business type's emphasis. */
  dashboard?: WidgetId[];
  /** Inbound channel identities. A WhatsApp webhook is routed by the business number it was sent to. */
  channels?: { whatsappPhoneNumberId?: string };
  createdAt: ISODate;
};

/* ------------------------------------------------------------------ */
/* Places & routes                                                     */
/* ------------------------------------------------------------------ */

export type DestinationId =
  | "nassau"
  | "abaco"
  | "exuma"
  | "grand_bahama"
  | "eleuthera"
  | "andros"
  | "long_island"
  | "bimini"
  | "cat_island";

export type Zone = "hub" | "family_island";
export type ServiceLevel = "air" | "ocean";

/** Everything location-specific lives here, not in components. */
export type Destination = TenantOwned & {
  id: DestinationId;
  name: string;
  zone: Zone;
  /** Grouping used for the customer's "Where is it going?" buttons. */
  group: "nassau" | "abaco" | "exuma" | "family_islands";
  services: ServiceLevel[];
  homeDelivery: boolean;
  homeDeliveryFee: number;
  pickupLocationIds: ID[];
  schedule: Partial<Record<ServiceLevel, string>>;
};

export type LocationKind = "us_warehouse" | "pickup_center" | "partner_agent";

export type Location = TenantOwned & {
  id: ID;
  kind: LocationKind;
  name: string;
  purpose: string;
  destinationId?: DestinationId;
  addressLines: string[];
  hours: string;
  phone?: string;
};

/**
 * A TRIP — one flight or sailing that carries shipments. (Historically called
 * Voyage; `Trip` is the same entity.) Trips generated from a schedule carry the
 * route and vessel; ad-hoc trips may not.
 */
export type Voyage = TenantOwned & {
  id: ID;
  label: string;
  mode: ServiceLevel;
  destinationId: DestinationId;
  departsAt: ISODate;
  arrivesAt: ISODate;
  status: "scheduled" | "departed" | "arrived" | "cancelled";
  routeId?: ID;
  vesselId?: ID;
  scheduleId?: ID;
  /** Overrides the vessel's capacity for this trip (lb). */
  capacityLb?: number;
};
export type Trip = Voyage;

/** An island is the existing Destination (service area + pickup config). */
export type Island = Destination;

/* ------------------------------------------------------------------ */
/* Inter-island network                                                */
/* ------------------------------------------------------------------ */

export type Port = TenantOwned & {
  id: ID;
  /** Short code, e.g. NAS-PCD. */
  code: string;
  name: string;
  kind: "seaport" | "dock" | "airport";
  /** Island the port is on; unset for ports outside the network (e.g. Florida). */
  destinationId?: DestinationId;
};

export type Route = TenantOwned & {
  id: ID;
  code: string;
  name: string;
  mode: ServiceLevel;
  /** Ordered port calls: first = origin, last = final destination. */
  portIds: ID[];
  /** Island of the final port — what shipments and trips use. */
  destinationId: DestinationId;
  transitHours: number;
  active: boolean;
};

export type VesselKind = "mailboat" | "cargo_vessel" | "ferry" | "barge" | "aircraft";

export type Vessel = TenantOwned & {
  id: ID;
  name: string;
  kind: VesselKind;
  registration?: string;
  /** Cargo capacity in pounds. */
  capacityLb: number;
  status: "active" | "maintenance" | "retired";
};

/** A recurring sailing pattern. Trips are generated from it. */
export type Schedule = TenantOwned & {
  id: ID;
  routeId: ID;
  vesselId: ID;
  /** 0 = Sunday … 6 = Saturday. */
  daysOfWeek: number[];
  /** Local departure time, "HH:MM". */
  departureTime: string;
  active: boolean;
};

export type BookingStatus = "requested" | "confirmed" | "checked_in" | "cancelled";

/** A customer reserves space on a trip. Check-in turns it into a real shipment. */
export type Booking = TenantOwned & {
  id: ID;
  customerId: ID;
  tripId: ID;
  description: string;
  pieces: number;
  weightLb: number;
  status: BookingStatus;
  shipmentId?: ID;
  createdAt: ISODate;
  createdBy: "customer" | "staff";
};

/** Loading list for one trip. Lines are derived from shipments on the trip. */
export type Manifest = TenantOwned & {
  id: ID;
  tripId: ID;
  status: "open" | "closed";
  closedBy?: string;
  closedAt?: ISODate;
  createdAt: ISODate;
};

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

export type Role = "customer" | "warehouse" | "customs" | "accounting" | "support" | "dispatcher" | "driver" | "manager" | "admin" | "owner";
export type StaffRole = Exclude<Role, "customer">;

export type Customer = TenantOwned & {
  id: ID;
  /** Personal box number printed on labels, e.g. TL10284. */
  accountNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  type: "personal" | "business";
  businessName?: string;
  homeDestination: DestinationId;
  deliveryAddress: string;
  preferredPickupLocationId: ID;
  deliveryPreference: "pickup" | "home_delivery";
  preferredService: ServiceLevel;
  createdAt: ISODate;
};

export type StaffUser = TenantOwned & { id: ID; name: string; role: StaffRole; title: string; email?: string; status?: "active" | "invited" };

/* ------------------------------------------------------------------ */
/* Packages                                                            */
/* ------------------------------------------------------------------ */

export const PACKAGE_STATUSES = ["incoming", "received", "preparing", "in_transit", "arrived", "ready", "delivered"] as const;
export type PackageStatus = (typeof PACKAGE_STATUSES)[number];

export type HoldStatus = "none" | "customer_hold" | "staff_hold";

export type PackageStorage = {
  receivedAt?: ISODate;
  freeStorageUntil?: ISODate;
  storageStartDate?: ISODate;
  /** Storage fees already charged to the customer. */
  storageFeeCharged: number;
  holdStatus: HoldStatus;
  holdReason?: string;
  abandonedStatus: "none" | "at_risk" | "abandoned";
  collectedAt?: ISODate;
};

export type Package = TenantOwned & {
  /** Shipping OS package ID — printed as a QR code, used everywhere. e.g. TL-PKG-10482 */
  id: ID;
  /** Unset until the warehouse matches the label to a customer. */
  customerId?: ID;
  /** Name/suite as written on the shipping label. */
  labelName: string;
  labelSuite?: string;
  merchant: string;
  itemName: string;
  orderNumber?: string;
  carrier: "UPS" | "FedEx" | "USPS" | "Amazon" | "DHL" | "Freight";
  inboundTracking: string;
  /** Weight the carrier reported, used to detect mismatches. */
  carrierWeight?: number;
  status: PackageStatus;
  destinationId: DestinationId;
  service: ServiceLevel;
  /** Pounds / inches. */
  actualWeight?: number;
  length?: number;
  width?: number;
  height?: number;
  /** Snapshot of the rules engine at the last weigh. */
  dimensionalWeight?: number;
  billableWeight?: number;
  declaredValue?: number;
  purchaseInvoiceId?: ID;
  shipmentId?: ID;
  /** Physical location, e.g. warehouse bin "FL-B12". */
  bin?: string;
  photos: string[];
  condition: "good" | "damaged";
  storage: PackageStorage;
  expectedAt?: ISODate;
  /** When the carrier dropped it at our dock (starts the receiving clock). */
  dockedAt?: ISODate;
  createdAt: ISODate;
  procurementId?: ID;
};

/* ------------------------------------------------------------------ */
/* Shipments (packages traveling together) & customs                   */
/* ------------------------------------------------------------------ */

export type ShipmentStatus = "preparing" | "awaiting_customs" | "cleared" | "departed" | "arrived" | "out_for_delivery" | "ready_for_pickup" | "completed";

export type CustomsStatus = "missing_documents" | "ready_for_review" | "needs_attention" | "approved";

export type CustomsRecord = {
  status: CustomsStatus;
  flags: string[];
  reviewedBy?: string;
  reviewedAt?: ISODate;
  packetGeneratedAt?: ISODate;
  packetReviewedBy?: string;
  notes: string[];
};

export type Shipment = TenantOwned & {
  id: ID;
  customerId: ID;
  packageIds: ID[];
  destinationId: DestinationId;
  service: ServiceLevel;
  deliveryMethod: "pickup" | "home_delivery";
  status: ShipmentStatus;
  voyageId?: ID;
  customs: CustomsRecord;
  createdAt: ISODate;
  createdBy: "customer" | "staff";
  departedAt?: ISODate;
  arrivedAt?: ISODate;
  completedAt?: ISODate;
};

/* ------------------------------------------------------------------ */
/* Purchase invoices (store receipts) — the Invoice Engine             */
/* ------------------------------------------------------------------ */

export type InvoiceItem = {
  name: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  description: string;
  /** AI-suggested category. Human review required for customs use. */
  category?: string;
  /** Suggestion only — never a legal determination. */
  reviewFlag?: string;
};

export type InvoiceField = "merchant" | "invoiceNumber" | "orderNumber" | "purchaseDate" | "total" | "items" | "customer";

export type PurchaseInvoiceStatus = "processing" | "needs_review" | "matched" | "verified" | "rejected";

export type PurchaseInvoice = TenantOwned & {
  id: ID;
  merchant: string;
  invoiceNumber: string;
  orderNumber?: string;
  customerId?: ID;
  packageId?: ID;
  shipmentId?: ID;
  purchaseDate: ISODate;
  currency: "USD" | "BSD" | "CAD" | "GBP";
  subtotal: number;
  shipping: number;
  tax: number;
  discount: number;
  total: number;
  status: PurchaseInvoiceStatus;
  /** Overall extraction confidence 0–1. */
  confidence: number;
  fieldConfidence: Partial<Record<InvoiceField, number>>;
  items: InvoiceItem[];
  source: { fileName: string; fileType: "pdf" | "image" | "email"; uploadedBy: "customer" | "staff" | "merchant_email"; uploadedAt: ISODate };
  reviewNotes: string[];
  verifiedBy?: string;
};

/* ------------------------------------------------------------------ */
/* Money — bills from Shipping OS, payments, reconciliation               */
/* ------------------------------------------------------------------ */

export type ChargeKind = "shipping" | "island_delivery" | "delivery" | "storage" | "procurement" | "handling" | "customs_duty" | "other";

export type BillLine = {
  id: ID;
  kind: ChargeKind;
  description: string;
  amount: number;
  packageId?: ID;
  /** VAT applies to Shipping OS's services, not to duty collected for government. */
  taxable: boolean;
};

export type Bill = TenantOwned & {
  /** e.g. INV-2026-00142 */
  id: ID;
  customerId: ID;
  shipmentId?: ID;
  procurementId?: ID;
  lifecycle: "draft" | "issued" | "void";
  lines: BillLine[];
  subtotal: number;
  vat: number;
  total: number;
  currency: "USD";
  issuedAt?: ISODate;
  dueAt?: ISODate;
  createdAt: ISODate;
  voidReason?: string;
  /** Accounting sign-off when a difference is accepted. */
  reconciliationNote?: string;
  reconciledBy?: string;
};

export type PaymentMethod = "cash" | "card" | "bank_transfer" | "online";

export type Payment = TenantOwned & {
  id: ID;
  customerId: ID;
  /** Unset = unmatched payment waiting for accounting. */
  billId?: ID;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  receivedAt: ISODate;
  recordedBy: string;
  /** Every payment in this system is simulated. */
  demo: true;
};

/* ------------------------------------------------------------------ */
/* Exceptions                                                          */
/* ------------------------------------------------------------------ */

export type ExceptionType =
  | "MISSING_INVOICE"
  | "CUSTOMER_NOT_MATCHED"
  | "WEIGHT_MISMATCH"
  | "DAMAGED_PACKAGE"
  | "PROHIBITED_ITEM"
  | "OVERSIZED_ITEM"
  | "DUPLICATE_PACKAGE"
  | "CUSTOMER_OWES_MONEY"
  | "CUSTOMS_REVIEW_REQUIRED"
  | "STORAGE_OVERDUE"
  | "SHIPMENT_DELAYED"
  | "ADDRESS_PROBLEM"
  | "CUSTOMER_HOLD"
  | "PAYMENT_MISMATCH";

export type Severity = "low" | "medium" | "high" | "critical";
export type Team = "warehouse" | "customs" | "accounting" | "support" | "delivery" | "management";
export type ExceptionStatus = "open" | "assigned" | "in_progress" | "resolved" | "dismissed";

export type Note = { at: ISODate; by: string; text: string };

export type OpsException = TenantOwned & {
  id: ID;
  type: ExceptionType;
  severity: Severity;
  title: string;
  detail: string;
  customerId?: ID;
  packageId?: ID;
  shipmentId?: ID;
  billId?: ID;
  purchaseInvoiceId?: ID;
  createdAt: ISODate;
  team: Team;
  status: ExceptionStatus;
  assignee?: string;
  notes: Note[];
  source: "system" | "staff" | "ai";
  resolvedAt?: ISODate;
  resolution?: string;
};

/* ------------------------------------------------------------------ */
/* Delivery, claims, support                                           */
/* ------------------------------------------------------------------ */

export type DeliveryStatus = "not_scheduled" | "scheduled" | "out_for_delivery" | "delivered" | "failed" | "rescheduled";

export type ProofOfDelivery = { receivedBy: string; at: ISODate; signature: string; photo: string; gps?: string };

export type Delivery = TenantOwned & {
  id: ID;
  shipmentId: ID;
  customerId: ID;
  method: "home_delivery" | "pickup";
  status: DeliveryStatus;
  driver?: string;
  route?: string;
  address: string;
  window?: { date: ISODate; from: string; to: string };
  fee: number;
  proof?: ProofOfDelivery;
  notes: Note[];
  attempts: number;
};

export type ClaimReason = "damaged" | "missing_item" | "package_missing" | "billing" | "delivery" | "other";
export type ClaimStatus = "submitted" | "under_review" | "waiting_for_customer" | "resolved" | "rejected";

export type Claim = TenantOwned & {
  id: ID;
  customerId: ID;
  packageId?: ID;
  shipmentId?: ID;
  billId?: ID;
  reason: ClaimReason;
  description: string;
  photos: string[];
  status: ClaimStatus;
  team: Team;
  resolution?: string;
  createdAt: ISODate;
  updates: Note[];
};

export type Channel = "web" | "whatsapp" | "phone" | "email";

export type ChatMessage = { id: ID; author: "customer" | "assistant" | "staff"; text: string; at: ISODate; staffName?: string };

export type SupportTicket = TenantOwned & {
  id: ID;
  customerId: ID;
  channel: Channel;
  subject: string;
  packageId?: ID;
  shipmentId?: ID;
  billId?: ID;
  priority: "normal" | "high" | "urgent";
  status: "open" | "waiting_on_staff" | "waiting_on_customer" | "resolved";
  assignee?: string;
  createdBy: "customer" | "ai" | "staff";
  createdAt: ISODate;
  resolvedAt?: ISODate;
  messages: ChatMessage[];
};

/** Assistant / WhatsApp conversation log (one per customer per channel). */
export type Conversation = TenantOwned & {
  id: ID;
  customerId: ID;
  channel: "web" | "whatsapp";
  messages: ChatMessage[];
  intents: string[];
  escalated: boolean;
  ticketId?: ID;
  /** Channel memory between assistant turns. Lives in the tenant's conversation, never in a process-wide cache. */
  agentContext?: Record<string, unknown>;
  updatedAt: ISODate;
};

/* ------------------------------------------------------------------ */
/* Procurement                                                         */
/* ------------------------------------------------------------------ */

export type ProcurementStatus = "requested" | "quoted" | "approved" | "purchased" | "received" | "shipped" | "delivered" | "cancelled";

export type LandedCost = {
  purchasePrice: number;
  supplierShipping: number;
  salesTax: number;
  freight: number;
  customsDuty: number;
  storage: number;
  delivery: number;
};

export type Procurement = TenantOwned & {
  id: ID;
  customerId: ID;
  request: string;
  status: ProcurementStatus;
  supplier?: string;
  product?: string;
  quantity: number;
  costs?: LandedCost;
  /** Service fee on top of landed cost. */
  marginRate: number;
  packageId?: ID;
  supplierInvoiceId?: ID;
  billId?: ID;
  createdAt: ISODate;
  notes: Note[];
};

/* ------------------------------------------------------------------ */
/* Events, notifications, quotes                                       */
/* ------------------------------------------------------------------ */

export type Refs = Partial<{
  customerId: ID;
  packageId: ID;
  shipmentId: ID;
  purchaseInvoiceId: ID;
  billId: ID;
  paymentId: ID;
  exceptionId: ID;
  claimId: ID;
  ticketId: ID;
  deliveryId: ID;
  procurementId: ID;
  tripId: ID;
  bookingId: ID;
}>;

export type Actor = {
  kind: "customer" | "staff" | "ai" | "system";
  name: string;
  role: Role;
  /** The organization the actor is signed in to. System jobs use PLATFORM_ORG. */
  organizationId: ID;
  customerId?: ID;
  /** Staff user ID (membership) when known. */
  userId?: ID;
  /** Set when an AI tool acts on this user's behalf (same permissions, audited as AI). */
  via?: "ai";
};

/**
 * A consequential write an AI tool prepared but did not perform. Only the same
 * user, in the same organization, can confirm it; confirmation re-runs every
 * authorization check and then calls the real service.
 */
export type AiProposal = TenantOwned & {
  id: ID;
  tool: string;
  input: Record<string, unknown>;
  preview: { title: string; lines: string[] };
  proposedBy: { kind: Actor["kind"]; name: string; userId?: ID; customerId?: ID };
  status: "pending" | "confirmed" | "cancelled" | "expired" | "failed";
  createdAt: ISODate;
  expiresAt: ISODate;
  resolvedAt?: ISODate;
  error?: string;
};

export type AuditEvent = TenantOwned & {
  id: ID;
  type: string;
  at: ISODate;
  actor: Actor;
  refs: Refs;
  /** Staff-facing description. */
  summary: string;
  /** Plain-language line for the customer's timeline; unset = internal only. */
  customerSummary?: string;
  data?: Record<string, unknown>;
};

export type NotificationChannel = "in_app" | "whatsapp" | "email";

export type Notification = TenantOwned & {
  id: ID;
  audience: "customer" | "staff";
  customerId?: ID;
  team?: Team;
  icon: string;
  title: string;
  body: string;
  href?: string;
  at: ISODate;
  read: boolean;
  /** Simulated deliveries — nothing is really sent. */
  channels: NotificationChannel[];
  eventId?: ID;
  refs: Refs;
};

export type Quote = TenantOwned & {
  id: ID;
  customerId?: ID;
  destinationId: DestinationId;
  service: ServiceLevel;
  actualWeight: number;
  billableWeight: number;
  total: number;
  createdAt: ISODate;
};
