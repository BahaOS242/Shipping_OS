/**
 * THE STORE — one source of truth, partitioned per organization.
 *
 * Platform state holds the organizations and one data partition (TenantState)
 * per organization. `db()` returns ONLY the partition of the active tenant, so
 * every service is tenant-scoped by construction: a record that belongs to
 * another organization is simply not reachable, whatever ID is asked for.
 * (Production: one PostgreSQL schema with `organization_id` on every tenant
 * table and row-level security keyed on the request's organization — the same
 * semantics as `withTenant()`.)
 *
 * The active tenant is the innermost `withTenant()` scope (API routes, tests,
 * background jobs) or, failing that, the signed-in session's organization.
 *
 * Services are the only code that mutates state (via `mutate`). Screens
 * subscribe with `useLive()` and re-read through services.
 *
 * Storage adapter:
 *  - DEMO (browser): persisted to localStorage, synced across tabs.
 *  - Server (API routes): an in-memory copy of the seed per instance.
 *  - PRODUCTION: a PostgreSQL-backed repository behind the same services.
 */
import type {
  AuditEvent,
  Bill,
  Booking,
  Claim,
  Conversation,
  Customer,
  Delivery,
  Destination,
  ID,
  Location,
  Manifest,
  Notification,
  OpsException,
  Organization,
  Package,
  Payment,
  Port,
  Procurement,
  PurchaseInvoice,
  Quote,
  Role,
  Route,
  Schedule,
  Shipment,
  StaffUser,
  SupportTicket,
  Vessel,
  Voyage,
} from "@/domain/types";

export const SCHEMA_VERSION = 4;
const STORAGE_KEY = "thelink-os";

/** Mock authentication: who is signed in, to which organization. */
export type Session = { organizationId: ID; role: Role; customerId: ID; staffId: ID };

/** One organization's data. Every row also carries `organizationId`. */
export type TenantState = {
  organizationId: ID;
  customers: Customer[];
  staff: StaffUser[];
  destinations: Destination[];
  locations: Location[];
  voyages: Voyage[];
  ports: Port[];
  routes: Route[];
  vessels: Vessel[];
  schedules: Schedule[];
  bookings: Booking[];
  manifests: Manifest[];
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
};

/** What services see. Kept as an alias so existing code reads naturally. */
export type DbState = TenantState;

export type PlatformState = {
  schema: number;
  seededAt: string;
  organizations: Organization[];
  tenants: Record<ID, TenantState>;
  session: Session;
  /** Platform-wide sequences, so IDs never collide across tenants. */
  seq: Record<string, number>;
};

export function emptyTenant(organizationId: ID): TenantState {
  return {
    organizationId,
    customers: [],
    staff: [],
    destinations: [],
    locations: [],
    voyages: [],
    ports: [],
    routes: [],
    vessels: [],
    schedules: [],
    bookings: [],
    manifests: [],
    packages: [],
    shipments: [],
    purchaseInvoices: [],
    bills: [],
    payments: [],
    exceptions: [],
    deliveries: [],
    claims: [],
    tickets: [],
    conversations: [],
    notifications: [],
    events: [],
    procurements: [],
    quotes: [],
  };
}

type Seeder = () => PlatformState;
let seeder: Seeder | null = null;
/** Registered by src/data/seed.ts (avoids an import cycle). */
export function registerSeeder(fn: Seeder) {
  seeder = fn;
}

let state: PlatformState | null = null;

/**
 * Where the active tenant scope lives. Default: a synchronous stack (browser,
 * tests, seed). The server swaps in AsyncLocalStorage so concurrent requests
 * never see each other's scope across `await`s (see app/api/_demo.ts).
 */
export type TenantScopeProvider = { current(): ID | undefined; run<T>(organizationId: ID, fn: () => T): T };
const scopes: ID[] = [];
let scopeProvider: TenantScopeProvider = {
  current: () => scopes.at(-1),
  run(organizationId, fn) {
    scopes.push(organizationId);
    try {
      return fn();
    } finally {
      scopes.pop();
    }
  },
};
export function setTenantScopeProvider(p: TenantScopeProvider) {
  scopeProvider = p;
}
let version = 0;
const listeners = new Set<() => void>();
const isBrowser = typeof window !== "undefined";

function fresh(): PlatformState {
  if (!seeder) throw new Error("Seeder not registered — import '@/services' before using the store.");
  return seeder();
}

function load(): PlatformState {
  if (isBrowser) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PlatformState;
        if (parsed.schema === SCHEMA_VERSION) return parsed;
      }
    } catch {
      /* corrupted or blocked — reseed */
    }
  }
  return fresh();
}

/** Whole-platform state (organizations, sessions, every partition). Platform services only. */
export function platform(): PlatformState {
  if (!state) {
    state = load();
    if (isBrowser) persist();
  }
  return state;
}

/** The active organization: innermost withTenant() scope, else the session's. */
export function tenantId(): ID {
  return scopeProvider.current() ?? platform().session.organizationId;
}

export class TenantScopeError extends Error {}

/** The active tenant's data partition. Everything tenant-owned is read through here. */
export function db(): TenantState {
  const id = tenantId();
  const t = platform().tenants[id];
  if (!t) throw new TenantScopeError(`No data partition for organization ${id}.`);
  return t;
}

/** Run `fn` as organization `organizationId` (API requests, jobs, tests). */
export function withTenant<T>(organizationId: ID, fn: () => T): T {
  if (!platform().tenants[organizationId]) throw new TenantScopeError(`Unknown organization ${organizationId}.`);
  return scopeProvider.run(organizationId, fn);
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
/** Every tenant write goes through here. Nested calls commit once. */
export function mutate<T>(fn: (s: TenantState) => T): T {
  return mutatePlatform(() => fn(db()));
}

/** Platform-level writes (organizations, sessions). */
export function mutatePlatform<T>(fn: (p: PlatformState) => T): T {
  const s = platform();
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
  const s = platform();
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
export function withState<T>(s: PlatformState, fn: () => T): T {
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
      const next = JSON.parse(e.newValue) as PlatformState;
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
  platform();
  return version;
}
