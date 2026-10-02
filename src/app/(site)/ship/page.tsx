"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ShoppingAddressCard } from "@/components/account/ShoppingAddressCard";
import { CustomerView } from "@/components/customer/CustomerView";
import { ChoiceButton } from "@/components/shipping/ChoiceButton";
import { DestinationSelector } from "@/components/shipping/DestinationSelector";
import { ModeSelector } from "@/components/shipping/ModeSelector";
import { WeightInput, type Unit } from "@/components/shipping/WeightInput";
import { Button, ButtonLink } from "@/components/ui/Button";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { useAction } from "@/components/ui/Toast";
import { fmtLb, fmtUsd, kgToLbs } from "@/domain/rates";
import type { DestinationId, Quote, ServiceLevel } from "@/domain/types";
import * as svc from "@/services";

const WHAT = [
  { id: "package", icon: "📦", label: "Package", hint: "Clothes, shoes, household things" },
  { id: "furniture", icon: "🛋️", label: "Furniture", hint: "Chairs, tables, beds" },
  { id: "electronics", icon: "📺", label: "Electronics", hint: "TVs, laptops, phones" },
  { id: "business", icon: "🏢", label: "Business Items", hint: "Stock and supplies" },
  { id: "unsure", icon: "❓", label: "I'm not sure", hint: "That's okay — we'll help" },
] as const;
const SIZES = [
  { lbs: 5, label: "Small", hint: "Like a shoebox" },
  { lbs: 30, label: "Medium", hint: "Like a microwave" },
  { lbs: 60, label: "Large", hint: "Like a big TV" },
  { lbs: 150, label: "Very large", hint: "Like a sofa" },
];
const NEXT = [
  ["📮", "You send it to Shipping OS."],
  ["📦", "We receive it."],
  ["🏷️", "We prepare it."],
  ["✈️", "We send it to The Bahamas."],
  ["🙌", "You receive it."],
];

export default function ShipPage() {
  return <Suspense><Wizard /></Suspense>;
}

