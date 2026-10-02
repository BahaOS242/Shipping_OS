import "@/services";
import { AsyncLocalStorage } from "node:async_hooks";
import { platform, setTenantScopeProvider, withTenant } from "@/data/store";
import type { Organization } from "@/domain/types";
import { MODULES, type ModuleId } from "@/platform/modules";
import * as svc from "@/services";
import { DEMO_CUSTOMER_ID } from "@/services/session";

/**
 * Server tenant scope: one AsyncLocalStorage context per request, so concurrent
 * requests for different organizations never share a scope across awaits.
 */
const als = new AsyncLocalStorage<string>();
setTenantScopeProvider({ current: () => als.getStore(), run: (id, fn) => als.run(id, fn) });

/**
 * Which organization a request is for: `X-Organization: <slug>` header or
 * `?org=<slug>`; the default organization otherwise.
 * DEMO auth: acts as a demo customer of that organization. Production: resolve
 * the organization AND the customer from a session/OAuth token (web, MCP) or a
 * verified phone number registered to the organization (WhatsApp).
 * NOTE: server routes use an in-memory copy of the demo data per instance.
 */
export function requestOrganization(req: Request): Organization | undefined {
  const slug = req.headers.get("x-organization") ?? new URL(req.url).searchParams.get("org");
  return slug ? svc.getOrganizationBySlug(slug) : svc.getOrganization(svc.DEFAULT_ORG_ID);
}

/** Run a handler inside the request's organization, after checking its module entitlements. */
export async function withApiTenant(req: Request, modules: ModuleId[], fn: (org: Organization) => Response | Promise<Response>): Promise<Response> {
  platform(); // initialise the in-memory store
  const org = requestOrganization(req);
  if (!org) return Response.json({ error: "Unknown organization" }, { status: 404 });
  const missing = modules.filter((m) => !org.modules.includes(m));
  if (missing.length) return Response.json({ error: `${missing.map((m) => MODULES[m].label).join(", ")} isn't enabled for ${org.name}.` }, { status: 403 });
  return withTenant(org.id, () => fn(org));
}

/** The demo customer of the organization in scope. */
export const demoCustomerId = () => (svc.findCustomer(DEMO_CUSTOMER_ID) ? DEMO_CUSTOMER_ID : (svc.listCustomers()[0]?.id ?? DEMO_CUSTOMER_ID));
