/** What the customer needs to do next — derived from real records, never typed in. */
import { now } from "@/data/clock";
import { db } from "@/data/store";
import { EXCEPTION_CATALOG } from "@/domain/copy";
import { storageStatus } from "@/domain/storage";
import type { ID } from "@/domain/types";
import { listBills } from "./billing";
import { isOpen } from "./exceptions";

export type CustomerAction = { id: string; icon: string; title: string; body: string; href: string; cta: string; urgency: 1 | 2 | 3 };

export function customerActions(customerId: ID): CustomerAction[] {
  const s = db();
  const out: CustomerAction[] = [];
  for (const p of s.packages.filter((x) => x.customerId === customerId && !x.purchaseInvoiceId && x.status !== "delivered")) {
    out.push({ id: `rcpt-${p.id}`, icon: "🧾", title: `Upload your ${p.merchant} receipt`, body: "We need the store receipt so your package can travel.", href: `/invoices?package=${p.id}`, cta: "Upload receipt", urgency: p.status === "incoming" ? 2 : 3 });
  }
  for (const b of listBills({ customerId }).filter((x) => x.balance > 0)) {
    out.push({ id: `bill-${b.id}`, icon: "💰", title: b.status === "overdue" ? `Bill ${b.id} is overdue` : `Pay bill ${b.id}`, body: `$${b.balance.toFixed(2)} ${b.status === "overdue" ? "was due" : "due"} ${new Date(b.dueAt!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}.`, href: `/payments?bill=${b.id}`, cta: "Pay now", urgency: b.status === "overdue" ? 3 : 2 });
  }
  for (const sh of s.shipments.filter((x) => x.customerId === customerId && x.status === "ready_for_pickup")) {
    out.push({ id: `pick-${sh.id}`, icon: "✅", title: "Ready for pickup", body: `Shipment ${sh.id} is waiting for you. Bring your ID.`, href: `/shipments/${sh.id}`, cta: "See where", urgency: 2 });
  }
  for (const d of s.deliveries.filter((x) => x.customerId === customerId && x.status === "failed")) {
    out.push({ id: `dlv-${d.id}`, icon: "🚚", title: "We missed you", body: "Let's set a new delivery time.", href: `/shipments/${d.shipmentId}`, cta: "Fix delivery", urgency: 3 });
  }
  for (const c of s.claims.filter((x) => x.customerId === customerId && x.status === "waiting_for_customer")) {
    out.push({ id: `clm-${c.id}`, icon: "🛟", title: `Reply on claim ${c.id}`, body: c.updates.at(-1)?.text ?? "We need a little more information.", href: `/claims?open=${c.id}`, cta: "Reply", urgency: 2 });
  }
  for (const p of s.packages.filter((x) => x.customerId === customerId)) {
    const st = storageStatus(p, now());
    if (st.state === "overdue" || st.state === "at_risk") out.push({ id: `sto-${p.id}`, icon: "⏰", title: "Your package has been waiting for you", body: `${p.merchant} — waiting ${st.daysWaiting} days. Send it or put it together with others.`, href: `/packages/${p.id}`, cta: "Send it", urgency: 2 });
  }
  for (const e of s.exceptions.filter((x) => x.customerId === customerId && isOpen(x) && ["OVERSIZED_ITEM", "ADDRESS_PROBLEM"].includes(x.type))) {
    out.push({ id: `ex-${e.id}`, icon: EXCEPTION_CATALOG[e.type].icon, title: EXCEPTION_CATALOG[e.type].label, body: EXCEPTION_CATALOG[e.type].customerMessage ?? e.detail, href: e.packageId ? `/packages/${e.packageId}` : `/shipments/${e.shipmentId}`, cta: "See what to do", urgency: 2 });
  }
  for (const p of s.procurements.filter((x) => x.customerId === customerId && x.status === "quoted")) {
    out.push({ id: `prc-${p.id}`, icon: "🛒", title: "Your price is ready", body: `${p.product} — approve to let us buy it for you.`, href: `/dashboard#buy-for-me`, cta: "Review price", urgency: 2 });
  }
  return out.sort((a, b) => b.urgency - a.urgency);
}
