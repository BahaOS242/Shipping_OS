/**
 * Roles & permissions. Authentication is mocked in the demo (a role switcher),
 * but every service checks permissions through `can()` so real auth can slot in.
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
  | "analytics.read"
  | "admin.search"
  | "demo.reset";

const STAFF_BASE: Permission[] = ["customer.read_any", "exception.manage", "admin.search"];

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  customer: ["customer.self"],
  warehouse: [...STAFF_BASE, "package.receive", "package.edit", "package.hold", "shipment.create_any", "shipment.move", "delivery.manage", "invoice.review"],
  customs: [...STAFF_BASE, "customs.review", "invoice.review", "package.hold"],
  accounting: [...STAFF_BASE, "billing.read_any", "billing.record_payment", "billing.reconcile", "billing.void", "invoice.review", "claim.manage"],
  support: [...STAFF_BASE, "ticket.manage", "claim.manage", "billing.read_any", "package.hold"],
  manager: [
    ...STAFF_BASE,
    "package.receive", "package.edit", "package.hold", "shipment.create_any", "shipment.move", "customs.review", "invoice.review",
    "billing.read_any", "billing.record_payment", "billing.reconcile", "billing.void", "claim.manage", "ticket.manage",
    "delivery.manage", "procurement.manage", "analytics.read",
  ],
  admin: [] /* all — see can() */,
};

export class ForbiddenError extends Error {
  constructor(message = "You don't have permission to do that.") {
    super(message);
  }
}

export function can(actor: Actor, permission: Permission, owner?: { customerId?: string }) {
  if (actor.kind === "ai") return false;
  if (actor.role === "admin") return true;
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
  manager: { label: "Manager", icon: "📊", home: "/admin", blurb: "Everything that needs attention" },
  admin: { label: "Admin", icon: "🛠️", home: "/admin", blurb: "Full access" },
};

/** Which operations areas each role sees in navigation. */
export const OPS_NAV: { href: string; label: string; icon: string; roles: Role[] }[] = [
  { href: "/admin", label: "Overview", icon: "📊", roles: ["manager", "admin"] },
  { href: "/warehouse", label: "Warehouse", icon: "🏭", roles: ["warehouse", "manager", "admin"] },
  { href: "/exceptions", label: "Exceptions", icon: "⚠", roles: ["warehouse", "customs", "accounting", "support", "manager", "admin"] },
  { href: "/customs", label: "Customs", icon: "📋", roles: ["customs", "manager", "admin"] },
  { href: "/accounting", label: "Accounting", icon: "🧮", roles: ["accounting", "manager", "admin"] },
  { href: "/delivery", label: "Delivery", icon: "🚚", roles: ["warehouse", "manager", "admin"] },
  { href: "/claims", label: "Claims", icon: "🛟", roles: ["support", "warehouse", "accounting", "manager", "admin"] },
  { href: "/support", label: "Support", icon: "🎧", roles: ["support", "manager", "admin"] },
  { href: "/customers", label: "Customers", icon: "👥", roles: ["support", "accounting", "manager", "admin", "warehouse", "customs"] },
  { href: "/procurement", label: "Procurement", icon: "🛒", roles: ["manager", "admin"] },
  { href: "/analytics", label: "Analytics", icon: "📈", roles: ["manager", "admin"] },\n  { href: "/admin/modules", label: "Platform", icon: "🧩", roles: ["manager", "admin"] },
];

export function canSeeOpsPath(role: Role, pathname: string) {
  if (pathname.startsWith("/admin/search")) return role !== "customer"; // global search is for every staff role
  const item = OPS_NAV.find((n) => pathname === n.href || pathname.startsWith(n.href + "/"));
  return !item || item.roles.includes(role);
}
