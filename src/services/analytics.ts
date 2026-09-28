/**
 * ANALYTICS — every number is derived from the same records the rest of the
 * system uses. Nothing here is typed in by hand.
 */
import { DAY, now } from "@/data/clock";
import { db } from "@/data/store";
import { balanceOf } from "@/domain/billing";
import type { ChargeKind } from "@/domain/types";
import { round2 } from "./_shared";
import { isOpen } from "./exceptions";
import { storageQueue } from "./storage";
import { eventsOfType } from "./timeline";

const hoursBetween = (a?: string, b?: string) => (a && b ? (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000 : undefined);
const avg = (xs: (number | undefined)[]) => {
  const v = xs.filter((x): x is number => x !== undefined && Number.isFinite(x));
  return v.length ? round2(v.reduce((a, b) => a + b, 0) / v.length) : 0;
};

export function dailySeries(type: string, days = 14) {
  const end = new Date(now());
  end.setHours(23, 59, 59, 999);
  const buckets = Array.from({ length: days }, (_, i) => {
    const d = new Date(end.getTime() - (days - 1 - i) * DAY);
    return { date: d.toISOString().slice(0, 10), label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), count: 0 };
  });
  for (const e of eventsOfType(type)) {
    const b = buckets.find((x) => x.date === new Date(e.at).toISOString().slice(0, 10));
    if (b) b.count++;
  }
  return buckets;
}

export function operationsSnapshot() {
  const s = db();
  const today = new Date(now()).toISOString().slice(0, 10);
  const receivedToday = eventsOfType("PACKAGE_RECEIVED").filter((e) => e.at.slice(0, 10) === today).length;
  return {
    arriving: s.packages.filter((p) => p.status === "incoming").length,
    docked: s.packages.filter((p) => p.status === "incoming" && p.dockedAt).length,
    receivedToday,
    atWarehouse: s.packages.filter((p) => p.status === "received").length,
    readyForShipment: s.shipments.filter((x) => x.status === "cleared").length,
    awaitingCustoms: s.shipments.filter((x) => x.status === "awaiting_customs").length,
    inTransit: s.shipments.filter((x) => x.status === "departed").length,
    inTransitPackages: s.packages.filter((p) => p.status === "in_transit").length,
    lastMile: s.deliveries.filter((d) => !["delivered"].includes(d.status)).length,
    openExceptions: s.exceptions.filter(isOpen).length,
    criticalExceptions: s.exceptions.filter((e) => isOpen(e) && ["critical", "high"].includes(e.severity)).length,
    openClaims: s.claims.filter((c) => !["resolved", "rejected"].includes(c.status)).length,
    openTickets: s.tickets.filter((t) => t.status !== "resolved").length,
    pendingPayments: round2(s.bills.reduce((a, b) => a + balanceOf(b, s.payments), 0)),
    revenue30: round2(s.payments.filter((p) => now() - new Date(p.receivedAt).getTime() <= 30 * DAY).reduce((a, p) => a + p.amount, 0)),
  };
}

