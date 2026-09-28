/**
 * Plain-language copy for every status in the system. Customers never see
 * internal terms; staff get precise labels. Always icon + words, never color alone.
 */
import type {
  ClaimReason,
  ClaimStatus,
  CustomsStatus,
  DeliveryStatus,
  ExceptionStatus,
  ExceptionType,
  PackageStatus,
  PurchaseInvoiceStatus,
  Severity,
  ShipmentStatus,
  Team,
} from "./types";

export type Tone = "neutral" | "good" | "moving" | "done" | "warn" | "bad";

export const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-sand-100 text-ink-soft ring-sand-200",
  good: "bg-sea-50 text-sea-800 ring-sea-200",
  moving: "bg-sun-50 text-sun-700 ring-sun-300",
  done: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warn: "bg-sun-50 text-sun-700 ring-sun-300",
  bad: "bg-coral-50 text-coral-700 ring-coral-100",
};

export type StatusCopy = { label: string; icon: string; tone: Tone };

export const PACKAGE_COPY: Record<PackageStatus, StatusCopy & { title: string; explain: string; next: string; staff: string }> = {
  incoming: { label: "Coming to us", title: "Coming to our warehouse", icon: "🚚", tone: "neutral", staff: "Expected", explain: "The store is sending it to our Florida warehouse.", next: "When it arrives we check it in and message you." },
  received: { label: "We have it!", title: "We have it!", icon: "📦", tone: "good", staff: "Received", explain: "Your package is safely at our Florida warehouse.", next: "Choose to send it now, or wait and put it together with other packages." },
  preparing: { label: "Getting ready", title: "We're getting it ready", icon: "🏷️", tone: "good", staff: "Preparing", explain: "We're packing it and preparing the paperwork to travel.", next: "It leaves on the next trip to The Bahamas." },
  in_transit: { label: "Coming to The Bahamas", title: "Coming to The Bahamas", icon: "✈️", tone: "moving", staff: "In transit", explain: "Your package is on its way across the water.", next: "When it lands it goes through the government check (customs)." },
  arrived: { label: "In The Bahamas", title: "It's in The Bahamas!", icon: "🇧🇸", tone: "moving", staff: "Arrived", explain: "It landed in The Bahamas.", next: "We'll get it ready for pickup or delivery." },
  ready: { label: "Ready for you", title: "Ready for you", icon: "✅", tone: "done", staff: "Ready", explain: "Your package is waiting for you.", next: "Pick it up, or wait for your delivery." },
  delivered: { label: "Delivered 🎉", title: "Delivered 🎉", icon: "🎉", tone: "done", staff: "Delivered", explain: "You have it. Enjoy!", next: "Nothing to do. Shop again anytime." },
};

export const SHIPMENT_COPY: Record<ShipmentStatus, StatusCopy & { customer: string }> = {
  preparing: { label: "Preparing", customer: "We're getting it ready", icon: "🏷️", tone: "good" },
  awaiting_customs: { label: "Customs review", customer: "Checking the paperwork", icon: "📋", tone: "good" },
  cleared: { label: "Cleared to depart", customer: "Ready to travel", icon: "🛫", tone: "good" },
  departed: { label: "Departed", customer: "Coming to The Bahamas", icon: "✈️", tone: "moving" },
  arrived: { label: "Arrived", customer: "It's in The Bahamas!", icon: "🇧🇸", tone: "moving" },
  out_for_delivery: { label: "Out for delivery", customer: "Out for delivery 🚚", icon: "🚚", tone: "moving" },
  ready_for_pickup: { label: "Ready for pickup", customer: "Ready for you", icon: "✅", tone: "done" },
  completed: { label: "Completed", customer: "Delivered 🎉", icon: "🎉", tone: "done" },
};

export const CUSTOMS_COPY: Record<CustomsStatus, StatusCopy> = {
  missing_documents: { label: "Missing documents", icon: "📄", tone: "bad" },
  ready_for_review: { label: "Ready for review", icon: "●", tone: "good" },
  needs_attention: { label: "Needs attention", icon: "⚠", tone: "warn" },
  approved: { label: "Approved (demo)", icon: "✓", tone: "done" },
};

export const DELIVERY_COPY: Record<DeliveryStatus, StatusCopy & { customer: string }> = {
  not_scheduled: { label: "Not scheduled", customer: "We'll schedule your delivery", icon: "○", tone: "neutral" },
  scheduled: { label: "Scheduled", customer: "Delivery scheduled", icon: "🗓️", tone: "good" },
  out_for_delivery: { label: "Out for delivery", customer: "Your package is out for delivery 🚚", icon: "🚚", tone: "moving" },
  delivered: { label: "Delivered", customer: "Delivered 🎉", icon: "✓", tone: "done" },
  failed: { label: "Failed delivery", customer: "We missed you — let's try again", icon: "⚠", tone: "bad" },
  rescheduled: { label: "Rescheduled", customer: "New delivery time set", icon: "↻", tone: "good" },
};

export const INVOICE_ENGINE_COPY: Record<PurchaseInvoiceStatus, StatusCopy & { customer: string }> = {
  processing: { label: "Reading…", customer: "Reading your receipt…", icon: "⏳", tone: "neutral" },
  needs_review: { label: "Needs review", customer: "We're checking it", icon: "⚠", tone: "warn" },
  matched: { label: "Matched", customer: "Linked to your package", icon: "🔗", tone: "good" },
  verified: { label: "Verified", customer: "All good", icon: "✓", tone: "done" },
  rejected: { label: "Rejected", customer: "We couldn't use this receipt", icon: "✕", tone: "bad" },
};

