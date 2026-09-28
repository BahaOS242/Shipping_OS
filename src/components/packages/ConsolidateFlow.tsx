"use client";

import { useState } from "react";
import type { CustomerPackage } from "@/lib/api/link-api";
import { demo } from "@/lib/demo-store";
import { estimateShipping, fmtLbs, fmtMoney } from "@/lib/pricing";
import { STATUS } from "@/lib/status";
import { Button, ButtonLink } from "../ui/Button";
import { DemoBadge } from "../ui/DemoBadge";
import { MerchantMark } from "./MerchantMark";

/** "Put my packages together" — demo interaction only. */
export function ConsolidateFlow({ packages }: { packages: CustomerPackage[] }) {
  const [selected, setSelected] = useState<string[]>(packages.map((p) => p.id));
  const [done, setDone] = useState(false);

  const chosen = packages.filter((p) => selected.includes(p.id));
  const total = Math.round(chosen.reduce((s, p) => s + p.weight, 0) * 10) / 10;
  const dest = packages[0]?.destination ?? "nassau";
  const separate = chosen.reduce((s, p) => s + estimateShipping({ destination: dest, weight: p.weight, mode: "air" }).total, 0);
  const together = chosen.length ? estimateShipping({ destination: dest, weight: total, mode: "air" }).total : 0;
  const saving = Math.max(0, separate - together);

  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  if (done) {
    return (
      <div className="mx-auto max-w-xl animate-pop py-6 text-center">
        <p className="text-7xl" aria-hidden>
          🎉
        </p>
        <h1 className="mt-4 text-5xl font-black tracking-tight">Done!</h1>
        <p className="mt-3 text-xl text-ink-soft">We&apos;ll prepare these packages together.</p>
        <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left">
          {chosen.map((p) => (
            <li key={p.id} className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-sand-200">
              <span aria-hidden className="text-emerald-600">✓</span>
              <span className="font-bold">{p.merchant}</span>
              <span className="text-ink-soft">— {fmtLbs(p.weight)}</span>
            </li>
          ))}
        </ul>
        <div className="mx-auto mt-6 max-w-sm rounded-2xl bg-sea-50 p-4 text-left text-sea-900 ring-1 ring-sea-200">
          <p className="font-bold">What happens now?</p>
          <p className="mt-1">
            When they&apos;re all at our warehouse, we pack them into one box and send it. We&apos;ll message you on WhatsApp.
          </p>
        </div>
        <ButtonLink href="/packages" size="xl" className="mt-8" icon="📦">
          Back to My Packages
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-4xl font-black tracking-tight sm:text-5xl">You have {packages.length} packages</h1>
      <p className="mt-2 text-xl text-ink-soft">Want us to put them together before they travel?</p>
      <p className="mt-1 text-ink-mute">We combine your packages into one shipment. It&apos;s usually cheaper.</p>

      <fieldset className="mt-6 min-w-0">
        <legend className="sr-only">Choose packages to put together</legend>
        <ul className="space-y-3">
          {packages.map((p) => {
            const on = selected.includes(p.id);
            return (
              <li key={p.id}>
                <label
                  className={`flex min-h-20 cursor-pointer items-center gap-4 rounded-2xl bg-white p-4 ring-2 transition ${
                    on ? "ring-sea-500" : "ring-sand-200 hover:ring-sea-200"
                  }`}
                >
                  <input type="checkbox" checked={on} onChange={() => toggle(p.id)} className="peer sr-only" />
                  <span
                    aria-hidden
                    className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-lg font-black peer-focus-visible:ring-4 peer-focus-visible:ring-sun-400 ${
                      on ? "bg-sea-600 text-white" : "bg-white ring-2 ring-sand-200"
                    }`}
                  >
                    {on ? "✓" : ""}
                  </span>
                  <MerchantMark merchant={p.merchant} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xl font-extrabold">{p.merchant}</span>
                    <span className="block truncate text-ink-soft">
                      {p.itemName} · {STATUS[p.status].short}
                    </span>
                  </span>
                  <span className="text-xl font-extrabold">{fmtLbs(p.weight)}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="mt-5 rounded-2xl bg-white p-5 ring-1 ring-sand-200">
        <div className="flex items-baseline justify-between">
          <span className="text-lg font-bold text-ink-soft">Total</span>
          <span className="text-3xl font-black">{fmtLbs(total)}</span>
        </div>
        {saving > 0 && chosen.length >= 2 && (
          <p className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 font-bold text-emerald-800">
            <span aria-hidden>💵</span> You could save about {fmtMoney(saving)}
            <DemoBadge>Demo estimate</DemoBadge>
          </p>
        )}
      </div>

      <div className="sticky bottom-20 z-20 mt-6 bg-sand-50/95 py-2 backdrop-blur lg:static">
        <Button
          size="xl"
          full
          disabled={chosen.length < 2}
          onClick={() => {
            demo.consolidate(chosen.map((p) => p.id));
            setDone(true);
            window.scrollTo({ top: 0 });
          }}
        >
          {chosen.length < 2 ? "Pick at least 2 packages" : "Put Them Together"}
        </Button>
      </div>
    </div>
  );
}
