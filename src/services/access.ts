/**
 * ACCESS — the authorization chain every tenant operation goes through.
 *
 *   Authenticated? → Organization member? → Module enabled? → Role permitted? → Record in tenant? → ALLOW
 *
 * - Membership: the actor must be signed in to the ACTIVE tenant and exist in it
 *   (staff user, customer account). An Org A actor can never act inside Org B.
 * - Module: the organization must be entitled to the feature. This is checked
 *   for every actor, the system included — a disabled module does nothing.
 * - Role: the existing permission model (`can` / `canActOn` in domain/roles.ts).
 * - Ownership: records are read through the tenant partition and `byId`, which
 *   rejects rows stamped with another organization.
 *
 * The UI uses the same answers to build navigation, but never relies on them.
 */
import { db, platform, tenantId } from "@/data/store";
import { ForbiddenError, assert } from "@/domain/roles";
import type { Actor, Organization } from "@/domain/types";
import { MODULES, type ModuleId } from "@/platform/modules";

/** Thrown when the organization isn't entitled to a module. */
export class ModuleDisabledError extends ForbiddenError {
  constructor(
    readonly module: ModuleId,
    orgName: string,
  ) {
    super(`${MODULES[module].label} isn't enabled for ${orgName}.`);
  }
}

/** Organization ID used by platform-level system jobs (they run inside an explicit tenant scope). */
export const PLATFORM_ORG = "platform";

export function getOrganization(id: string): Organization | undefined {
  return platform().organizations.find((o) => o.id === id);
}

/** The organization whose data is in scope right now. */
export function currentOrganization(): Organization {
  const org = getOrganization(tenantId());
  if (!org) throw new ForbiddenError("No organization selected.");
  return org;
}

export const enabledModules = (): readonly ModuleId[] => currentOrganization().modules;
export const isModuleEnabled = (m: ModuleId) => currentOrganization().modules.includes(m);

/** Entitlement check — applies to every caller. */
export function requireModule(...modules: ModuleId[]) {
  const org = currentOrganization();
  for (const m of modules) if (!org.modules.includes(m)) throw new ModuleDisabledError(m, org.name);
}

/** Steps 1–2: authenticated and a member of the active organization. */
export function assertMember(actor: Actor | undefined): asserts actor is Actor {
  if (!actor || !actor.kind || !actor.role) throw new ForbiddenError("Sign in first.");
  const org = currentOrganization();
  if (org.status !== "active") throw new ForbiddenError(`${org.name} is suspended.`);
  if (actor.kind === "system") return; // jobs run inside an explicit tenant scope
  if (actor.organizationId !== org.id) throw new ForbiddenError("You don't belong to this organization.");
  const t = db();
  if (actor.kind === "customer" || actor.kind === "ai") {
    if (!actor.customerId || !t.customers.some((c) => c.id === actor.customerId)) throw new ForbiddenError("You don't belong to this organization.");
    return;
  }
  const member = actor.userId ? t.staff.find((u) => u.id === actor.userId) : t.staff.find((u) => u.name === actor.name && u.role === actor.role);
  if (!member || member.role !== actor.role) throw new ForbiddenError("You don't belong to this organization.");
  if (member.status === "invited") throw new ForbiddenError("Accept your invitation first.");
}

/**
 * The full chain for a service operation. `permitted` is the role decision
 * (usually `can(...)` / `canActOn(...)`); `module` may be null for core
 * features every organization has (exceptions, audit, notifications).
 */
export function authorize(actor: Actor, module: ModuleId | ModuleId[] | null, permitted: boolean, message?: string) {
  assertMember(actor);
  if (module) requireModule(...([] as ModuleId[]).concat(module));
  assert(permitted, message);
}
