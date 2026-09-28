"use client";

import { useState, useTransition } from "react";
import { createQuoteAction } from "@/app/(customer)/ship/actions";
import { ISLANDS, estimateShipping, fmtLbs, fmtMoney, kgToLbs } from "@/lib/pricing";
import type { IslandId, ShippingMode, ShoppingAddress } from "@/lib/types";
import { ShoppingAddressCard } from "../account/ShoppingAddressCard";
import { Button, ButtonLink } from "../ui/Button";
import { DemoBadge } from "../ui/DemoBadge";
import { ChoiceButton } from "./ChoiceButton";
import { LocationSelector } from "./LocationSelector";
import { ModeSelector } from "./ModeSelector";
import { WeightInput, type Unit } from "./WeightInput";

const WHAT = [
  { id: "package", icon: "📦", label: "Package", hint: "Clothes, shoes, household things" },
  { id: "furniture", icon: "🛋️", label: "Furniture", hint: "Chairs, tables, beds" },
  { id: "electronics", icon: "📺", label: "Electronics", hint: "TVs, laptops, phones" },
  { id: "business", icon: "🏢", label: "Business Items", hint: "Stock and supplies for your business" },
  { id: "unsure", icon: "❓", label: "I'm not sure", hint: "That's okay — we'll help" },
] as const;

type What = (typeof WHAT)[number]["id"];

const SIZES = [
  { lbs: 5, label: "Small", hint: "Like a shoebox" },
  { lbs: 30, label: "Medium", hint: "Like a microwave" },
  { lbs: 60, label: "Large", hint: "Like a big TV" },
  { lbs: 150, label: "Very large", hint: "Like a sofa" },
];

const NEXT = [
  { icon: "📮", text: "You send it to The Link." },
  { icon: "📦", text: "We receive it." },
  { icon: "🏷️", text: "We prepare it." },
  { icon: "✈️", text: "We send it to The Bahamas." },
  { icon: "🙌", text: "You receive it." },
];

