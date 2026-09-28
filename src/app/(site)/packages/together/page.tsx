"use client";

import Link from "next/link";
import { useState } from "react";
import { CustomerView } from "@/components/customer/CustomerView";
import { MerchantMark } from "@/components/domain/MerchantMark";
import { Button, ButtonLink } from "@/components/ui/Button";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAction } from "@/components/ui/Toast";
import { calculateShippingCost, fmtLb, fmtUsd } from "@/domain/rates";
import type { Actor, Customer, ServiceLevel, Shipment } from "@/domain/types";
import * as svc from "@/services";

export default function TogetherPage() {
  return <CustomerView title="Put my packages together">{(me, actor) => <Together me={me} actor={actor} />}</CustomerView>;
}

function Together({ me, actor }: { me: Customer; actor: Actor }) {
  const run = useAction();
  const candidates = svc.consolidationCandidates(me.id);
  const coming = svc.listPackages({ customerId: me.id, status: "incoming" });
  const [picked, setPicked] = useState<string[]>(candidates.map((p) => p.id));
  const [service, setService] = useState<ServiceLevel>(candidates.some((p) => p.service === "ocean") ? "ocean" : me.preferredService);
  const dest = svc.getDestination(candidates[0]?.destinationId ?? me.homeDestination);
  const [method, setMethod] = useState<Shipment["deliveryMethod"]>(dest.homeDelivery ? me.deliveryPreference : "pickup");
  const [done, setDone] = useState<Shipment | null>(null);

  if (done) {
    return (
      <div className="mx-auto max-w-xl animate-pop py-6 text-center">
        <p className="text-7xl" aria-hidden>🎉</p>
        <h1 className="mt-4 text-5xl font-black tracking-tight">Done!</h1>
        <p className="mt-3 text-xl text-ink-soft">We&apos;ll combine {done.packageIds.length > 1 ? "these packages" : "it"} into one shipment.</p>
        <p className="mt-2 font-mono text-lg font-bold">{done.id}</p>
        <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left">
          {done.packageIds.map((id) => {
            const p = svc.getPackage(id);
            return <li key={id} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-sand-200"><span aria-hidden className="text-emerald-600">✓</span><span className="font-bold">{p.merchant}</span><span className="text-ink-soft">— {fmtLb(p.actualWeight)}</span></li>;
          })}
        </ul>
        <div className="mx-auto mt-6 max-w-sm rounded-2xl bg-sea-50 p-4 text-left text-sea-900 ring-1 ring-sea-200">
          <p className="font-bold">What happens now?</p>
          <p className="mt-1">We pack them, check the paperwork, and send them on the next {done.service === "air" ? "flight" : "sailing"}. Your bill is ready in Payments.</p>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href={`/shipments/${done.id}`} size="lg" icon="🚢">Track this shipment</ButtonLink>
          <ButtonLink href="/packages" size="lg" variant="secondary" icon="📦">Back to My Packages</ButtonLink>
        </div>
      </div>
    );
  }

  if (!candidates.length) {
    return (
      <EmptyState icon="📦" title="Nothing at our warehouse yet" action={<ButtonLink href="/packages">Back to My Packages</ButtonLink>}>
        {coming.length ? `${coming.length} package${coming.length > 1 ? "s are" : " is"} still coming to us. You can put them together once they arrive.` : "When your packages arrive, you can send them together."}
      </EmptyState>
    );
  }

  const chosen = candidates.filter((p) => picked.includes(p.id));
  const weights = chosen.map((p) => svc.billableFor(p, service));
  const total = Math.round(chosen.reduce((a, p) => a + (p.actualWeight ?? 0), 0) * 10) / 10;
  const together = chosen.length ? calculateShippingCost({ weights }, dest, service).total : 0;
  const separate = weights.reduce((a, w) => a + calculateShippingCost({ weights: [w] }, dest, service).total, 0);
  const saving = Math.max(0, separate - together);
  const missing = chosen.filter((p) => !p.purchaseInvoiceId);
  const toggle = (id: string) => setPicked((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/packages" className="mb-4 inline-flex min-h-11 items-center gap-2 font-semibold text-sea-700 hover:underline">← My Packages</Link>
      <h1 className="text-4xl font-black tracking-tight sm:text-5xl">You have {candidates.length} package{candidates.length > 1 ? "s" : ""}.</h1>
      <p className="mt-2 text-xl text-ink-soft">{candidates.length > 1 ? "Want us to put them together before they travel?" : "Ready to send it?"}</p>
      <p className="mt-1 text-ink-mute">We combine your packages into one shipment. It&apos;s usually cheaper.</p>

      <fieldset className="mt-6 min-w-0">
        <legend className="sr-only">Choose packages</legend>
        <ul className="space-y-3">
          {candidates.map((p) => {
            const on = picked.includes(p.id);
            return (
              <li key={p.id}>
                <label className={`flex min-h-20 cursor-pointer items-center gap-4 rounded-2xl bg-white p-4 ring-2 transition ${on ? "ring-sea-500" : "ring-sand-200 hover:ring-sea-200"}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(p.id)} className="peer sr-only" />
                  <span aria-hidden className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg font-black peer-focus-visible:ring-4 peer-focus-visible:ring-sun-400 ${on ? "bg-sea-600 text-white" : "ring-2 ring-sand-200"}`}>{on ? "✓" : ""}</span>
                  <MerchantMark merchant={p.merchant} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xl font-extrabold">{p.merchant}</span>
                    <span className="block truncate text-ink-soft">{p.itemName}{!p.purchaseInvoiceId && " · 🧾 receipt needed"}</span>
                  </span>
                  <span className="text-xl font-extrabold">{fmtLb(p.actualWeight)}</span>
                </label>
              </li>
            );
          })}
          {coming.map((p) => (
            <li key={p.id} className="flex min-h-16 items-center gap-4 rounded-2xl bg-sand-100/70 p-4 text-ink-mute">
              <span aria-hidden className="grid h-9 w-9 place-items-center">🚚</span>
              <span className="flex-1"><span className="font-bold">{p.merchant}</span> — still coming to us</span>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <fieldset className="rounded-2xl bg-white p-4 ring-1 ring-sand-200">
          <legend className="px-1 font-bold">How should it travel?</legend>
          {(["air", "ocean"] as const).map((s) => (
            <label key={s} className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
              <input type="radio" name="svc" checked={service === s} onChange={() => setService(s)} className="h-5 w-5 accent-[var(--color-sea-600)]" />
              {s === "air" ? "✈️ Faster (air)" : "🚢 Bigger / slower (ocean)"}
            </label>
          ))}
        </fieldset>
        <fieldset className="rounded-2xl bg-white p-4 ring-1 ring-sand-200">
          <legend className="px-1 font-bold">How do you want it?</legend>
          <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 font-semibold">
            <input type="radio" name="m" checked={method === "pickup"} onChange={() => setMethod("pickup")} className="h-5 w-5 accent-[var(--color-sea-600)]" /> 📍 I&apos;ll pick it up
          </label>
          <label className={`mt-2 flex min-h-11 items-center gap-2 font-semibold ${dest.homeDelivery ? "cursor-pointer" : "opacity-50"}`}>
            <input type="radio" name="m" disabled={!dest.homeDelivery} checked={method === "home_delivery"} onChange={() => setMethod("home_delivery")} className="h-5 w-5 accent-[var(--color-sea-600)]" /> 🚚 Bring it to me {dest.homeDelivery ? `(+${fmtUsd(dest.homeDeliveryFee)})` : "(not in " + dest.name + ")"}
          </label>
        </fieldset>
      </div>

      <div className="mt-5 rounded-2xl bg-white p-5 ring-1 ring-sand-200">
        <div className="flex items-baseline justify-between"><span className="text-lg font-bold text-ink-soft">Total weight</span><span className="text-3xl font-black">{fmtLb(total)}</span></div>
        <div className="mt-1 flex items-baseline justify-between"><span className="font-bold text-ink-soft">Shipping (estimate)</span><span className="text-2xl font-black">{fmtUsd(together)}</span></div>
        {saving > 0.01 && chosen.length >= 2 && (
          <p className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 font-bold text-emerald-800">💵 You save about {fmtUsd(saving)} by sending them together <DemoBadge>Demo estimate</DemoBadge></p>
        )}
        {missing.length > 0 && <p className="mt-3 rounded-xl bg-sun-50 px-3 py-2 font-semibold text-sun-700">🧾 {missing.map((p) => p.merchant).join(", ")} still need{missing.length === 1 ? "s" : ""} a receipt. You can send now — we&apos;ll ask for it before customs.</p>}
      </div>

      <div className="sticky bottom-20 z-20 mt-6 bg-sand-50/95 py-2 backdrop-blur lg:static">
        <Button
          size="xl"
          full
          disabled={!chosen.length}
          onClick={() => {
            const sh = run(() => svc.createShipment(actor, { customerId: me.id, packageIds: chosen.map((p) => p.id), service, deliveryMethod: method }));
            if (sh) {
              setDone(sh);
              window.scrollTo({ top: 0 });
            }
          }}
        >
          {!chosen.length ? "Pick at least 1 package" : chosen.length === 1 ? "Send It" : "Put These Together"}
        </Button>
      </div>
    </div>
  );
}
