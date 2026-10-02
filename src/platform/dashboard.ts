/**
 * DASHBOARD WIDGETS — the operations overview is assembled from widgets.
 * Each widget declares the modules it needs; a business type (or the
 * organization itself) decides the order of emphasis. No business-type branches.
 */
import type { ModuleId } from "./modules";

export const WIDGET_IDS = [
  "search",
  "operations_stats",
  "work_queues",
  "todays_trips",
  "capacity",
  "bookings",
  "manifests",
  "todays_deliveries",
  "drivers",
  "receiving_chart",
  "exceptions",
  "billing",
  "activity",
] as const;

export type WidgetId = (typeof WIDGET_IDS)[number];

export type WidgetDef = { id: WidgetId; label: string; requires: ModuleId[] };

export const WIDGETS: Record<WidgetId, WidgetDef> = {
  search: { id: "search", label: "Search everything", requires: [] },
  operations_stats: { id: "operations_stats", label: "Shipments at a glance", requires: ["shipments"] },
  work_queues: { id: "work_queues", label: "Team work queues", requires: [] },
  todays_trips: { id: "todays_trips", label: "Today's trips", requires: ["schedules"] },
  capacity: { id: "capacity", label: "Capacity on upcoming trips", requires: ["capacity"] },
  bookings: { id: "bookings", label: "Bookings waiting", requires: ["booking"] },
  manifests: { id: "manifests", label: "Open manifests", requires: ["manifest"] },
  todays_deliveries: { id: "todays_deliveries", label: "Today's deliveries", requires: ["delivery"] },
  drivers: { id: "drivers", label: "Drivers on the road", requires: ["delivery"] },
  receiving_chart: { id: "receiving_chart", label: "Packages received per day", requires: ["warehouse"] },
  exceptions: { id: "exceptions", label: "Top of the exception list", requires: [] },
  billing: { id: "billing", label: "Money", requires: ["billing"] },
  activity: { id: "activity", label: "Live activity", requires: [] },
};

export const widgetAvailable = (id: WidgetId, modules: readonly ModuleId[]) => WIDGETS[id].requires.every((m) => modules.includes(m));
