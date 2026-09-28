/** CUSTOMER SERVICE — profiles, shopping address, Customer 360 stats. */
import { db } from "@/data/store";
import { balanceOf } from "@/domain/billing";
import type { Customer, ID } from "@/domain/types";
import { byId, customerName, round2 } from "./_shared";
import { isOpen } from "./exceptions";
import { warehouse } from "./locations";

export const listCustomers = () => db().customers;
export const getCustomer = (id: ID): Customer => byId(db().customers, id, "Customer");
export const findCustomer = (id?: ID) => db().customers.find((c) => c.id === id);

export function findCustomerByPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  return db().customers.find((c) => c.phone.replace(/\D/g, "") === d);
}

/** Match a shipping label to a customer: suite number first, then name. */
export function matchCustomerFromLabel(labelName: string, suite?: string) {
  const s = suite?.replace(/[^0-9A-Z]/gi, "").toUpperCase();
  if (s) {
    const bySuite = db().customers.find((c) => c.accountNumber.toUpperCase() === s || c.accountNumber.toUpperCase() === `TL${s}`);
    if (bySuite) return { customer: bySuite, method: "suite" as const, confidence: 1 };
  }
  const n = labelName.trim().toLowerCase();
  const byName = db().customers.filter((c) => `${c.firstName} ${c.lastName}`.toLowerCase() === n || c.businessName?.toLowerCase() === n);
  if (byName.length === 1) return { customer: byName[0], method: "name" as const, confidence: 0.7 };
  return undefined;
}

export function shoppingAddress(c: Customer) {
  const w = warehouse();
  return {
    name: customerName(c),
    line1: `Shipping OS #${c.accountNumber}`,
    line2: w.addressLines[0],
    cityLine: w.addressLines[1],
    demo: true as const,
  };
}

/** Customer 360 numbers, all derived from real records. */
export function customerStats(id: ID) {
  const s = db();
  const packages = s.packages.filter((p) => p.customerId === id);
  const shipments = s.shipments.filter((x) => x.customerId === id);
  const bills = s.bills.filter((b) => b.customerId === id && b.lifecycle === "issued");
  const payments = s.payments.filter((p) => p.customerId === id);
  const totalSpend = round2(payments.reduce((a, p) => a + p.amount, 0));
  const billed = round2(bills.reduce((a, b) => a + b.total, 0));
  const destCount = new Map<string, number>();
  const svcCount = new Map<string, number>();
  shipments.forEach((x) => {
    destCount.set(x.destinationId, (destCount.get(x.destinationId) ?? 0) + 1);
    svcCount.set(x.service, (svcCount.get(x.service) ?? 0) + 1);
  });
  const top = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const events = s.events.filter((e) => e.refs.customerId === id);
  return {
    packages: packages.length,
    activePackages: packages.filter((p) => p.status !== "delivered").length,
    shipments: shipments.length,
    totalSpend,
    billed,
    balance: round2(bills.reduce((a, b) => a + balanceOf(b, s.payments), 0)),
    averageShipment: shipments.length ? round2(billed / shipments.length) : 0,
    preferredDestination: top(destCount),
    preferredService: top(svcCount),
    lastActivity: events.at(-1)?.at,
    openIssues: s.exceptions.filter((e) => e.customerId === id && isOpen(e)).length + s.claims.filter((c) => c.customerId === id && !["resolved", "rejected"].includes(c.status)).length + s.tickets.filter((t) => t.customerId === id && t.status !== "resolved").length,
  };
}
