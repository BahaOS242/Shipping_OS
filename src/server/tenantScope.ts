/**
 * SERVER TENANT SCOPE — one AsyncLocalStorage context per request.
 * Concurrent requests for different organizations can't see each other's scope
 * across `await`s, and code running outside any request scope has no tenant at
 * all (strict), instead of falling back to a default organization.
 * Server-only (node:async_hooks): import from API routes and Node tests.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { setTenantScopeProvider } from "@/data/store";

let installed = false;

export function installAsyncTenantScope() {
  if (installed) return;
  const als = new AsyncLocalStorage<string>();
  setTenantScopeProvider({ current: () => als.getStore(), run: (id, fn) => als.run(id, fn), strict: true });
  installed = true;
}
