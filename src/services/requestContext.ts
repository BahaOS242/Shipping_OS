/**
 * REQUEST CONTEXT — who is acting, and for which organization.
 *
 * Production model (the only one that may authorize anything):
 *
 *   Authenticated user (principal from the identity provider)
 *     → Organization memberships (looked up server-side, never taken from the client)
 *     → Active organization (the client may only SELECT one of its own memberships)
 *     → Module entitlement → Role permission → Resource ownership → Service action
 *
 * Business services never see a request. They receive an Actor and run inside
 * `withTenant(activeOrganization)`; this file turns an authenticated principal
 * into exactly that. Swapping the demo transport for real authentication means
 * replacing the resolver in src/server/requestContext.ts — not touching services.
 */
import { platform } from "@/data/store";
import { ForbiddenError } from "@/domain/roles";
import type { Actor, ID, Organization, Role } from "@/domain/types";
import { actorFor, customerActor } from "./_shared";

/** What the identity provider vouches for. Nothing in here names an organization. */
export type Principal = { subject: string; email: string; kind: "staff" | "customer" };

export type Membership = { organizationId: ID; organizationSlug: string; kind: "staff" | "customer"; role: Role; userId?: ID; customerId?: ID };

export type RequestContext = {
  organization: Organization;
  actor: Actor;
  /** "session" = resolved from an authenticated principal; "demo" = demo transport (not an authorization boundary). */
  source: "session" | "demo";
  membership?: Membership;
};

/** 401 — no authenticated principal. */
export class AuthenticationError extends Error {}
/** 409 — the principal belongs to several organizations and didn't select one. */
export class OrganizationSelectionRequired extends Error {
  constructor(readonly memberships: Membership[]) {
    super("Choose an organization.");
  }
}

/** Server-side membership directory (production: memberships table). */
export function membershipsOf(principal: Principal): Membership[] {
  const email = principal.email.trim().toLowerCase();
  const out: Membership[] = [];
  for (const org of platform().organizations) {
    if (org.status !== "active") continue;
    const t = platform().tenants[org.id];
    if (principal.kind === "staff") {
      for (const u of t.staff) if (u.email?.toLowerCase() === email && u.status !== "invited") out.push({ organizationId: org.id, organizationSlug: org.slug, kind: "staff", role: u.role, userId: u.id });
    } else {
      for (const c of t.customers) if (c.email.toLowerCase() === email) out.push({ organizationId: org.id, organizationSlug: org.slug, kind: "customer", role: "customer", customerId: c.id });
    }
  }
  return out;
}

/**
 * Resolve the active organization for an authenticated principal.
 * `selected` (a slug, e.g. from a header or subdomain) is only a choice among the
 * principal's own memberships: it can never grant access to another organization.
 */
export function resolveActiveOrganization(principal: Principal | null, selected?: string | null): RequestContext {
  if (!principal) throw new AuthenticationError("Sign in first.");
  const memberships = membershipsOf(principal);
  if (!memberships.length) throw new ForbiddenError("You don't belong to any organization.");
  let m: Membership | undefined;
  if (selected) {
    m = memberships.find((x) => x.organizationSlug === selected.trim().toLowerCase());
    if (!m) throw new ForbiddenError("You don't belong to this organization.");
  } else if (memberships.length === 1) m = memberships[0];
  else throw new OrganizationSelectionRequired(memberships);
  const organization = platform().organizations.find((o) => o.id === m.organizationId)!;
  const t = platform().tenants[organization.id];
  const actor = m.kind === "staff" ? actorFor(t.staff.find((u) => u.id === m.userId)!) : customerActor(t.customers.find((c) => c.id === m.customerId)!);
  return { organization, actor, source: "session", membership: m };
}
