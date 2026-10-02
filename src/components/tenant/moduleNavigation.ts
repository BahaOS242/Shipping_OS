import type { ModuleId } from "@/domain/modules";

export type ModuleNavigationItem = {
  href: string;
  label: string;
  icon: string;
  module?: ModuleId;
};

export const MODULE_NAVIGATION: ModuleNavigationItem[] = [
  { href: "/customers", label: "Customers", icon: "👥", module: "customers" },
  { href: "/warehouse", label: "Warehouse", icon: "🏭", module: "warehouse" },
  { href: "/customs", label: "Customs", icon: "📋" },
  { href: "/accounting", label: "Accounting", icon: "🧮", module: "billing" },
  { href: "/delivery", label: "Delivery", icon: "🚚", module: "delivery" },
  { href: "/procurement", label: "Procurement", icon: "🛒" },
  { href: "/analytics", label: "Analytics", icon: "📈", module: "analytics" },
  { href: "/admin", label: "Overview", icon: "📊" },
];
