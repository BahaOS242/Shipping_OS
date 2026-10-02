/**
 * NAVIGATION — generated from (user role) + (organization modules).
 *
 * The same table drives the sidebar AND the route guard, so a page that is not
 * in your navigation is also not reachable by typing its URL. The services
 * enforce the same rules again (services/access.ts) — the UI is never the
 * security boundary.
 */
import type { Role } from "@/domain/types";
import type { ModuleId } from "./modules";

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles: Role[];
  /** Every listed module must be enabled. */
  requires: ModuleId[];
};

const MGMT: Role[] = ["manager", "admin", "owner"];

export const OPS_NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "📊", roles: [...MGMT, "dispatcher"], requires: [] },
  { href: "/trips", label: "Trips", icon: "🗓️", roles: [...MGMT, "dispatcher", "warehouse"], requires: ["schedules"] },
  { href: "/bookings", label: "Bookings", icon: "🎟️", roles: [...MGMT, "dispatcher", "support"], requires: ["booking"] },
  { href: "/capacity", label: "Capacity", icon: "⚖️", roles: [...MGMT, "dispatcher"], requires: ["capacity"] },
  { href: "/manifest", label: "Manifest", icon: "📃", roles: [...MGMT, "dispatcher", "warehouse"], requires: ["manifest"] },
  { href: "/warehouse", label: "Warehouse", icon: "🏭", roles: ["warehouse", ...MGMT], requires: ["warehouse"] },
  { href: "/exceptions", label: "Exceptions", icon: "⚠", roles: ["warehouse", "customs", "accounting", "support", "dispatcher", ...MGMT], requires: [] },
  { href: "/customs", label: "Customs", icon: "📋", roles: ["customs", ...MGMT], requires: ["customs"] },
  { href: "/accounting", label: "Accounting", icon: "🧮", roles: ["accounting", ...MGMT], requires: ["billing"] },
  { href: "/delivery", label: "Dispatch", icon: "🚚", roles: ["warehouse", "dispatcher", ...MGMT], requires: ["delivery"] },
  { href: "/driver", label: "Driver run", icon: "🛵", roles: ["driver", "dispatcher", ...MGMT], requires: ["driver_portal"] },
  { href: "/claims", label: "Claims", icon: "🛟", roles: ["support", "warehouse", "accounting", ...MGMT], requires: ["support"] },
  { href: "/support", label: "Support", icon: "🎧", roles: ["support", ...MGMT], requires: ["support"] },
  { href: "/customers", label: "Customers", icon: "👥", roles: ["support", "accounting", "warehouse", "customs", "dispatcher", ...MGMT], requires: ["customers"] },
  { href: "/vessels", label: "Vessels", icon: "🚢", roles: [...MGMT, "dispatcher"], requires: ["vessels"] },
  { href: "/routes", label: "Routes & Ports", icon: "🧭", roles: [...MGMT, "dispatcher"], requires: ["routes"] },
  { href: "/schedules", label: "Schedules", icon: "⏱️", roles: [...MGMT, "dispatcher"], requires: ["schedules"] },
  { href: "/procurement", label: "Procurement", icon: "🛒", roles: MGMT, requires: ["procurement"] },
  { href: "/analytics", label: "Analytics", icon: "📈", roles: MGMT, requires: ["analytics"] },
  { href: "/settings", label: "Organization", icon: "⚙️", roles: ["admin", "owner"], requires: [] },
];

/** Path prefixes rendered in the operations shell. */
export const OPS_PREFIXES = OPS_NAV.map((n) => n.href);

const under = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");
const enabled = (item: { requires: ModuleId[] }, modules: readonly ModuleId[]) => item.requires.every((m) => modules.includes(m));

export function opsNavFor(role: Role, modules: readonly ModuleId[]): NavItem[] {
  return OPS_NAV.filter((n) => n.roles.includes(role) && enabled(n, modules));
}

export type PathAccess = { ok: true } | { ok: false; reason: "role" | "module"; item: NavItem; missing: ModuleId[] };

/** Route guard for operations pages. Module is checked first: a disabled feature doesn't exist for this organization. */
export function opsPathAccess(role: Role, pathname: string, modules: readonly ModuleId[]): PathAccess {
  if (pathname.startsWith("/admin/search")) return role === "customer" ? { ok: false, reason: "role", item: OPS_NAV[0], missing: [] } : { ok: true };
  const item = OPS_NAV.filter((n) => under(pathname, n.href)).sort((a, b) => b.href.length - a.href.length)[0];
  if (!item) return { ok: true };
  const missing = item.requires.filter((m) => !modules.includes(m));
  if (missing.length) return { ok: false, reason: "module", item, missing };
  if (!item.roles.includes(role)) return { ok: false, reason: "role", item, missing: [] };
  return { ok: true };
}

/* ---------------- Customer portal ---------------- */

export type CustomerNavItem = { href: string; label: string; requires: ModuleId[] };

export const CUSTOMER_NAV: CustomerNavItem[] = [
  { href: "/", label: "Home", requires: [] },
  { href: "/packages", label: "My Packages", requires: ["customer_portal", "shipments"] },
  { href: "/book", label: "Book Cargo", requires: ["customer_portal", "booking"] },
  { href: "/ship", label: "Ship Something", requires: ["customer_portal", "warehouse"] },
  { href: "/shipping-calculator", label: "Shipping Cost", requires: ["quotes"] },
  { href: "/locations", label: "Locations", requires: [] },
  { href: "/help", label: "Help", requires: [] },
];

/** Signed-in customer pages and the modules each needs. Public marketing pages are not listed. */
export const CUSTOMER_ROUTES: CustomerNavItem[] = [
  { href: "/dashboard", label: "Dashboard", requires: ["customer_portal"] },
  { href: "/packages", label: "Packages", requires: ["customer_portal", "shipments"] },
  { href: "/shipments", label: "Shipments", requires: ["customer_portal", "shipments"] },
  { href: "/book", label: "Book cargo", requires: ["customer_portal", "booking"] },
  { href: "/ship", label: "Ship", requires: ["customer_portal", "warehouse"] },
  { href: "/invoices", label: "Receipts", requires: ["customer_portal", "customs"] },
  { href: "/payments", label: "Payments", requires: ["customer_portal", "billing"] },
  { href: "/claims", label: "Claims", requires: ["customer_portal", "support"] },
  { href: "/support", label: "Support", requires: ["customer_portal", "support"] },
  { href: "/buy-for-me", label: "Buy for me", requires: ["customer_portal", "procurement"] },
  { href: "/assistant", label: "Assistant", requires: ["assistant"] },
  { href: "/whatsapp-demo", label: "WhatsApp", requires: ["assistant"] },
  { href: "/notifications", label: "Notifications", requires: ["customer_portal"] },
  { href: "/profile", label: "Profile", requires: ["customer_portal"] },
];

export const customerNavFor = (modules: readonly ModuleId[]) => CUSTOMER_NAV.filter((n) => enabled(n, modules));

/** Missing modules for a customer page (empty = allowed or not a gated page). */
export function customerPathMissing(pathname: string, modules: readonly ModuleId[]): ModuleId[] {
  const item = CUSTOMER_ROUTES.filter((n) => under(pathname, n.href)).sort((a, b) => b.href.length - a.href.length)[0];
  return item ? item.requires.filter((m) => !modules.includes(m)) : [];
}
