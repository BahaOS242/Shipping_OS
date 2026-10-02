/** DEMO SESSION — mock authentication via a role switcher and an organization switcher. */
import { mutatePlatform, platform, resetDemo } from "@/data/store";
import type { ID, Role } from "@/domain/types";
import { runSystemChecks } from "./storage";

export const getSession = () => platform().session;

export function switchRole(role: Role) {
  mutatePlatform((p) => {
    p.session.role = role;
    const staff = p.tenants[p.session.organizationId]?.staff ?? [];
    if (role !== "customer") p.session.staffId = staff.find((x) => x.role === role)?.id ?? p.session.staffId;
  });
}

export function switchCustomer(customerId: ID) {
  mutatePlatform((p) => {
    p.session.role = "customer";
    p.session.customerId = customerId;
  });
}

/** Sign in to another organization (demo) as its first owner/admin. */
export function switchOrganization(organizationId: ID) {
  mutatePlatform((p) => {
    const t = p.tenants[organizationId];
    if (!t) throw new Error("Unknown organization.");
    const lead = t.staff.find((u) => u.role === "owner") ?? t.staff.find((u) => u.role === "admin") ?? t.staff[0];
    p.session = { organizationId, role: lead?.role ?? "admin", staffId: lead?.id ?? "", customerId: t.customers[0]?.id ?? "" };
  });
}

export function resetDemoData() {
  resetDemo();
  runSystemChecks();
}
export const DEMO_CUSTOMER_ID = "cus_trevor";
