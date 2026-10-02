/**
 * Demo sidebar — derived from the REAL Shipping OS navigation (platform/navigation
 * OPS_NAV) filtered by the scenario's enabled modules, plus the few demo-only
 * views (shipments, tracking, customer portal, AI). Same platform, different
 * configuration: that's the point the sidebar makes on its own.
 */
import type { IconName } from "@/components/demo/Icon";
import type { ModuleId } from "@/platform/modules";
import { OPS_NAV } from "@/platform/navigation";
import type { SidebarItem } from "./types";

type CatalogEntry = { key: string; icon: IconName; href?: string; label?: string; module?: ModuleId };

/** Order = sidebar order. Entries with `href` take label + module from the real app navigation. */
const CATALOG: CatalogEntry[] = [
  { key: "overview", icon: "dashboard", href: "/admin" },
  { key: "bookings", icon: "ticket", href: "/bookings" },
  { key: "trips", icon: "calendar", href: "/trips" },
  { key: "capacity", icon: "gauge", href: "/capacity" },
  { key: "shipments", icon: "box", label: "Shipments", module: "shipments" },
  { key: "warehouse", icon: "warehouse", href: "/warehouse" },
  { key: "manifest", icon: "manifest", href: "/manifest" },
  { key: "tracking", icon: "route", label: "Tracking", module: "tracking" },
  { key: "dispatch", icon: "truck", href: "/delivery" },
  { key: "driver", icon: "scooter", href: "/driver" },
  { key: "vessels", icon: "ship", href: "/vessels" },
  { key: "routes", icon: "anchor", href: "/routes" },
  { key: "customers", icon: "users", href: "/customers" },
  { key: "billing", icon: "receipt", href: "/accounting" },
  { key: "portal", icon: "globe", label: "Customer Portal", module: "customer_portal" },
  { key: "ai", icon: "spark", label: "AI Operations" },
];

export function sidebarFor(modules: readonly ModuleId[]): SidebarItem[] {
  return CATALOG.flatMap((c) => {
    const real = c.href ? OPS_NAV.find((n) => n.href === c.href) : undefined;
    const requires = real ? real.requires : c.module ? [c.module] : [];
    if (!requires.every((m) => modules.includes(m))) return [];
    return [{ key: c.key, label: real?.label ?? c.label ?? c.key, icon: c.icon, module: requires[0] }];
  });
}
