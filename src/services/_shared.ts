import { db, platform, tenantId } from "@/data/store";
import { ROLE_INFO } from "@/domain/roles";
import type { Actor, Customer, ID, StaffUser } from "@/domain/types";

/** A business rule was broken — safe to show the message to the user. */
export class BusinessError extends Error {}
export class NotFoundError extends BusinessError {}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Look a record up by ID inside the active tenant. Rows from another
 * organization are reported as "not found" (never "forbidden") so IDs
 * from other tenants can't be probed.
 */
export function byId<T extends { id: ID }>(rows: T[], id: ID | undefined, what: string): T {
  const row = id ? rows.find((r) => r.id === id) : undefined;
  if (!row || !inTenant(row)) throw new NotFoundError(`${what} not found`);
  return row;
}

/** Defense in depth on top of the partitioned store: the row must be stamped with the active tenant. */
export const inTenant = (row: object) => !("organizationId" in row) || (row as { organizationId: ID }).organizationId === tenantId();

export const findById = <T extends { id: ID }>(rows: T[], id?: ID) => (id ? rows.find((r) => r.id === id && inTenant(r)) : undefined);

export function customerName(c?: Pick<Customer, "firstName" | "lastName" | "businessName">) {
  if (!c) return "Unmatched customer";
  return c.businessName ?? `${c.firstName} ${c.lastName}`;
}

/** Who is using the app right now (mock auth — the demo role switcher). */
export function currentActor(): Actor {
  const s = platform().session;
  const organizationId = tenantId();
  if (s.role === "customer") {
    const c = db().customers.find((x) => x.id === s.customerId);
    return { kind: "customer", name: c ? `${c.firstName} ${c.lastName}` : "Customer", role: "customer", customerId: s.customerId, organizationId };
  }
  const staff = db().staff.find((x) => x.id === s.staffId && x.role === s.role) ?? db().staff.find((x) => x.role === s.role);
  return { kind: "staff", name: staff?.name ?? ROLE_INFO[s.role].label, role: s.role, organizationId, userId: staff?.id };
}

export const staffActor = (name: string, role: Actor["role"], organizationId: ID = tenantId(), userId?: ID): Actor => ({ kind: "staff", name, role, organizationId, userId });
export const actorFor = (u: StaffUser): Actor => staffActor(u.name, u.role, u.organizationId, u.id);
export const customerActor = (c: Customer): Actor => ({ kind: "customer", name: `${c.firstName} ${c.lastName}`, role: "customer", customerId: c.id, organizationId: c.organizationId });
export const aiActor = (customerId: ID, organizationId: ID = tenantId()): Actor => ({ kind: "ai", name: "Shipping OS Assistant", role: "customer", customerId, organizationId });
