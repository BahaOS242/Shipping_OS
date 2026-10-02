/**
 * INTERACTIVE DEMO — scenario contract.
 *
 * A scenario is pure configuration: who the prospect is, which Shipping OS
 * modules their workspace has, and an ordered list of steps. Each step points at
 * a reusable SCREEN KIND with its own simulated data. The engine and shell render
 * any scenario; adding a seventh business type is a new config file, not new UI.
 *
 * Demo data is isolated: nothing here reads or writes the application store
 * (enforced by lint). Shapes intentionally echo the real domain (shipments,
 * trips, manifests, bookings, deliveries) so scenarios can later be backed by
 * the real services.
 */
import type { BusinessType } from "@/platform/businessTypes";
import type { ModuleId } from "@/platform/modules";
import type { IconName } from "@/components/demo/Icon";

export type Tone = "neutral" | "info" | "good" | "warn" | "bad";

/* ---------------- Shared building blocks ---------------- */

export type Metric = { label: string; value: string; sub?: string; tone?: Tone; icon?: IconName };
export type Alert = { id: string; tone: Tone; title: string; detail: string; area: string; action: string };
export type Table = { title: string; columns: string[]; rows: { cells: string[]; tone?: Tone; status?: string }[] };
export type Kv = { label: string; value: string };

/* ---------------- Screen data, one entry per screen kind ---------------- */

export type ScreenData = {
  /** Operational dashboard: KPIs, exceptions to work, an optional board, an AI summary line. */
  dashboard: { heading: string; metrics: Metric[]; alerts: Alert[]; board?: Table; aiSummary?: string };
  /** Receive inbound cargo: status flips Expected → Received, packages check in one by one. */
  receive: {
    ref: string;
    route: string;
    customer: string;
    facts: Kv[];
    packages: { id: string; description: string; weightKg: number }[];
    receiveLabel: string;
    afterReceive: string[];
  };
  /** Build a manifest: lines populate from ready cargo, then finalize (close / dispatch / clear). */
  manifest: {
    trip: { ref: string; route: string; vessel: string; departs: string; cutoff: string };
    columns: { key: string; label: string; numeric?: boolean }[];
    lines: Record<string, string>[];
    weightKey: string;
    insight: string;
    buildLabel: string;
    finalize: { label: string; done: string };
  };
  /** Tracking timeline across islands, advanced scan by scan. */
  timeline: { ref: string; customer: string; route: string[]; events: { label: string; place: string; time: string; detail: string; /** Position on `route` (index; .5 = between two places). */ at: number }[]; startAt: number };
  /** The customer's own view (portal + WhatsApp). */
  portal: {
    brand: string;
    customer: string;
    ref: string;
    status: string;
    eta: string;
    progress: { label: string; time: string; done: boolean }[];
    documents: { name: string; kind: string }[];
    whatsapp: string;
  };
  /** Simulated AI moment: a staff question, an answer built from the scenario's data, optional draft for review. */
  ai: {
    prompt: string;
    suggestions: string[];
    answer: AiBlock[];
    draft?: { label: string; title: string; lines: string[] };
    closing: string;
  };
  /** Vessel profile with a pre-departure checklist. */
  vessel: { name: string; kind: string; facts: Kv[]; checklist: string[]; readyLabel: string; trips: Table };
  /** A queue of bookings / orders; open one, then confirm it. */
  bookings: { heading: string; columns: string[]; items: QueueItem[]; confirmLabel: string };
  /** Capacity limits (weight, seats, bookings) with requests to accept or decline. */
  capacity: { trip: string; limits: { label: string; unit: string; capacity: number; used: number }[]; requests: { id: string; customer: string; detail: string; adds: number[] }[] };
  /** Assign unassigned deliveries to drivers. */
  dispatch: { drivers: { name: string; vehicle: string; area: string; load: number }[]; deliveries: { id: string; customer: string; area: string; window: string; size: string }[] };
  /** The driver's phone. */
  driver: { driver: string; vehicle: string; stops: { id: string; customer: string; address: string; window: string; note?: string }[] };
  /** Proof of delivery: recipient, signature, photo → customer notified. */
  pod: { ref: string; customer: string; address: string; items: string; notify: string };
  /** Put received packages into storage bins. */
  storage: { packages: { id: string; customer: string; description: string; size: "S" | "M" | "L" }[]; bins: { id: string; zone: string; free: number }[] };
  /** Group packages into a shipment. */
  grouping: { packages: { id: string; customer: string; description: string; weightKg: number; docs: boolean }[]; destination: string; createLabel: string; result: { ref: string; next: string } };
  /** Departure board. */
  schedule: { heading: string; trips: { id: string; vessel: string; route: string; departs: string; booked: string; cargo: string; status: "Boarding" | "Scheduled" | "Departed" | "Delayed" }[]; departLabel: string };
  /** Connected workflow across every module. */
  flow: { title: string; nodes: { id: string; label: string; icon: IconName; detail: string; metric: string }[] };
  /** Invoice built from the shipment's charges. */
  billing: { customer: string; ref: string; invoiceRef: string; lines: { description: string; amount: number }[]; vatRate: number; channel: string };
};

export type ScreenKind = keyof ScreenData;
export type ScreenConfig = { [K in ScreenKind]: { kind: K; data: ScreenData[K] } }[ScreenKind];

export type QueueItem = { id: string; title: string; cells: string[]; status: "pending" | "confirmed" | "ready"; detail: Kv[]; note?: string };

export type AiBlock =
  | { type: "text"; text: string }
  | { type: "items"; items: { tone: Tone; title: string; detail: string }[] }
  | { type: "table"; table: Table };

/* ---------------- Steps & scenarios ---------------- */

export type DemoStep = {
  id: string;
  /** Sidebar entry highlighted while on this step. */
  nav: string;
  title: string;
  /** What the prospect is looking at and why it matters. */
  description: string;
  /** The one thing to try (shown as the step's task). */
  task: string;
  /** Element (data-demo-target) to spotlight until the task is done. */
  highlight?: string;
  screen: ScreenConfig;
};

export type SidebarItem = { key: string; label: string; icon: IconName; module?: ModuleId };

export type DemoScenario = {
  id: string;
  businessType: BusinessType;
  label: string;
  icon: IconName;
  cardDescription: string;
  exampleWorkflow: string[];
  organizationName: string;
  tagline: string;
  user: { name: string; role: string };
  /** Shipping OS modules this workspace has (resolved through the real module registry). */
  enabledModules: ModuleId[];
  sidebarItems: SidebarItem[];
  steps: DemoStep[];
  completion: { headline: string; points: string[] };
};
