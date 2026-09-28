import { db } from "@/data/store";
import { ROLE_INFO } from "@/domain/roles";
import type { Actor, Customer, ID } from "@/domain/types";

/** A business rule was broken — safe to show the message to the user. */
export class BusinessError extends Error {}
export class NotFoundError extends BusinessError {}

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function byId<T extends { id: ID }>(rows: T[], id: ID | undefined, what: string): T {
  const row = id ? rows.find((r) => r.id === id) : undefined;
  if (!row) throw new NotFoundError(`${what} not found`);
  return row;
}

export const findById = <T extends { id: ID }>(rows: T[], id?: ID) => (id ? rows.find((r) => r.id === id) : undefined);

export function customerName(c?: Pick<Customer, "firstName" | "lastName" | "businessName">) {
  if (!c) return "Unmatched customer";
  return c.businessName ?? `${c.firstName} ${c.lastName}`;
}

/** Who is using the app right now (mock auth — the demo role switcher). */
export function currentActor(): Actor {
  const s = db().session;
  if (s.role === "customer") {
    const c = db().customers.find((x) => x.id === s.customerId);
    return { kind: "customer", name: c ? `${c.firstName} ${c.lastName}` : "Customer", role: "customer", customerId: s.customerId };
  }
  const staff = db().staff.find((x) => x.id === s.staffId && x.role === s.role) ?? db().staff.find((x) => x.role === s.role);
  return { kind: "staff", name: staff?.name ?? ROLE_INFO[s.role].label, role: s.role };
}

export const staffActor = (name: string, role: Actor["role"]): Actor => ({ kind: "staff", name, role });
export const customerActor = (c: Customer): Actor => ({ kind: "customer", name: `${c.firstName} ${c.lastName}`, role: "customer", customerId: c.id });
export const aiActor = (customerId: ID): Actor => ({ kind: "ai", name: "Link Assistant", role: "customer", customerId });
