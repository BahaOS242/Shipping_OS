/**
 * SHIPPING OS — modular tenant architecture.
 *
 * The application is one codebase. Organizations enable the capabilities
 * they actually need. UI, navigation and services can use this registry
 * without creating a separate deployment for every customer.
 */

export const MODULE_IDS = [
  "customers",
  "quotes",
  "billing",
  "shipments",
  "warehouse",
  "manifest",
  "tracking",
  "delivery",
  "vessels",
  "routes",
  "schedules",
  "capacity",
  "booking",
  "carrier_network",
  "customer_portal",
  "driver_portal",
  "api",
  "analytics",
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export type OrganizationType =
  | "freight_forwarder"
  | "mailboat_operator"
  | "charter_operator"
  | "courier"
  | "warehouse"
  | "logistics_company"
  | "other";

export type TenantTheme = {
  logoUrl?: string;
  primaryColor?: string;
  accentColor?: string;
};

export type Organization = {
  id: string;
  name: string;
  slug: string;
  type: OrganizationType;
  enabledModules: ModuleId[];
  theme: TenantTheme;
  createdAt: string;
};

export const MODULE_CATALOG: Record<ModuleId, {
  label: string;
  description: string;
  category: "core" | "commercial" | "logistics" | "network" | "experience";
  dependencies?: ModuleId[];
}> = {
  customers: { label: "Customers", description: "Customer and account management.", category: "core" },
  quotes: { label: "Quotes", description: "Create and manage shipping quotes.", category: "commercial", dependencies: ["customers"] },
  billing: { label: "Billing", description: "Invoices, payments and receipts.", category: "commercial", dependencies: ["customers"] },
  shipments: { label: "Shipments", description: "Shipment and package lifecycle.", category: "logistics", dependencies: ["customers"] },
  warehouse: { label: "Warehouse", description: "Receiving, storage and warehouse operations.", category: "logistics", dependencies: ["shipments"] },
  manifest: { label: "Manifest", description: "Build and close cargo manifests.", category: "logistics", dependencies: ["shipments"] },
  tracking: { label: "Tracking", description: "Customer-facing shipment status and timeline.", category: "logistics", dependencies: ["shipments"] },
  delivery: { label: "Delivery", description: "Dispatch, delivery and proof of delivery.", category: "logistics", dependencies: ["shipments"] },
  vessels: { label: "Vessels", description: "Manage vessels and transportation assets.", category: "network" },
  routes: { label: "Routes", description: "Manage ports, islands and inter-island routes.", category: "network" },
  schedules: { label: "Schedules", description: "Publish departures and arrival schedules.", category: "network", dependencies: ["routes"] },
  capacity: { label: "Capacity", description: "Track available cargo capacity by trip.", category: "network", dependencies: ["vessels", "routes"] },
  booking: { label: "Booking", description: "Accept customer cargo bookings.", category: "experience", dependencies: ["customers", "shipments"] },
  carrier_network: { label: "Carrier Network", description: "Connect carriers, operators and capacity.", category: "network", dependencies: ["routes", "capacity"] },
  customer_portal: { label: "Customer Portal", description: "Customer self-service experience.", category: "experience", dependencies: ["customers", "tracking"] },
  driver_portal: { label: "Driver Portal", description: "Mobile delivery workflow for drivers.", category: "experience", dependencies: ["delivery"] },
  api: { label: "API Access", description: "Programmatic integrations for customers and partners.", category: "experience" },
  analytics: { label: "Analytics", description: "Operational and commercial reporting.", category: "experience" },
};

export const DEFAULT_MODULES: ModuleId[] = [
  "customers",
  "shipments",
  "tracking",
  "customer_portal",
];

export const ORGANIZATION_PRESETS: Record<OrganizationType, ModuleId[]> = {
  freight_forwarder: [
    "customers", "quotes", "billing", "shipments", "warehouse",
    "manifest", "tracking", "delivery", "customer_portal", "analytics",
  ],
  mailboat_operator: [
    "customers", "billing", "shipments", "manifest", "tracking",
    "vessels", "routes", "schedules", "capacity", "booking",
    "customer_portal", "analytics",
  ],
  charter_operator: [
    "customers", "quotes", "billing", "shipments", "manifest",
    "tracking", "vessels", "routes", "schedules", "capacity",
    "booking", "customer_portal",
  ],
  courier: [
    "customers", "quotes", "billing", "shipments", "tracking",
    "delivery", "customer_portal", "driver_portal", "analytics",
  ],
  warehouse: [
    "customers", "shipments", "warehouse", "manifest", "tracking",
    "customer_portal",
  ],
  logistics_company: MODULE_IDS.filter((id) => id !== "carrier_network"),
  other: [...DEFAULT_MODULES],
};

export function normalizeModules(modules: ModuleId[]): ModuleId[] {
  const enabled = new Set<ModuleId>();

  const add = (id: ModuleId) => {
    if (enabled.has(id)) return;
    enabled.add(id);
    for (const dependency of MODULE_CATALOG[id].dependencies ?? []) add(dependency);
  };

  modules.forEach(add);
  return MODULE_IDS.filter((id) => enabled.has(id));
}

export function hasModule(org: Pick<Organization, "enabledModules">, module: ModuleId): boolean {
  return org.enabledModules.includes(module);
}
