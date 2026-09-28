"use client";

import { useLive } from "@/data/useLive";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Activity } from "@/components/domain/Activity";
import { BillPill, ClaimPill, CustomsPill, DeliveryPill, ExStatusPill, PackagePill, ReceiptPill, ShipmentPill } from "@/components/domain/Status";
import { BillLink, CustomerLink, PackageLink, ReceiptLink, ShipmentLink } from "@/components/ops/Links";
import { OpsPage } from "@/components/ops/OpsPage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { QR } from "@/components/ui/Visuals";
import { fmtLb, fmtUsd } from "@/domain/rates";
import * as svc from "@/services";

const KIND_ICON = { customer: "👤", package: "📦", shipment: "🚢", invoice: "🧾", bill: "💰", claim: "🛟", ticket: "🎧", exception: "⚠", payment: "💳" } as const;

export default function SearchPage() {
  useLive();
  return <Suspense><Results /></Suspense>;
}

/** Global search. An exact package/shipment/invoice/order/tracking hit shows the full connected trace. */
function Results() {
  useLive();
  const q = useSearchParams().get("q") ?? "";
  const hits = svc.search(q);
  const trace = svc.connected(q);
  return (
    <OpsPage title={`Search: “${q}”`} sub={`${hits.length} result${hits.length === 1 ? "" : "s"}`}>
      {trace && (
        <Section title={<span>🔗 Everything connected to <span className="font-mono">{trace.package.id}</span></span>}>
          <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
            <QR value={trace.package.id} size={120} />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["👤 Customer", trace.customer ? <CustomerLink key="c" id={trace.customer.id} /> : "Unmatched", trace.customer?.accountNumber],
                ["📦 Package", <PackageLink key="p" id={trace.package.id} />, <PackagePill key="pp" status={trace.package.status} staff />],
                ["🧾 Invoice", trace.invoice ? <ReceiptLink key="i" id={trace.invoice.id} /> : "Missing", trace.invoice ? <ReceiptPill key="ip" status={trace.invoice.status} /> : null],
                ["🚢 Shipment", trace.shipment ? <ShipmentLink key="s" id={trace.shipment.id} /> : "Not yet", trace.shipment ? <ShipmentPill key="sp" status={trace.shipment.status} staff /> : null],
                ["📋 Customs", trace.shipment ? <CustomsPill key="cu" status={trace.shipment.customs.status} /> : "—", trace.shipment?.customs.reviewedBy ? `by ${trace.shipment.customs.reviewedBy}` : null],
                ["💰 Payment", trace.bills[0] ? <BillLink key="b" id={trace.bills[0].id} /> : "Not billed", trace.bills[0] ? <span key="bp" className="flex flex-wrap gap-1"><BillPill status={trace.bills[0].status} /> {fmtUsd(trace.bills[0].total)}</span> : null],
                ["🚚 Delivery", trace.delivery ? <DeliveryPill key="d" status={trace.delivery.status} staff /> : "—", trace.delivery?.driver],
                ["🎧 Support", `${trace.tickets.length} ticket(s) · ${trace.claims.length} claim(s)`, trace.claims[0] ? <ClaimPill key="cl" status={trace.claims[0].status} /> : null],
              ].map(([k, v, sub], i) => (
                <div key={i} className="rounded-xl bg-[#f7f9fa] p-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-mute">{k}</p>
                  <div className="font-semibold">{v}</div>
                  {sub && <div className="mt-1 text-sm">{sub}</div>}
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-sm text-ink-soft">{trace.package.merchant} — {trace.package.itemName} · {fmtLb(trace.package.actualWeight)} · {trace.payments.length} payment(s) · {trace.openExceptions.length} open exception(s)</p>
          {trace.exceptions.length > 0 && <ul className="mt-2 flex flex-wrap gap-2">{trace.exceptions.map((e) => <li key={e.id}><Link href={`/exceptions?open=${e.id}`} className="flex items-center gap-1 text-sm"><ExStatusPill status={e.status} /> {e.title}</Link></li>)}</ul>}
          <details className="mt-4" open>
            <summary className="cursor-pointer font-bold">Timeline ({trace.timeline.length} events)</summary>
            <div className="mt-3"><Activity events={trace.timeline} /></div>
          </details>
        </Section>
      )}
      {!hits.length ? (
        <EmptyState icon="🔎" title="Nothing found">Try a name, account (TL10284), package (TL-PKG-10474), shipment (TL-SHP-2031), invoice, order or tracking number.</EmptyState>
      ) : (
        <Section title="All results" pad={false}>
          <ul className="divide-y divide-[#eef1f4]">
            {hits.map((h) => (
              <li key={h.kind + h.id}>
                <Link href={h.href} className="flex items-center gap-3 px-5 py-3 hover:bg-[#f7f9fa]">
                  <span aria-hidden className="text-xl">{KIND_ICON[h.kind]}</span>
                  <span className="min-w-0 flex-1"><span className="block font-bold">{h.title}</span><span className="block truncate text-sm text-ink-soft">{h.subtitle}</span></span>
                  <span className="text-xs font-bold uppercase text-ink-mute">{h.kind}{h.exact ? " · exact" : ""}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </OpsPage>
  );
}
