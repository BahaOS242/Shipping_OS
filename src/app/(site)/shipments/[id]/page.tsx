"use client";

import Link from "next/link";
import { use } from "react";
import { CustomerView } from "@/components/customer/CustomerView";
import { Money } from "@/components/customer/Money";
import { Activity } from "@/components/domain/Activity";
import { MerchantMark } from "@/components/domain/MerchantMark";
import { BillPill, DeliveryPill, PackagePill, ShipmentPill } from "@/components/domain/Status";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { fmtDate, fmtDateTime } from "@/components/ui/Time";
import { PhotoTile, Signature } from "@/components/ui/Visuals";
import { DELIVERY_COPY, SHIPMENT_COPY } from "@/domain/copy";
import { fmtLb } from "@/domain/rates";
import type { ShipmentStatus } from "@/domain/types";
import * as svc from "@/services";

const STEPS: { key: ShipmentStatus[]; label: string }[] = [
  { key: ["preparing", "awaiting_customs"], label: "Getting ready & paperwork" },
  { key: ["cleared"], label: "Ready to travel" },
  { key: ["departed"], label: "Coming to The Bahamas" },
  { key: ["arrived", "out_for_delivery", "ready_for_pickup"], label: "In The Bahamas" },
  { key: ["completed"], label: "Delivered" },
];

export default function ShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <CustomerView title="Your shipment">
      {(me, actor) => {
        const s = svc.findShipment(id);
        if (!s || (s.customerId !== me.id && actor.role === "customer")) return <EmptyState icon="🔎" title="We can't find that shipment" action={<ButtonLink href="/shipments">My Shipments</ButtonLink>} />;
        const pk = svc.shipmentPackages(s);
        const cur = STEPS.findIndex((x) => x.key.includes(s.status));
        const v = svc.getVoyage(s.voyageId);
        const d = svc.deliveryForShipment(s.id);
        const bill = svc.listBills({ shipmentId: s.id })[0];
        return (
          <div className="mx-auto max-w-4xl space-y-5">
            <Link href="/shipments" className="inline-flex min-h-11 items-center gap-2 font-semibold text-sea-700 hover:underline">← My Shipments</Link>
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-semibold text-ink-mute">Your shipment</p>
                <h1 className="font-mono text-3xl font-black">{s.id}</h1>
              </div>
              <ShipmentPill status={s.status} size="lg" />
            </header>
            <section className="rounded-[var(--radius-card)] bg-ink p-6 text-white sm:p-8">
              <p className="text-4xl font-black">{SHIPMENT_COPY[s.status].icon} {d?.status === "out_for_delivery" ? DELIVERY_COPY.out_for_delivery.customer : SHIPMENT_COPY[s.status].customer}</p>
              <p className="mt-2 text-lg text-white/80">
                {pk.length} package{pk.length > 1 ? "s" : ""} to {svc.getDestination(s.destinationId).name} by {s.service === "air" ? "air ✈️" : "ocean 🚢"}
                {v && ` · ${v.label} · arrives ${fmtDate(v.arrivesAt, { weekday: "short", month: "short", day: "numeric" })}`}
              </p>
              <ol className="mt-6 grid grid-cols-5 gap-1.5" aria-label="Progress">
                {STEPS.map((st, i) => (
                  <li key={st.label}>
                    <span className={`block h-2 rounded-full ${i < cur || s.status === "completed" ? "bg-sea-400" : i === cur ? "bg-sun-400" : "bg-white/20"}`} />
                    <span className="mt-2 hidden text-xs font-semibold text-white/70 sm:block">{i < cur ? "✓ " : i === cur ? "● " : "○ "}{st.label}</span>
                  </li>
                ))}
              </ol>
            </section>

            <div className="grid gap-5 md:grid-cols-2">
              <Card className="p-6">
                <h2 className="text-xl font-extrabold">Packages inside</h2>
                <ul className="mt-3 divide-y divide-sand-200">
                  {pk.map((p) => (
                    <li key={p.id}>
                      <Link href={`/packages/${p.id}`} className="flex items-center gap-3 py-3">
                        <MerchantMark merchant={p.merchant} size="sm" />
                        <span className="min-w-0 flex-1"><span className="block font-bold">{p.merchant} — {p.itemName}</span><span className="text-sm text-ink-mute">{p.id} · {fmtLb(p.actualWeight)}</span></span>
                        <PackagePill status={p.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
              <Card className="p-6">
                <h2 className="text-xl font-extrabold">{d?.method === "home_delivery" || s.deliveryMethod === "home_delivery" ? "Delivery" : "Pickup"}</h2>
                {!d ? (
                  <p className="mt-2 text-ink-soft">{s.deliveryMethod === "home_delivery" ? "We'll schedule delivery when it lands." : "We'll tell you when it's ready to pick up."}</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    <DeliveryPill status={d.status} size="md" />
                    <p className="font-semibold">📍 {d.address}</p>
                    {d.window && d.method === "home_delivery" && <p>🗓️ {fmtDate(d.window.date, { weekday: "long", month: "short", day: "numeric" })}, {d.window.from}–{d.window.to}{d.driver && ` · ${d.driver}`}</p>}
                    {d.status === "failed" && <p className="rounded-xl bg-coral-50 p-3 font-semibold text-coral-700">We missed you. Our team will call to set a new time. <Link href="/support" className="underline">Message us</Link></p>}
                    {d.proof && (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <Signature path={d.proof.signature} name={d.proof.receivedBy} />
                        <PhotoTile id={d.proof.photo} />
                        <p className="col-span-2 text-sm text-ink-soft">Proof of delivery (simulated): received by <strong>{d.proof.receivedBy}</strong> · {fmtDateTime(d.proof.at)}{d.proof.gps ? ` · ${d.proof.gps}` : ""}</p>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            </div>

            {bill && (
              <Card className="flex flex-wrap items-center justify-between gap-3 p-6">
                <div>
                  <p className="text-sm font-bold text-ink-mute">Bill {bill.id}</p>
                  <p className="text-2xl font-black"><Money n={bill.total} /> <BillPill status={bill.status} /></p>
                </div>
                <ButtonLink href={`/payments?bill=${bill.id}`} variant={bill.balance ? "gold" : "secondary"} icon={bill.balance ? "💳" : "🧾"}>{bill.balance ? "Pay Now" : "View Invoice"}</ButtonLink>
              </Card>
            )}

            <Card className="p-6">
              <h2 className="mb-4 text-xl font-extrabold">History</h2>
              <Activity events={svc.timeline({ shipmentId: s.id }, { customerView: true })} customer />
            </Card>
          </div>
        );
      }}
    </CustomerView>
  );
}