export function ShipWizard({ address, initial }: { address: ShoppingAddress; initial?: { to?: IslandId; weight?: number } }) {
  const [step, setStep] = useState(initial?.to && initial?.weight ? 4 : 1);
  const [what, setWhat] = useState<What | undefined>(initial?.to ? "package" : undefined);
  const [to, setTo] = useState<IslandId | undefined>(initial?.to);
  const [weight, setWeight] = useState<number | "">(initial?.weight ?? "");
  const [unit, setUnit] = useState<Unit>("lbs");
  const [modeOverride, setModeOverride] = useState<ShippingMode>();
  const [quote, setQuote] = useState<{ id: string; total: number } | null>(null);
  const [pending, startTransition] = useTransition();

  const lbs = weight === "" ? 0 : unit === "kg" ? kgToLbs(weight) : weight;
  const mode: ShippingMode = modeOverride ?? (what === "furniture" || lbs > 70 ? "sea" : "air");
  const est = to && lbs > 0 ? estimateShipping({ destination: to, weight: lbs, mode }) : null;

  const canNext = (step === 1 && !!what) || (step === 2 && !!to) || (step === 3 && lbs > 0);
  const go = (n: number) => {
    setStep(n);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (quote) {
    return (
      <div className="mx-auto grid max-w-4xl gap-6 lg:grid-cols-2">
        <div className="animate-pop">
          <p className="text-6xl" aria-hidden>
            🎉
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl">You&apos;re all set!</h1>
          <p className="mt-2 text-xl text-ink-soft">Now send your item to your The Link address. That&apos;s the only thing left to do.</p>
          <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-sand-200">
            <p className="text-sm font-bold uppercase tracking-wider text-ink-mute">Your quote</p>
            <p className="mt-1 text-3xl font-black">
              {fmtMoney(quote.total)} <DemoBadge className="align-middle">Demo</DemoBadge>
            </p>
            <p className="mt-1 text-ink-soft">
              Quote number <strong>{quote.id.toUpperCase()}</strong> · {fmtLbs(lbs)} to {ISLANDS[to!].name}
            </p>
          </div>
          <p className="mt-4 flex items-center gap-2 text-lg font-semibold text-ink-soft">
            <span aria-hidden>🔔</span> We&apos;ll message you on WhatsApp when it arrives.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <ButtonLink href="/packages" icon="📦">
              My Packages
            </ButtonLink>
            <ButtonLink href="/help" variant="secondary" icon="💬">
              Ask The Link
            </ButtonLink>
          </div>
        </div>
        <ShoppingAddressCard address={address} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm font-bold text-ink-mute">
          <span>Step {step} of 4</span>
          {step > 1 && (
            <button onClick={() => go(step - 1)} className="min-h-11 rounded-xl px-2 text-base text-sea-700 hover:underline">
              ← Back
            </button>
          )}
        </div>
        <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden>
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={`h-2 rounded-full ${n <= step ? "bg-sea-500" : "bg-sand-200"}`} />
          ))}
        </div>
      </div>

      <div key={step} className="animate-rise">
        {step === 1 && (
          <>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">What are you shipping?</h1>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {WHAT.map((w) => (
                <ChoiceButton
                  key={w.id}
                  icon={w.icon}
                  label={w.label}
                  hint={w.hint}
                  selected={what === w.id}
                  onClick={() => {
                    setWhat(w.id);
                    setTimeout(() => go(2), 180);
                  }}
                />
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Where is it going?</h1>
            <div className="mt-6">
              <LocationSelector value={to} onChange={setTo} />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">How big is it?</h1>
            <p className="mt-2 text-lg text-ink-soft">Tap a size, or type the weight if you know it.</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              {SIZES.map((s) => (
                <ChoiceButton
                  key={s.lbs}
                  label={s.label}
                  hint={`${s.hint} · ~${s.lbs} lbs`}
                  selected={unit === "lbs" && weight === s.lbs}
                  onClick={() => {
                    setUnit("lbs");
                    setWeight(s.lbs);
                  }}
                />
              ))}
            </div>
            <p className="mb-2 mt-6 font-bold text-ink-soft">Or type the weight</p>
            <WeightInput value={weight} unit={unit} onChange={setWeight} onUnitChange={setUnit} />
            {what === "unsure" && (
              <p className="mt-4 rounded-2xl bg-sea-50 p-4 text-sea-900">
                <span aria-hidden>💡</span> Not sure what it is? No problem. We&apos;ll check it when it arrives and tell you.
              </p>
            )}
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Here&apos;s what happens next</h1>
            <ol className="mt-6 space-y-3">
              {NEXT.map((n, i) => (
                <li key={n.text} className="flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-sand-200">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-lg font-black text-white">{i + 1}</span>
                  <span aria-hidden className="text-2xl">
                    {n.icon}
                  </span>
                  <span className="text-xl font-bold">{n.text}</span>
                </li>
              ))}
            </ol>

            <div className="mt-6 rounded-[var(--radius-card)] bg-white p-5 ring-1 ring-sand-200 sm:p-6">
              <h2 className="text-xl font-extrabold">How should it travel?</h2>
              <div className="mt-3">
                <ModeSelector value={mode} onChange={setModeOverride} />
              </div>
              {est && (
                <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-sand-200 pt-4">
                  <div>
                    <p className="font-bold text-ink-mute">
                      {fmtLbs(lbs)} to {ISLANDS[to!].name}
                    </p>
                    <p className="text-4xl font-black">{fmtMoney(est.total)}</p>
                  </div>
                  <DemoBadge>Demo estimate</DemoBadge>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Sticky primary action */}
      {step > 1 && (
        <div className="sticky bottom-20 z-20 mt-8 bg-sand-50/95 py-2 backdrop-blur lg:static lg:bg-transparent">
          {step < 4 ? (
            <Button size="xl" full disabled={!canNext} onClick={() => go(step + 1)}>
              Next <span aria-hidden>→</span>
            </Button>
          ) : (
            <Button
              size="xl"
              full
              variant="gold"
              disabled={pending || !est}
              onClick={() =>
                startTransition(async () => {
                  const q = await createQuoteAction({ destination: to!, weight: lbs, mode });
                  setQuote(q);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                })
              }
            >
              {pending ? "One moment…" : "Let's Do It"} <span aria-hidden>🚀</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
