"use client";

import { useEffect, useRef, useState } from "react";
import { ISLANDS, estimateShipping, fmtLbs, fmtMoney, kgToLbs, DEMO_SHIPPING_RULES } from "@/lib/pricing";
import type { IslandId, ShippingMode } from "@/lib/types";
import { ButtonLink } from "../ui/Button";
import { DemoBadge } from "../ui/DemoBadge";
import { LocationSelector } from "./LocationSelector";
import { ModeSelector } from "./ModeSelector";
import { StepBlock } from "./StepBlock";
import { WeightInput, type Unit } from "./WeightInput";

export type CalculatorInitial = { to?: IslandId; weight?: number; mode?: ShippingMode };

/**
 * Uses the same pure pricing function the calculateShipping tool uses,
 * so the web, the assistant and WhatsApp always agree.
 */
export function ShippingCalculator({ initial }: { initial?: CalculatorInitial }) {
  const [to, setTo] = useState<IslandId | undefined>(initial?.to);
  const [weight, setWeight] = useState<number | "">(initial?.weight ?? 10);
  const [unit, setUnit] = useState<Unit>("lbs");
  const [mode, setMode] = useState<ShippingMode | undefined>(initial?.mode);
  const resultRef = useRef<HTMLDivElement>(null);

  const lbs = weight === "" ? 0 : unit === "kg" ? kgToLbs(weight) : weight;
  const ready = !!to && lbs > 0 && !!mode;
  const est = ready ? estimateShipping({ destination: to!, weight: lbs, mode: mode! }) : null;

  // Bring the answer into view the moment it exists (mobile).
  const wasReady = useRef(ready);
  useEffect(() => {
    if (ready && !wasReady.current) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    wasReady.current = ready;
  }, [ready]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_400px] lg:items-start">
      <div className="space-y-4">
        <StepBlock n={1} title="Where is it going?" done={!!to}>
          <LocationSelector value={to} onChange={setTo} />
        </StepBlock>
        <StepBlock n={2} title="How heavy is it?" done={lbs > 0}>
          <WeightInput value={weight} unit={unit} onChange={setWeight} onUnitChange={setUnit} />
          <p className="mt-3 text-ink-soft">
            Not sure? A shoebox is about <strong>5 lbs</strong>. A microwave is about <strong>30 lbs</strong>.
          </p>
        </StepBlock>
        <StepBlock n={3} title="How should it travel?" done={!!mode}>
          <ModeSelector value={mode} onChange={setMode} />
        </StepBlock>
      </div>

      <div ref={resultRef} className="lg:sticky lg:top-28" aria-live="polite">
        <div className={`rounded-[var(--radius-card)] p-6 transition-all sm:p-7 ${est ? "bg-ink text-white shadow-[var(--shadow-lift)]" : "bg-sand-100 text-ink-soft ring-1 ring-sand-200"}`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-extrabold">Estimated cost</h2>
            <DemoBadge>Demo estimate</DemoBadge>
          </div>
          {est ? (
            <div className="animate-rise">
              <p className="mt-3 text-6xl font-black tracking-tight text-sun-300">{fmtMoney(est.total)}</p>
              <p className="mt-2 text-lg text-white/80">
                {fmtLbs(lbs)} to {ISLANDS[to!].name} by {mode === "air" ? "plane ✈️" : "boat 🚢"} · about {est.transitDays}
              </p>
              <ul className="mt-5 space-y-2 border-t border-white/15 pt-4 text-white/85">
                {est.lines.map((l) => (
                  <li key={l.label} className="flex justify-between gap-4">
                    <span>{l.label}</span>
                    <span className="font-bold">{fmtMoney(l.amount)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 rounded-xl bg-white/10 p-3 text-white/90">&ldquo;Your final price may change depending on the package.&rdquo;</p>
              <div className="mt-5 grid gap-3">
                <ButtonLink href={`/ship?to=${to}&weight=${lbs}`} variant="gold" size="xl" full icon="🚚">
                  Start Shipping
                </ButtonLink>
                <ButtonLink href="/help" variant="secondary" size="lg" full icon="💬" className="!bg-white/10 !text-white !ring-white/20">
                  Ask The Link
                </ButtonLink>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-lg">
              Answer the {!to ? "questions" : !mode ? "last question" : "questions"} and your price shows up here. 👇
            </p>
          )}
        </div>
        <ul className="mt-4 space-y-1 px-2 text-sm text-ink-mute">
          {DEMO_SHIPPING_RULES.disclaimers.map((d) => (
            <li key={d}>• {d}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
