/**
 * MODULE REGISTRY — what the platform's code supports.
 *
 * One codebase, many organizations. Each organization is entitled to a subset
 * of these modules (see Organization.modules). Everything that varies between
 * a freight forwarder, a mailboat operator and a courier is expressed as
 * module configuration, never as `if (businessType === ...)` branches.
 *
 * Module IDs are declared once here; everything else imports `ModuleId`.
 */

export const MODULE_IDS = [
  "customers",
  "quotes",
  "billing",
  "shipments",
  "warehouse",
  "customs",
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
  "procurement",
  "support",
  "assistant",
  "api",
  "analytics",
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export type ModuleCategory = "core" | "commercial" | "logistics" | "network" | "delivery" | "experience";

export type ModuleDef = {
  id: ModuleId;
  label: string;
  description: string;
  category: ModuleCategory;
  /** Modules that must be enabled for this one to work. */
  dependencies: ModuleId[];
  /** "planned" = entitlement can be granted, screens are not built yet. */
  availability: "available" | "planned";
};

const m = (id: ModuleId, category: ModuleCategory, label: string, description: string, dependencies: ModuleId[] = [], availability: ModuleDef["availability"] = "available"): ModuleDef => ({
  id,
  label,
  description,
  category,
  dependencies,
  availability,
});

export const MODULES: Record<ModuleId, ModuleDef> = {
  customers: m("customers", "core", "Customers", "Customer accounts, contacts and Customer 360."),
  support: m("support", "core", "Claims & Support", "Support tickets and claims for damaged, missing or billing problems.", ["customers"]),
  quotes: m("quotes", "commercial", "Quotes", "Rate engine estimates and saved quotes.", ["customers"]),
  billing: m("billing", "commercial", "Billing & Payments", "Bills, payments, receipts and reconciliation.", ["customers"]),
  procurement: m("procurement", "commercial", "Buy for me", "Procurement requests with landed-cost pricing.", ["customers", "billing"]),
  shipments: m("shipments", "logistics", "Shipments", "Packages, cargo and shipments moving together.", ["customers"]),
  warehouse: m("warehouse", "logistics", "Warehouse & Receiving", "Dock scan, receiving, weighing, storage and holds.", ["shipments"]),
  customs: m("customs", "logistics", "Customs", "Store receipts, customs packets and review.", ["shipments"]),
  manifest: m("manifest", "logistics", "Manifest", "What is loaded on each trip, closed before departure.", ["shipments"]),
  tracking: m("tracking", "logistics", "Tracking", "Timelines and customer notifications for every movement.", ["shipments"]),
  routes: m("routes", "network", "Routes & Ports", "Ports and the routes between islands."),
  vessels: m("vessels", "network", "Vessels", "Fleet: mailboats, cargo vessels, barges and aircraft."),
  schedules: m("schedules", "network", "Schedules & Trips", "Recurring sailings and the trips they generate.", ["routes", "vessels"]),
  capacity: m("capacity", "network", "Capacity", "Weight capacity per trip; prevents overbooking.", ["vessels", "routes"]),
  booking: m("booking", "network", "Bookings", "Customers reserve space on a trip; cargo is checked in at the dock.", ["customers", "shipments", "schedules"]),
  carrier_network: m("carrier_network", "network", "Carrier Network", "Partner carriers and interline capacity (marketplace).", ["routes"], "planned"),
  delivery: m("delivery", "delivery", "Delivery & Dispatch", "Last-mile scheduling, dispatch and proof of delivery.", ["shipments"]),
  driver_portal: m("driver_portal", "experience", "Driver Portal", "A driver's run for the day with proof-of-delivery capture.", ["delivery"]),
  customer_portal: m("customer_portal", "experience", "Customer Portal", "Customers track, ship, pay and get help online.", ["customers", "tracking"]),
  assistant: m("assistant", "experience", "AI Assistant & WhatsApp", "Customer-scoped assistant using controlled tools.", ["customer_portal"]),
  api: m("api", "experience", "API & MCP", "Programmatic access to the controlled tools."),
  analytics: m("analytics", "experience", "Analytics", "Operational and financial reporting."),
};

export const MODULE_CATEGORIES: { id: ModuleCategory; label: string }[] = [
  { id: "core", label: "Core" },
  { id: "commercial", label: "Commercial" },
  { id: "logistics", label: "Logistics" },
  { id: "network", label: "Network" },
  { id: "delivery", label: "Delivery" },
  { id: "experience", label: "Experience" },
];

export class InvalidModuleError extends Error {}

export const isModuleId = (x: unknown): x is ModuleId => typeof x === "string" && (MODULE_IDS as readonly string[]).includes(x);

/** Every module `id` needs, transitively (not including `id`). */
export function requirementsOf(id: ModuleId): ModuleId[] {
  const out = new Set<ModuleId>();
  const visit = (x: ModuleId) => {
    for (const d of MODULES[x].dependencies) {
      if (!out.has(d)) {
        out.add(d);
        visit(d);
      }
    }
  };
  visit(id);
  return [...out];
}

/** Every module that (transitively) needs `id`. Disabling `id` disables these too. */
export function dependentsOf(id: ModuleId): ModuleId[] {
  return MODULE_IDS.filter((x) => x !== id && requirementsOf(x).includes(id));
}

/**
 * The dependency resolver. Returns the smallest valid set containing `selected`
 * (dependencies added automatically), in registry order. Rejects unknown IDs.
 */
export function resolveModules(selected: readonly string[]): ModuleId[] {
  const set = new Set<ModuleId>();
  for (const id of selected) {
    if (!isModuleId(id)) throw new InvalidModuleError(`Unknown module "${id}".`);
    set.add(id);
    requirementsOf(id).forEach((d) => set.add(d));
  }
  return MODULE_IDS.filter((x) => set.has(x));
}

/** Problems with a configuration as stored (missing dependencies, unknown IDs). Empty = valid. */
export function validateModules(modules: readonly string[]): string[] {
  const problems: string[] = [];
  for (const id of modules) {
    if (!isModuleId(id)) {
      problems.push(`Unknown module "${id}".`);
      continue;
    }
    for (const d of MODULES[id].dependencies) if (!modules.includes(d)) problems.push(`${MODULES[id].label} requires ${MODULES[d].label}.`);
  }
  return problems;
}

/** Turn one module on or off, keeping the configuration valid. */
export function toggleModule(current: readonly ModuleId[], id: ModuleId, enabled: boolean): ModuleId[] {
  if (enabled) return resolveModules([...current, id]);
  const drop = new Set([id, ...dependentsOf(id)]);
  return resolveModules(current.filter((x) => !drop.has(x)));
}
