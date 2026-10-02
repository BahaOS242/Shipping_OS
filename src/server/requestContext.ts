/**
 * SERVER REQUEST CONTEXT — the single place API routes get "who + which organization".
 *
 *   Request → OrganizationContextResolver → RequestContext { organization, actor }
 *           → withTenant(organization) → module check → handler → services
 *
 * Two resolvers implement the same interface:
 *  - `sessionResolver`: PRODUCTION. Authenticates the request (pluggable
 *    `setAuthenticator`), then `resolveActiveOrganization()` checks membership.
 *    A client-supplied organization is only a selection among memberships.
 *  - `demoResolver`: DEMO TRANSPORT ONLY. `X-Organization` / `?org=` picks the
 *    organization and the request acts as that organization's demo customer.
 *    It is not an authorization boundary and must never be enabled for real data.
 *
 * Mode: SHIPPING_OS_AUTH_MODE = "demo" (default for this demo build) | "session".
 */
import "@/services";
import { platform, withTenant } from "@/data/store";
import { ForbiddenError } from "@/domain/roles";
import { MODULES, type ModuleId } from "@/platform/modules";
import * as svc from "@/services";
import { AuthenticationError, OrganizationSelectionRequired, resolveActiveOrganization, type Principal, type RequestContext } from "@/services/requestContext";
import { DEMO_CUSTOMER_ID } from "@/services/session";
import { installAsyncTenantScope } from "./tenantScope";

installAsyncTenantScope();

export interface OrganizationContextResolver {
  readonly mode: "session" | "demo";
  resolve(req: Request): RequestContext;
}

export const ORG_SELECTOR_HEADER = "x-organization";
const selectedOrganization = (req: Request) => req.headers.get(ORG_SELECTOR_HEADER) ?? new URL(req.url).searchParams.get("org");

/* ---------------- Production: authenticated session ---------------- */

type Authenticator = (req: Request) => Principal | null;
/** Replace with real token/session verification (OAuth, session cookie, signed JWT). */
let authenticate: Authenticator = () => null;
export function setAuthenticator(fn: Authenticator) {
  authenticate = fn;
}

export const sessionResolver: OrganizationContextResolver = {
  mode: "session",
  resolve: (req) => resolveActiveOrganization(authenticate(req), selectedOrganization(req)),
};

/* ---------------- Demo transport (NOT an authorization boundary) ---------------- */

export const demoResolver: OrganizationContextResolver = {
  mode: "demo",
  resolve(req) {
    const slug = selectedOrganization(req);
    const organization = slug ? svc.getOrganizationBySlug(slug) : svc.getOrganization(svc.DEFAULT_ORG_ID);
    if (!organization) throw new svc.NotFoundError("Unknown organization");
    const customers = platform().tenants[organization.id].customers;
    const customer = customers.find((c) => c.id === DEMO_CUSTOMER_ID) ?? customers[0];
    if (!customer) throw new ForbiddenError(`${organization.name} has no demo customer.`);
    return { organization, actor: svc.customerActor(customer), source: "demo" };
  },
};

/* ---------------- Inbound channels (no user session) ---------------- */

/**
 * WhatsApp Cloud API webhooks carry no user; the tenant is the organization that
 * owns the business number (metadata.phone_number_id). Demo mode falls back to
 * the demo transport for numbers no organization has registered.
 */
export function whatsappResolver(payload: { entry?: { changes?: { value?: { metadata?: { phone_number_id?: string } } }[] }[] }): OrganizationContextResolver {
  const ids = new Set((payload.entry ?? []).flatMap((e) => (e.changes ?? []).map((c) => c.value?.metadata?.phone_number_id).filter(Boolean) as string[]));
  return {
    mode: authMode(),
    resolve(req) {
      if (ids.size > 1) throw new ForbiddenError("One webhook delivery must target one business number.");
      const organization = ids.size ? svc.organizationForWhatsAppNumber([...ids][0]) : undefined;
      if (organization) return { organization, actor: { kind: "system", name: "WhatsApp webhook", role: "admin", organizationId: organization.id }, source: "session" };
      if (authMode() === "demo") return demoResolver.resolve(req);
      throw new svc.NotFoundError("No organization owns this WhatsApp number.");
    },
  };
}

export function authMode(): "session" | "demo" {
  return process.env.SHIPPING_OS_AUTH_MODE === "session" ? "session" : "demo";
}
export const contextResolver = (): OrganizationContextResolver => (authMode() === "session" ? sessionResolver : demoResolver);

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status });

/**
 * Run a route handler for the resolved organization: tenant scope, module
 * entitlements, then the handler (which calls services with `ctx.actor`).
 */
export async function withRequestContext(
  req: Request,
  modules: ModuleId[],
  fn: (ctx: RequestContext) => Response | Promise<Response>,
  resolver: OrganizationContextResolver = contextResolver(),
): Promise<Response> {
  platform(); // initialise the in-memory store
  let ctx: RequestContext;
  try {
    ctx = resolver.resolve(req);
  } catch (e) {
    if (e instanceof AuthenticationError) return json(401, { error: e.message });
    if (e instanceof OrganizationSelectionRequired) return json(409, { error: e.message, organizations: e.memberships.map((m) => m.organizationSlug) });
    if (e instanceof svc.NotFoundError) return json(404, { error: e.message });
    return json(403, { error: (e as Error).message });
  }
  return withTenant(ctx.organization.id, async () => {
    const missing = modules.filter((m) => !ctx.organization.modules.includes(m));
    if (missing.length) return json(403, { error: `${missing.map((m) => MODULES[m].label).join(", ")} isn't enabled for ${ctx.organization.name}.` });
    const res = await fn(ctx);
    if (ctx.source === "demo") res.headers.set("x-shipping-os-auth", "demo");
    return res;
  });
}