export const CLAIM_COPY: Record<ClaimStatus, StatusCopy> = {
  submitted: { label: "Submitted", icon: "📨", tone: "neutral" },
  under_review: { label: "Under review", icon: "●", tone: "good" },
  waiting_for_customer: { label: "Waiting for you", icon: "⏳", tone: "warn" },
  resolved: { label: "Resolved", icon: "✓", tone: "done" },
  rejected: { label: "Not approved", icon: "✕", tone: "bad" },
};

export const CLAIM_REASON: Record<ClaimReason, { label: string; icon: string; team: Team }> = {
  damaged: { label: "My package is damaged", icon: "💔", team: "warehouse" },
  missing_item: { label: "Something is missing from the box", icon: "🔍", team: "warehouse" },
  package_missing: { label: "My package is missing", icon: "❓", team: "support" },
  billing: { label: "A problem with my bill", icon: "💳", team: "accounting" },
  delivery: { label: "A problem with my delivery", icon: "🚚", team: "delivery" },
  other: { label: "Something else", icon: "💬", team: "support" },
};

export const EXCEPTION_STATUS_COPY: Record<ExceptionStatus, StatusCopy> = {
  open: { label: "Open", icon: "●", tone: "bad" },
  assigned: { label: "Assigned", icon: "👤", tone: "warn" },
  in_progress: { label: "In progress", icon: "◐", tone: "good" },
  resolved: { label: "Resolved", icon: "✓", tone: "done" },
  dismissed: { label: "Dismissed", icon: "⊘", tone: "neutral" },
};

export const SEVERITY_COPY: Record<Severity, StatusCopy & { rank: number }> = {
  critical: { label: "Critical", icon: "⛔", tone: "bad", rank: 4 },
  high: { label: "High", icon: "⚠", tone: "bad", rank: 3 },
  medium: { label: "Medium", icon: "▲", tone: "warn", rank: 2 },
  low: { label: "Low", icon: "▽", tone: "neutral", rank: 1 },
};

/** Catalog: default team, severity and wording for each exception type. */
export const EXCEPTION_CATALOG: Record<ExceptionType, { label: string; icon: string; team: Team; severity: Severity; customerMessage?: string }> = {
  MISSING_INVOICE: { label: "Missing invoice", icon: "🧾", team: "warehouse", severity: "medium", customerMessage: "Please upload the store receipt for this package so it can travel." },
  CUSTOMER_NOT_MATCHED: { label: "Customer not matched", icon: "❔", team: "warehouse", severity: "high" },
  WEIGHT_MISMATCH: { label: "Weight mismatch", icon: "⚖️", team: "warehouse", severity: "medium" },
  DAMAGED_PACKAGE: { label: "Damaged package", icon: "💔", team: "warehouse", severity: "high", customerMessage: "Your package arrived with a damaged box. We took photos." },
  PROHIBITED_ITEM: { label: "Possible restricted item", icon: "⛔", team: "customs", severity: "critical", customerMessage: "An item needs a check before it can travel." },
  OVERSIZED_ITEM: { label: "Oversized item", icon: "📏", team: "warehouse", severity: "medium", customerMessage: "Your package is too big to fly. It can go by boat." },
  DUPLICATE_PACKAGE: { label: "Duplicate package", icon: "⧉", team: "warehouse", severity: "medium" },
  CUSTOMER_OWES_MONEY: { label: "Customer owes money", icon: "💰", team: "accounting", severity: "medium", customerMessage: "You have a bill that's past due." },
  CUSTOMS_REVIEW_REQUIRED: { label: "Customs review required", icon: "📋", team: "customs", severity: "high", customerMessage: "Customs needs a little more information." },
  STORAGE_OVERDUE: { label: "Storage overdue", icon: "⏰", team: "warehouse", severity: "low", customerMessage: "Your package has been waiting for you." },
  SHIPMENT_DELAYED: { label: "Shipment delayed", icon: "🐢", team: "management", severity: "high", customerMessage: "Your shipment is running late. We're on it." },
  ADDRESS_PROBLEM: { label: "Address problem", icon: "📍", team: "delivery", severity: "medium", customerMessage: "We need to confirm your delivery address." },
  CUSTOMER_HOLD: { label: "Customer requested hold", icon: "✋", team: "warehouse", severity: "low" },
  PAYMENT_MISMATCH: { label: "Payment doesn't match", icon: "≠", team: "accounting", severity: "medium" },
};

export const TEAM_LABEL: Record<Team, string> = {
  warehouse: "Warehouse",
  customs: "Customs",
  accounting: "Accounting",
  support: "Support",
  delivery: "Delivery",
  management: "Management",
};

/** The six customer-facing steps on every package timeline. */
export const JOURNEY_STEPS = [
  { key: "bought", label: "Bought" },
  { key: "at_link", label: "Arrived at The Link" },
  { key: "ready", label: "Getting ready" },
  { key: "moving", label: "Coming to The Bahamas" },
  { key: "for_you", label: "Ready for you" },
  { key: "delivered", label: "Delivered" },
] as const;

const CURRENT_STEP: Record<PackageStatus, number> = { incoming: 1, received: 2, preparing: 2, in_transit: 3, arrived: 3, ready: 4, delivered: 6 };

export function journeyFor(status: PackageStatus) {
  const current = CURRENT_STEP[status];
  return JOURNEY_STEPS.map((s, i) => ({
    ...s,
    state: (i < current || (status === "ready" && i === 4) ? "done" : i === current ? "current" : "todo") as "done" | "current" | "todo",
  }));
}
