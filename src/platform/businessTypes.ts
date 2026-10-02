/**
 * BUSINESS TYPES — onboarding presets. A preset is only a starting point:
 * the organization's own module list is the source of truth afterwards.
 */
import type { WidgetId } from "./dashboard";
import { MODULE_IDS, MODULES, resolveModules, type ModuleId } from "./modules";

export const BUSINESS_TYPE_IDS = ["freight_forwarder", "mailboat_operator", "charter_operator", "courier", "warehouse", "logistics_company", "custom"] as const;
export type BusinessType = (typeof BUSINESS_TYPE_IDS)[number];

export type BusinessTypeDef = {
  id: BusinessType;
  label: string;
  icon: string;
  blurb: string;
  /** Preset modules (dependencies are resolved on top). */
  modules: ModuleId[];
  /** Dashboard emphasis, most important first. Widgets whose modules are off are skipped. */
  dashboard: WidgetId[];
};

const ALL_AVAILABLE = MODULE_IDS.filter((m) => MODULES[m].availability === "available");

export const BUSINESS_TYPES: Record<BusinessType, BusinessTypeDef> = {
  freight_forwarder: {
    id: "freight_forwarder",
    label: "Freight Forwarder",
    icon: "📦",
    blurb: "U.S. address, warehouse receiving, consolidation, customs and island delivery.",
    modules: ["customers", "quotes", "billing", "shipments", "warehouse", "customs", "manifest", "tracking", "delivery", "support", "customer_portal", "analytics"],
    dashboard: ["search", "operations_stats", "work_queues", "receiving_chart", "manifests", "exceptions", "billing", "activity"],
  },
  mailboat_operator: {
    id: "mailboat_operator",
    label: "Mailboat / Vessel Operator",
    icon: "🚢",
    blurb: "Scheduled sailings between islands: bookings, capacity, manifests and cargo.",
    modules: ["customers", "billing", "shipments", "manifest", "tracking", "vessels", "routes", "schedules", "capacity", "booking", "customer_portal", "analytics"],
    dashboard: ["todays_trips", "capacity", "bookings", "manifests", "search", "exceptions", "activity"],
  },
  charter_operator: {
    id: "charter_operator",
    label: "Charter Operator",
    icon: "⛴️",
    blurb: "On-demand vessel or aircraft charters with quotes and bookings.",
    modules: ["customers", "quotes", "billing", "shipments", "manifest", "tracking", "vessels", "routes", "schedules", "capacity", "booking", "customer_portal"],
    dashboard: ["todays_trips", "bookings", "capacity", "manifests", "billing", "activity"],
  },
  courier: {
    id: "courier",
    label: "Courier",
    icon: "🛵",
    blurb: "Same-day and local delivery with dispatch, drivers and proof of delivery.",
    modules: ["customers", "quotes", "billing", "shipments", "tracking", "delivery", "driver_portal", "customer_portal", "analytics"],
    dashboard: ["todays_deliveries", "drivers", "search", "exceptions", "billing", "activity"],
  },
  warehouse: {
    id: "warehouse",
    label: "Warehouse",
    icon: "🏭",
    blurb: "Receiving, storage and outbound manifests for customers' goods.",
    modules: ["customers", "shipments", "warehouse", "manifest", "tracking", "customer_portal"],
    dashboard: ["search", "operations_stats", "receiving_chart", "work_queues", "manifests", "exceptions", "activity"],
  },
  logistics_company: {
    id: "logistics_company",
    label: "Full Logistics Company",
    icon: "🌐",
    blurb: "Everything: forwarding, vessels, scheduling, delivery and portals.",
    modules: ALL_AVAILABLE,
    dashboard: ["search", "operations_stats", "todays_trips", "capacity", "work_queues", "todays_deliveries", "manifests", "exceptions", "billing", "activity"],
  },
  custom: {
    id: "custom",
    label: "Custom",
    icon: "🧩",
    blurb: "Start from the essentials and choose modules yourself.",
    modules: ["customers"],
    dashboard: ["search", "operations_stats", "work_queues", "todays_trips", "todays_deliveries", "exceptions", "activity"],
  },
};

export const isBusinessType = (x: unknown): x is BusinessType => typeof x === "string" && (BUSINESS_TYPE_IDS as readonly string[]).includes(x);

/** The resolved (dependency-complete) module set for a business type. */
export const presetModules = (t: BusinessType): ModuleId[] => resolveModules(BUSINESS_TYPES[t].modules);