export function analytics() {
  const s = db();
  const t = now();
  const within = (iso: string | undefined, days: number) => !!iso && t - new Date(iso).getTime() <= days * DAY;

  // Customers
  const lastActivity = new Map<string, string>();
  for (const e of s.events) if (e.refs.customerId) lastActivity.set(e.refs.customerId, e.at);
  const shipmentsPer = new Map<string, number>();
  s.shipments.forEach((x) => shipmentsPer.set(x.customerId, (shipmentsPer.get(x.customerId) ?? 0) + 1));
  const customers = {
    total: s.customers.length,
    new30: s.customers.filter((c) => within(c.createdAt, 30)).length,
    active30: s.customers.filter((c) => within(lastActivity.get(c.id), 30)).length,
    repeat: [...shipmentsPer.values()].filter((n) => n >= 2).length,
    inactive60: s.customers.filter((c) => !within(lastActivity.get(c.id), 60)).length,
    business: s.customers.filter((c) => c.type === "business").length,
  };

  // Packages
  const received = s.packages.filter((p) => p.actualWeight);
  const withPackages = new Set(s.packages.map((p) => p.customerId).filter(Boolean));
  const shipmentValues = s.shipments.map((x) => s.packages.filter((p) => x.packageIds.includes(p.id)).reduce((a, p) => a + (p.declaredValue ?? 0), 0));
  const perDay = dailySeries("PACKAGE_RECEIVED", 14);
  const packages = {
    perDay,
    avgPerDay: avg(perDay.map((d) => d.count)),
    avgPerCustomer: withPackages.size ? round2(s.packages.length / withPackages.size) : 0,
    avgWeight: avg(received.map((p) => p.actualWeight)),
    avgShipmentValue: avg(shipmentValues),
    total: s.packages.length,
  };

  // Revenue (bills issued, excluding government duty pass-through)
  const byKind: Partial<Record<ChargeKind | "business", number>> = {};
  for (const b of s.bills.filter((x) => x.lifecycle === "issued")) {
    const cust = s.customers.find((c) => c.id === b.customerId);
    for (const l of b.lines) {
      if (l.kind === "customs_duty") continue;
      const k: ChargeKind = l.kind === "island_delivery" ? "shipping" : l.kind;
      byKind[k] = round2((byKind[k] ?? 0) + l.amount);
      if (cust?.type === "business") byKind.business = round2((byKind.business ?? 0) + l.amount);
    }
  }
  const revenue = {
    shipping: byKind.shipping ?? 0,
    delivery: byKind.delivery ?? 0,
    storage: byKind.storage ?? 0,
    procurement: byKind.procurement ?? 0,
    other: round2((byKind.handling ?? 0) + (byKind.other ?? 0)),
    business: byKind.business ?? 0,
    collected: round2(s.payments.reduce((a, p) => a + p.amount, 0)),
    outstanding: round2(s.bills.reduce((a, b) => a + balanceOf(b, s.payments), 0)),
  };

  // Operations
  const approvedAt = new Map(eventsOfType("CUSTOMS_APPROVED").map((e) => [e.refs.shipmentId, e.at]));
  const deliveredAt = new Map(eventsOfType("PACKAGE_DELIVERED").filter((e) => e.refs.shipmentId).map((e) => [e.refs.shipmentId, e.at]));
  const receivedIds = new Set(eventsOfType("PACKAGE_RECEIVED").map((e) => e.refs.packageId));
  const withEx = new Set(s.exceptions.map((e) => e.packageId).filter(Boolean));
  const operations = {
    receivingHours: avg(s.packages.map((p) => hoursBetween(p.dockedAt, p.storage.receivedAt))),
    backlog: s.packages.filter((p) => (p.status === "incoming" && p.dockedAt) || (p.status === "received" && !p.shipmentId)).length,
    customsHours: avg(s.shipments.map((x) => hoursBetween(x.createdAt, approvedAt.get(x.id)))),
    deliveryHours: avg(s.shipments.map((x) => hoursBetween(x.arrivedAt, deliveredAt.get(x.id)))),
    exceptionRate: receivedIds.size ? round2(([...withEx].filter((id) => receivedIds.has(id)).length / receivedIds.size) * 100) : 0,
    storageOverdue: storageQueue().filter((x) => x.storage.daysOver > 0).length,
    openExceptions: s.exceptions.filter(isOpen).length,
  };

  // Support
  const convs = s.conversations.filter((c) => c.messages.some((m) => m.author === "customer"));
  const intents = new Map<string, number>();
  convs.forEach((c) => c.intents.forEach((i) => intents.set(i, (intents.get(i) ?? 0) + 1)));
  const resolved = s.tickets.filter((x) => x.resolvedAt);
  const support = {
    conversations: convs.length,
    aiResolutionRate: convs.length ? round2((convs.filter((c) => !c.escalated).length / convs.length) * 100) : 0,
    escalationRate: convs.length ? round2((convs.filter((c) => c.escalated).length / convs.length) * 100) : 0,
    commonQuestions: [...intents.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    avgResolutionHours: avg(resolved.map((x) => hoursBetween(x.createdAt, x.resolvedAt))),
    openTickets: s.tickets.filter((x) => x.status !== "resolved").length,
  };

  return { customers, packages, revenue, operations, support };
}

/** Work waiting for each team — drives role-based queues. */
export function workQueues() {
  const s = db();
  const open = s.exceptions.filter(isOpen);
  return {
    warehouse: s.packages.filter((p) => p.status === "incoming" && p.dockedAt).length + open.filter((e) => e.team === "warehouse").length + s.shipments.filter((x) => x.status === "cleared").length,
    customs: s.shipments.filter((x) => x.status === "awaiting_customs").length,
    accounting: open.filter((e) => e.team === "accounting").length + s.payments.filter((p) => !p.billId).length,
    support: s.tickets.filter((t) => t.status === "waiting_on_staff").length + s.claims.filter((c) => ["submitted", "under_review"].includes(c.status)).length,
    delivery: s.deliveries.filter((d) => ["not_scheduled", "scheduled", "rescheduled", "out_for_delivery", "failed"].includes(d.status) && d.method === "home_delivery").length,
    management: open.filter((e) => e.team === "management" || e.severity === "critical").length,
  };
}