function Wizard() {
  const sp = useSearchParams();
  const run = useAction();
  const initTo = sp.get("to") as DestinationId | null;
  const initW = Number(sp.get("weight")) || undefined;
  const [step, setStep] = useState(initTo && initW ? 4 : 1);
  const [what, setWhat] = useState<string | undefined>(initTo ? "package" : undefined);
  const [to, setTo] = useState<DestinationId | undefined>(initTo ?? undefined);
  const [weight, setWeight] = useState<number | "">(initW ?? "");
  const [unit, setUnit] = useState<Unit>("lbs");
  const [override, setOverride] = useState<ServiceLevel>();
  const [quote, setQuote] = useState<Quote | null>(null);
  const lbs = weight === "" ? 0 : unit === "kg" ? kgToLbs(weight) : weight;
  const service: ServiceLevel = override ?? (what === "furniture" || lbs > 70 ? "ocean" : "air");
  const go = (n: number) => { setStep(n); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const canNext = (step === 1 && !!what) || (step === 2 && !!to) || (step === 3 && lbs > 0);

  return (
    <CustomerView title="Ship Something">
      {(me, actor) => {
        const est = to && lbs > 0 ? svc.estimate({ destinationId: to, service, actualWeight: lbs }) : null;
        if (quote) {
          return (
            <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
              <div className="animate-pop">
                <p className="text-6xl" aria-hidden>🎉</p>
                <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">You&apos;re all set!</h1>
                <p className="mt-2 text-xl text-ink-soft">Now send your item to your Shipping OS address. That&apos;s the only thing left to do.</p>
                <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-sand-200">
                  <p className="text-sm font-bold uppercase tracking-wider text-ink-mute">Your estimate</p>
                  <p className="mt-1 text-3xl font-black">{fmtUsd(quote.total)} <DemoBadge className="align-middle">Demo</DemoBadge></p>
                  <p className="mt-1 text-ink-soft">Quote {quote.id} · {fmtLb(quote.actualWeight)} to {svc.getDestination(quote.destinationId).name}</p>
                </div>
                <p className="mt-4 text-lg font-semibold text-ink-soft">🔔 We&apos;ll message you on WhatsApp when it arrives.</p>
                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <ButtonLink href="/packages/new" icon="➕">Tell us it&apos;s coming</ButtonLink>
                  <ButtonLink href="/assistant" variant="secondary" icon="💬">Ask Shipping OS</ButtonLink>
                </div>
              </div>
              <ShoppingAddressCard address={svc.shoppingAddress(me)} />
            </div>
          );
        }
        return (
          <div className="mx-auto max-w-2xl">
            <div className="mb-6">
              <div className="flex items-center justify-between text-sm font-bold text-ink-mute">
                <span>Step {step} of 4</span>
                {step > 1 && <button onClick={() => go(step - 1)} className="min-h-11 rounded-xl px-2 text-base text-sea-700 hover:underline">← Back</button>}
              </div>
              <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden>{[1, 2, 3, 4].map((n) => <span key={n} className={`h-2 rounded-full ${n <= step ? "bg-sea-500" : "bg-sand-200"}`} />)}</div>
            </div>
            <div key={step} className="animate-rise">
              {step === 1 && (
                <>
                  <h1 className="text-4xl font-black tracking-tight sm:text-5xl">What are you shipping?</h1>
                  <div className="mt-6 grid gap-3 sm:grid-cols-2">
                    {WHAT.map((w) => <ChoiceButton key={w.id} icon={w.icon} label={w.label} hint={w.hint} selected={what === w.id} onClick={() => { setWhat(w.id); setTimeout(() => go(2), 180); }} />)}
                  </div>
                </>
              )}
              {step === 2 && (<><h1 className="text-4xl font-black tracking-tight sm:text-5xl">Where is it going?</h1><div className="mt-6"><DestinationSelector value={to} onChange={setTo} /></div></>)}
              {step === 3 && (
                <>
                  <h1 className="text-4xl font-black tracking-tight sm:text-5xl">How big is it?</h1>
                  <p className="mt-2 text-lg text-ink-soft">Tap a size, or type the weight if you know it.</p>
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    {SIZES.map((s) => <ChoiceButton key={s.lbs} label={s.label} hint={`${s.hint} · ~${s.lbs} lbs`} selected={unit === "lbs" && weight === s.lbs} onClick={() => { setUnit("lbs"); setWeight(s.lbs); }} />)}
                  </div>
                  <p className="mb-2 mt-6 font-bold text-ink-soft">Or type the weight</p>
                  <WeightInput value={weight} unit={unit} onChange={setWeight} onUnitChange={setUnit} />
                  {what === "unsure" && <p className="mt-4 rounded-2xl bg-sea-50 p-4 text-sea-900">💡 Not sure what it is? No problem. We&apos;ll check it when it arrives and tell you.</p>}
                </>
              )}
              {step === 4 && (
                <>
                  <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Here&apos;s what happens next</h1>
                  <ol className="mt-6 space-y-3">
                    {NEXT.map(([icon, text], i) => (
                      <li key={text} className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-sand-200">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-lg font-black text-white">{i + 1}</span>
                        <span aria-hidden className="text-2xl">{icon}</span>
                        <span className="text-xl font-bold">{text}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-6 rounded-[var(--radius-card)] bg-white p-5 ring-1 ring-sand-200">
                    <h2 className="text-xl font-extrabold">How should it travel?</h2>
                    <div className="mt-3"><ModeSelector value={service} onChange={setOverride} /></div>
                    {est && <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-sand-200 pt-4"><div><p className="font-bold text-ink-mute">{fmtLb(lbs)} to {est.destinationName}</p><p className="text-4xl font-black">{fmtUsd(est.total)}</p></div><DemoBadge>Demo estimate</DemoBadge></div>}
                  </div>
                </>
              )}
            </div>
            {step > 1 && (
              <div className="sticky bottom-20 z-20 mt-8 bg-sand-50/95 py-2 backdrop-blur lg:static lg:bg-transparent">
                {step < 4 ? (
                  <Button size="xl" full disabled={!canNext} onClick={() => go(step + 1)}>Next →</Button>
                ) : (
                  <Button size="xl" full variant="gold" disabled={!est} onClick={() => { const r = run(() => svc.createQuote(actor, { destinationId: to!, service, actualWeight: lbs })); if (r) { setQuote(r.quote); window.scrollTo({ top: 0 }); } }}>
                    Let&apos;s Do It 🚀
                  </Button>
                )}
              </div>
            )}
          </div>
        );
      }}
    </CustomerView>
  );
}
