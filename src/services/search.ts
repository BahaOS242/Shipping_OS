/**
 * GLOBAL SEARCH — customers, package IDs, shipment IDs, invoice numbers,
 * order numbers, tracking numbers, bills, claims, tickets. `connected()` returns
 * everything linked to a hit (the "trace" view).
 */
import { db } from "@/data/store";
import type { ID } from "@/domain/types";
import { customerName } from "./_shared";
import { billView } from "./billing";
import { isOpen } from "./exceptions";
import { timeline } from "./timeline";

export type SearchHit = { kind: "customer" | "package" | "shipment" | "invoice" | "bill" | "claim" | "ticket" | "exception" | "payment"; id: ID; title: string; subtitle: string; href: string; exact: boolean };

export function search(q: string, limit = 25): SearchHit[] {
  const s = db();
  const t = q.trim().toLowerCase();
  if (t.length < 2) return [];
  const has = (...xs: (string | undefined)[]) => xs.some((x) => x?.toLowerCase().includes(t));
  const is = (...xs: (string | undefined)[]) => xs.some((x) => x?.toLowerCase() === t);
  const hits: SearchHit[] = [];
  for (const c of s.customers)
    if (has(customerName(c), `${c.firstName} ${c.lastName}`, c.accountNumber, c.phone, c.email, c.businessName))
      hits.push({ kind: "customer", id: c.id, title: customerName(c), subtitle: `${c.accountNumber} · ${c.phone}`, href: `/customers/${c.id}`, exact: is(c.accountNumber) });
  for (const p of s.packages)
    if (has(p.id, p.inboundTracking, p.orderNumber, p.merchant, p.itemName))
      hits.push({ kind: "package", id: p.id, title: `${p.id} · ${p.merchant}`, subtitle: `${p.itemName} · ${p.inboundTracking}${p.orderNumber ? ` · order ${p.orderNumber}` : ""}`, href: `/warehouse/packages/${p.id}`, exact: is(p.id, p.inboundTracking, p.orderNumber) });
  for (const x of s.shipments) if (has(x.id)) hits.push({ kind: "shipment", id: x.id, title: x.id, subtitle: `${x.packageIds.length} packages · ${x.status}`, href: `/customs/${x.id}`, exact: is(x.id) });
  for (const i of s.purchaseInvoices)
    if (has(i.id, i.invoiceNumber, i.orderNumber)) hits.push({ kind: "invoice", id: i.id, title: `${i.merchant} ${i.invoiceNumber}`, subtitle: `Receipt ${i.id}${i.orderNumber ? ` · order ${i.orderNumber}` : ""}`, href: `/accounting/invoices/${i.id}`, exact: is(i.id, i.invoiceNumber, i.orderNumber) });
  for (const b of s.bills) if (has(b.id)) hits.push({ kind: "bill", id: b.id, title: b.id, subtitle: `Bill · $${b.total.toFixed(2)}`, href: `/accounting/bills/${b.id}`, exact: is(b.id) });
  for (const p of s.payments) if (has(p.id, p.reference)) hits.push({ kind: "payment", id: p.id, title: p.id, subtitle: `Payment · $${p.amount.toFixed(2)}`, href: `/accounting?tab=reconciliation`, exact: is(p.id) });
  for (const c of s.claims) if (has(c.id)) hits.push({ kind: "claim", id: c.id, title: c.id, subtitle: `Claim · ${c.status}`, href: `/claims?open=${c.id}`, exact: is(c.id) });
  for (const x of s.tickets) if (has(x.id, x.subject)) hits.push({ kind: "ticket", id: x.id, title: `${x.id} · ${x.subject}`, subtitle: `Support · ${x.status}`, href: `/support?open=${x.id}`, exact: is(x.id) });
  for (const e of s.exceptions) if (has(e.id)) hits.push({ kind: "exception", id: e.id, title: `${e.id} · ${e.title}`, subtitle: e.detail, href: `/exceptions?open=${e.id}`, exact: is(e.id) });
  return hits.sort((a, b) => Number(b.exact) - Number(a.exact)).slice(0, limit);
}

/** Everything connected to a package (by package ID, tracking, order or invoice number). */
export function connected(q: string) {
  const s = db();
  const t = q.trim().toLowerCase();
  const inv0 = s.purchaseInvoices.find((i) => [i.id, i.invoiceNumber, i.orderNumber].some((x) => x?.toLowerCase() === t));
  const pkg =
    s.packages.find((p) => [p.id, p.inboundTracking, p.orderNumber].some((x) => x?.toLowerCase() === t)) ??
    (inv0 ? s.packages.find((p) => p.id === inv0.packageId) : undefined) ??
    (() => {
      const sh = s.shipments.find((x) => x.id.toLowerCase() === t);
      return sh ? s.packages.find((p) => p.id === sh.packageIds[0]) : undefined;
    })();
  if (!pkg) return undefined;
  const customer = s.customers.find((c) => c.id === pkg.customerId);
  const shipment = s.shipments.find((x) => x.id === pkg.shipmentId);
  const invoice = s.purchaseInvoices.find((i) => i.id === pkg.purchaseInvoiceId) ?? inv0;
  const bills = s.bills.filter((b) => (shipment && b.shipmentId === shipment.id) || b.lines.some((l) => l.packageId === pkg.id)).map(billView);
  const delivery = s.deliveries.find((d) => d.shipmentId === shipment?.id);
  const exceptions = s.exceptions.filter((e) => e.packageId === pkg.id || (shipment && e.shipmentId === shipment.id));
  return {
    package: pkg,
    customer,
    shipment,
    invoice,
    bills,
    payments: s.payments.filter((p) => bills.some((b) => b.id === p.billId)),
    delivery,
    exceptions,
    openExceptions: exceptions.filter(isOpen),
    tickets: s.tickets.filter((x) => x.packageId === pkg.id || (shipment && x.shipmentId === shipment.id)),
    claims: s.claims.filter((c) => c.packageId === pkg.id || (shipment && c.shipmentId === shipment.id)),
    timeline: timeline({ packageId: pkg.id }),
  };
}
