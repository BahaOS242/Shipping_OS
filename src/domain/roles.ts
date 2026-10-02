/**
 * Roles & permissions. Authentication is mocked in the demo (a role switcher),
 * but every service checks permissions through `can()` so real auth can slot in.
 *
 * A permission says what a ROLE may do. Whether the ORGANIZATION has the feature
 * at all is a separate question (module entitlement) — see services/access.ts,
 * which checks membership → module → role → ownership in that order.
 */
import type { Actor, Role } from "./types";

export type Permission =
  | "customer.self"
  | "customer.read_any"
  | "package.receive"
  | "package.edit"
  | "package.hold"
  | "shipment.create_any"
  | "shipment.move"
  | "customs.review"
  | "invoice.review"
  | "billing.read_any"
  | "billing.record_payment"
  | "billing.reconcile"
  | "billing.void"
  | "exception.manage"
  | "claim.manage"
  | "ticket.manage"
  | "delivery.manage"
  | "procurement.manage"
  | "delivery.driver"
  | "network.manage"
  | "booking.manage"
  | "manifest.manage"
  | "org.manage"
  | "analytics.read"
  | "admin.search"
  | "demo.reset";

const STAFF_BASE: Permission[] = ["customer.read_any", "exception.manage", "admin.search"];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  customer: ["customer.self"],
  warehouse: [...STAFF_BASE, "package.receive", "package.edit", "package.hold", "shipment.create_any", "shipment.move", "delivery.manage", "invoice.review", "manifest.manage"],
  customs: [...STAFF_BASE, "customs.review", "invoice.review", "package.hold"],
  accounting: [...STAFF_BASE, "billing.read_any", "billing.record_payment", "billing.reconcile", "billing.void", "invoice.review", "claim.manage"],
  support: [...STAFF_BASE, "ticket.manage", "claim.manage", "billing.read_any", "package.hold", "booking.manage"],
  dispatcher: [...STAFF_BASE, "shipment.create_any", "shipment.move", "delivery.manage", "delivery.driver", "booking.manage", "manifest.manage"],
  /** Drivers work their own run: dispatch, deliver, record failed attempts. Nothing else. */
  driver: ["delivery.driver"],
  manager: [
    ...STAFF_BASE,
    "package.receive", "package.edit", "package.hold", "shipment.create_any", "shipment.move", "customs.review", "invoice.review",
    "billing.read_any", "billing.record_payment", "billing.reconcile", "billing.void", "claim.manage", "ticket.manage",
    "delivery.manage", "delivery.driver", "procurement.manage", "network.manage", "booking.manage", "manifest.manage", "analytics.read",
  ],
  admin: [] /* all — see can() */,
  owner: [] /* all — see can() */,
};

/** Roles with every permission inside their organization. */
export const SUPER_ROLES: Role[] = ["admin", "owner"];

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
  }
}

export function can(actor: Actor, permission: Permission, owner?: { customerId?: string }) {
  if (actor.kind === "ai") return false;
  if (SUPER_ROLES.includes(actor.role)) return true;
  if (permission === "customer.self") return actor.role === "customer" && !!owner && owner.customerId === actor.customerId;
  return ROLE_PERMISSIONS[actor.role].includes(permission);
}

/**
 * The AI acts for a customer but is never trusted with their write powers:
 * it may only open help requests. No payments, holds, shipments, claims, refunds.
 */
export const AI_WRITE_PERMISSIONS: Permission[] = ["ticket.manage"];

/** Staff with the permission, or the customer who owns the record. */
export function canActOn(actor: Actor, permission: Permission, owner: { customerId?: string }) {
  if (actor.kind === "ai") return AI_WRITE_PERMISSIONS.includes(permission) && owner.customerId === actor.customerId;
  return can(actor, permission) || can(actor, "customer.self", owner);
}

export function assert(ok: boolean, message?: string): asserts ok {
  if (!ok) throw new ForbiddenError(message);
}

export const ROLE_INFO: Record<Role, { label: string; icon: string; home: string; blurb: string }> = {
  customer: { label: "Customer", icon: "🙂", home: "/dashboard", blurb: "Track, ship, pay" },
  warehouse: { label: "Warehouse", icon: "🏭", home: "/warehouse", blurb: "Receive, weigh, pack" },
  customs: { label: "Customs", icon: "📋", home: "/customs", blurb: "Review shipments" },
  accounting: { label: "Accounting", icon: "🧮", home: "/accounting", blurb: "Bills, payments" },
  support: { label: "Support", icon: "🎧", home: "/support", blurb: "Help customers" },
  dispatcher: { label: "Dispatcher", icon: "🧭", home: "/admin", blurb: "Trips, bookings, deliveries" },
  driver: { label: "Driver", icon: "🚚", home: "/driver", blurb: "Today's run" },
  manager: { label: "Manager", icon: "📊", home: "/admin", blurb: "Everything that needs attention" },
  admin: { label: "Admin", icon: "🛠️", home: "/admin", blurb: "Full access" },
  owner: { label: "Owner", icon: "👑", home: "/admin", blurb: "Full access + organization settings" },
};

/** Roles an administrator can invite during onboarding, with the names businesses use. */
export const INVITABLE_ROLES: { role: Exclude<Role, "customer">; label: string }[] = [
  { role: "owner", label: "Owner" },
  { role: "admin", label: "Admin" },
  { role: "manager", label: "Manager" },
  { role: "dispatcher", label: "Dispatcher" },
  { role: "warehouse", label: "Warehouse Staff" },
  { role: "driver", label: "Driver" },
  { role: "accounting", label: "Accountant" },
  { role: "support", label: "Customer Service" },
  { role: "customs", label: "Customs" },
];
