/**
 * THE STORE — one source of truth.
 *
 * All entities live in one state object. Services are the only code that
 * mutates it (via `mutate`). Screens subscribe with `useLive()` and re-read
 * through services, so every view reflects the same reality instantly.
 *
 * Storage adapter:
 *  - DEMO (browser): persisted to localStorage, synced across tabs.
 *  - Server (API routes): an in-memory copy of the seed per instance.
 *  - PRODUCTION: replace with a PostgreSQL-backed repository behind the same services.
 */
import type {
  AuditEvent,
  Bill,
  Claim,
  Conversation,
  Customer,
  Delivery,
  Destination,
  ID,
  Location,
  Notification,
  OpsException,
  Package,
  Payment,
  Procurement,
  PurchaseInvoice,
  Quote,
  Role,
  Shipment,
  StaffUser,
  SupportTicket,
  Voyage,
} from "@/domain/types";

export const SCHEMA_VERSION = 3;
const STORAGE_KEY = "thelink-os";

export type Session = { role: Role; customerId: ID; staffId: ID };

export type DbState = {
  schema: number;
  seededAt: string;
  customers: Customer[];
  staff: StaffUser[];
  destinations: Destination[];
  locations: Location[];
  voyages: Voyage[];
  packages: Package[];
  shipments: Shipment[];
  purchaseInvoices: PurchaseInvoice[];
  bills: Bill[];
  payments: Payment[];
  exceptions: OpsException[];
  deliveries: Delivery[];
  claims: Claim[];
  tickets: SupportTicket[];
  conversations: Conversation[];
  notifications: Notification[];
  events: AuditEvent[];
  procurements: Procurement[];
  quotes: Quote[];
  session: Session;
  seq: Record<string, number>;
};

type Seeder = () => DbState;
let seeder: Seeder | null = null;
/** Registered by src/data/seed.ts (avoids an import cycle). */
export function registerSeeder(fn: Seeder) {
  seeder = fn;
}

let state: DbState | null = null;
let version = 0;
const listeners = new Set<() => void>();
const isBrowser = typeof window !== "undefined";

function fresh(): DbState {
  if (!seeder) throw new Error("Seeder not registered — import '@/services' before using the store.");
  return seeder();
}

function load(): DbState {
  if (isBrowser) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DbState;
        if (parsed.schema === SCHEMA_VERSION) return parsed;
      }
    } catch {
      /* corrupted or blocked — reseed */
    }
  }
  return fresh();
}

/** Current state (lazy-initialized). */
export function db(): DbState {
  if (!state) {
    state = load();
    if (isBrowser) persist();
  }
  return state;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function flush() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = null;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode — keep in memory */
  }
}
function persist() {
  if (!isBrowser) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 120);
}
if (isBrowser) window.addEventListener("pagehide", () => saveTimer && flush());

let depth = 0;
/** Every write goes through here. Nested calls commit once. */
export function mutate<T>(fn: (s: DbState) => T): T {
  const s = db();
  depth++;
  try {
    return fn(s);
  } finally {
    depth--;
    if (depth === 0) {
      version++;
      persist();
      listeners.forEach((l) => l());
    }
  }
}

export function nextSeq(kind: string, start: number) {
  const s = db();
  s.seq[kind] = (s.seq[kind] ?? start) + 1;
  return s.seq[kind];
}

export function resetDemo() {
  state = fresh();
  version++;
  persist();
  listeners.forEach((l) => l());
}

/** Build a new state from a seeder without touching the live one (used by the seed script). */
export function withState<T>(s: DbState, fn: () => T): T {
  const prev = state;
  state = s;
  depth++;
  try {
    return fn();
  } finally {
    depth--;
    state = prev;
  }
}

/** For the useLive() hook (client). */
export function subscribeStore(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const next = JSON.parse(e.newValue) as DbState;
      if (next.schema !== SCHEMA_VERSION) return;
      state = next;
      version++;
      listeners.forEach((x) => x());
    } catch {
      /* ignore */
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

/** Snapshot for useSyncExternalStore. Initializes the store on first read. */
export function storeVersion() {
  db();
  return version;
}
