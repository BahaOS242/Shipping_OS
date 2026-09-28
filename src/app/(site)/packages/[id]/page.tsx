"use client";

import Link from "next/link";
import { use, useState } from "react";
import { CustomerView } from "@/components/customer/CustomerView";
import { Money } from "@/components/customer/Money";
import { Activity } from "@/components/domain/Activity";
import { Journey } from "@/components/domain/Journey";
import { MerchantMark } from "@/components/domain/MerchantMark";
import { BillPill, DeliveryPill, PackagePill, ReceiptPill } from "@/components/domain/Status";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { useAction } from "@/components/ui/Toast";
import { PhotoTile, QR } from "@/components/ui/Visuals";
import { EXCEPTION_CATALOG, PACKAGE_COPY, TONE_CLASS } from "@/domain/copy";
import { fmtLb } from "@/domain/rates";
import * as svc from "@/services";

export default function PackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const run = useAction();
  const [holding, setHolding] = useState(false);
  return (
    <CustomerView title="Your package">
      {(me, actor) => {
        const p = svc.findPackage(id);
        if (!p || (p.customerId !== me.id && actor.role === "customer")) {
          return <EmptyState icon="🔎" title="We can't find that package" action={<ButtonLink href="/packages">See My Packages</ButtonLink>}>It may belong to another account.</EmptyState>;
        }
        const c = PACKAGE_COPY[p.status];
        const sh = svc.findShipment(p.shipmentId);
        const inv = svc.findPurchaseInvoice(p.purchaseInvoiceId);
        const bill = sh ? svc.listBills({ shipmentId: sh.id })[0] : undefined;
        const delivery = svc.deliveryForShipment(sh?.id);
        const storage = svc.packageStorage(p.id);
        const issues = svc.listExceptions({ packageId: p.id, status: "active" }).filter((e) => EXCEPTION_CATALOG[e.type].customerMessage);
        const dest = svc.getDestination(p.destinationId);
        const location = p.status === "in_transit" ? svc.getVoyage(sh?.voyageId)?.label ?? "On the way" : ["received", "preparing"].includes(p.status) ? `Florida Warehouse${p.bin ? ` · shelf ${p.bin}` : ""}` : p.status === "incoming" ? `With ${p.carrier}` : p.status === "delivered" ? "With you" : delivery?.address ?? dest.name;
        const out = delivery?.status === "out_for_delivery";

        return (
          <div className="mx-auto max-w-4xl space-y-5">
            <Link href="/packages" className="inline-flex min-h-11 items-center gap-2 font-semibold text-sea-700 hover:underline">← My Packages</Link>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <MerchantMark merchant={p.merchant} size="lg" />
                <div>
                  <p className="text-lg font-semibold text-ink-mute">Your package</p>
                  <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{p.merchant}</h1>
                  <p className="text-xl text-ink-soft">{p.itemName}</p>
                </div>
              </div>
              <QR value={p.id} size={96} />
            </div>

            <section className={`animate-rise rounded-[var(--radius-card)] p-6 ring-1 sm:p-8 ${TONE_CLASS[out ? "moving" : c.tone]}`} aria-live="polite">
              <p className="text-sm font-bold uppercase tracking-wider opacity-80">Status</p>
              <p className="mt-1 flex items-center gap-3 text-4xl font-black tracking-tight sm:text-5xl"><span aria-hidden>{out ? "🚚" : c.icon}</span>{out ? "Out for delivery" : c.title}</p>
              <p className="mt-2 text-lg font-medium">{out ? `With ${delivery?.driver}. Arriving ${delivery?.window?.from}–${delivery?.window?.to}.` : c.explain}</p>
            </section>

            {issues.map((e) => (
              <div key={e.id} className="flex items-start gap-3 rounded-2xl bg-sun-50 p-4 ring-1 ring-sun-300">
                <span aria-hidden className="text-2xl">{EXCEPTION_CATALOG[e.type].icon}</span>
                <p className="font-semibold text-ink">{EXCEPTION_CATALOG[e.type].customerMessage}</p>
              </div>
            ))}

            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-5">
                <p className="font-bold text-ink-mute">👀 What&apos;s happening now</p>
                <p className="mt-1 text-xl font-extrabold">{c.explain}</p>
              </Card>
              <Card className="p-5">
                <p className="font-bold text-ink-mute">👉 What&apos;s next</p>
                <p className="mt-1 text-xl font-extrabold">{!inv && p.status !== "delivered" ? "Upload your store receipt so it can travel." : c.next}</p>
              </Card>
            </div>

            <div className="flex flex-wrap gap-3">
              {!inv && p.status !== "delivered" && <ButtonLink href={`/invoices?package=${p.id}`} icon="🧾" variant="gold">Upload receipt</ButtonLink>}
              {p.status === "received" && !p.shipmentId && <ButtonLink href="/packages/together" icon="📦">Send it / Put together</ButtonLink>}
              <ButtonLink href={`/assistant?package=${p.id}`} variant="secondary" icon="💬">Ask About This Package</ButtonLink>
              <ButtonLink href={`/claims/new?package=${p.id}`} variant="secondary" icon="🛟">Report a problem</ButtonLink>
            </div>

            <Card className="p-6 sm:p-8">
              <h2 className="mb-6 text-2xl font-extrabold">The journey</h2>
              <Journey status={p.status} outForDelivery={out} />
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-extrabold">Package details</h2>
              <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
                {[
                  ["Package ID", <span key="i" className="font-mono">{p.id}</span>],
                  ["Current location", location],
                  ["Weight", p.actualWeight ? fmtLb(p.actualWeight) : "Not weighed yet"],
                  ["Dimensions", p.length ? `${p.length} × ${p.width} × ${p.height} in` : "—"],
                  ["You pay for", p.billableWeight ? `${fmtLb(p.billableWeight)}${p.dimensionalWeight && p.dimensionalWeight > (p.actualWeight ?? 0) ? " (size-based)" : ""}` : "—"],
                  ["Destination", `${dest.name} · ${p.service === "air" ? "✈️ Air" : "🚢 Ocean"}`],
                  ["Store receipt", inv ? <ReceiptPill key="r" status={inv.status} customer /> : <Pill key="r" tone="warn" icon="🧾">Needed</Pill>],
                  ["Shipment", sh ? <Link key="s" href={`/shipments/${sh.id}`} className="font-bold text-sea-700 underline">{sh.id}</Link> : "Not yet"],
                  ["Payment", bill ? <span key="b" className="flex flex-wrap items-center gap-1"><BillPill status={bill.status} /> <Money n={bill.balance || bill.total} /></span> : "Billed when it's sent"],
                  ["Storage", storage.applies ? storage.customerLine : storage.state === "collected" ? "Collected" : "—"],
                  ["Delivery", delivery ? <DeliveryPill key="d" status={delivery.status} /> : "—"],
                  ["Status", <PackagePill key="p" status={p.status} />],
                ].map(([k, v]) => (
                  <div key={String(k)}>
                    <dt className="text-sm font-semibold text-ink-mute">{k}</dt>
                    <dd className="font-bold">{v}</dd>
                  </div>
                ))}
              </dl>
              {p.status === "received" && !p.shipmentId && (
                <div className="mt-5 flex flex-wrap gap-2 border-t border-sand-200 pt-4">
                  {p.storage.holdStatus === "none" ? (
                    <button disabled={holding} onClick={() => { setHolding(true); run(() => svc.holdPackage(actor, p.id, "Customer asked us to wait"), "We'll hold it for you."); setHolding(false); }} className="min-h-11 rounded-xl px-4 font-bold ring-1 ring-sand-200">✋ Hold this package</button>
                  ) : (
                    <button onClick={() => run(() => svc.releaseHold(actor, p.id), "Hold released.")} className="min-h-11 rounded-xl px-4 font-bold ring-1 ring-sand-200">▶ Release hold</button>
                  )}
                </div>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-extrabold">Documents & photos</h2>
              <ul className="mt-3 space-y-2">
                {inv ? (
                  <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sand-50 p-3">
                    <span>🧾 <strong>{inv.source.fileName}</strong> <span className="text-ink-soft">· {inv.merchant} {inv.invoiceNumber}</span></span>
                    <Link href={`/invoices?open=${inv.id}`} className="font-bold text-sea-700">View</Link>
                  </li>
                ) : (
                  <li className="text-ink-soft">No receipt yet.</li>
                )}
              </ul>
              {p.photos.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">{p.photos.map((ph) => <PhotoTile key={ph} id={ph} damaged={p.condition === "damaged"} />)}</div>
              )}
            </Card>

            <Card className="p-6">
              <h2 className="mb-4 text-xl font-extrabold">History</h2>
              <Activity events={svc.timeline({ packageId: p.id }, { customerView: true })} customer />
            </Card>
          </div>
        );
      }}
    </CustomerView>
  );
}
