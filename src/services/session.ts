/** DEMO SESSION — mock authentication via a role switcher. */
import { db, mutate, resetDemo } from "@/data/store";
import type { ID, Role } from "@/domain/types";
import { runSystemChecks } from "./storage";

export const getSession = () => db().session;

export function switchRole(role: Role) {
  mutate((s) => {
    s.session.role = role;
    if (role !== "customer") s.session.staffId = s.staff.find((x) => x.role === role)?.id ?? s.session.staffId;
  });
}

export function switchCustomer(customerId: ID) {
  mutate((s) => {
    s.session.role = "customer";
    s.session.customerId = customerId;
  });
}

export function resetDemoData() {
  resetDemo();
  runSystemChecks();
}
export const DEMO_CUSTOMER_ID = "cus_trevor";
