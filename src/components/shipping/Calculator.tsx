"use client";

import { useEffect, useRef, useState } from "react";
import { DISCLAIMERS, fmtLb, fmtUsd, kgToLbs } from "@/domain/rates";
import type { DestinationId, ServiceLevel } from "@/domain/types";
import * as svc from "@/services";
import { ButtonLink } from "../ui/Button";
import { DemoBadge } from "../ui/DemoBadge";
import { DestinationSelector } from "./DestinationSelector";
import { ModeSelector } from "./ModeSelector";
import { StepBlock } from "./StepBlock";
import { WeightInput, type Unit } from "./WeightInput";

/** Uses svc.estimate → calculateShipping (central rates engine). No prices live in this component. */
export function Calculator({ initial }: { initial?: { to?: DestinationId; weight?: number; service?: ServiceLevel } }) {
  const [to, setTo] = useState<DestinationId | undefined>(initial?.to);
  const [weight, setWeight] = useState<number | "">(initial?.weight ?? 10);
  const [unit, setUnit] = useState<Unit>("lbs");
  const [dims, setDims] = useState<{ l: string; w: string; h: string }>({ l: "", w: "", h: "" });
  const [service, setService] = useState<ServiceLevel | undefined>(initial?.service);
  const ref = useRef<HTMLDivElement>(null);
  const lbs = weight === "" ? 0 : unit === "kg" ? kgToLbs(weight) : weight;
  const ready = !!to && lbs > 0 && !!service;
  const est = ready ? svc.estimate({ destinationId: to!, service: service!, actualWeight: lbs, length: Number(dims.l) || undefined, width: Number(dims.w) || undefined, height: Number(dims.h) || undefined }) : null;
  const was = useRef(ready);
  useEffect(() => {
    if (ready && !was.current) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    was.current = ready;
  }, [ready]);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_400px] lg:items-start">
      <div className="space-y-4">
        <StepBlock n={1} title="Where is it going?" done={!!to}><DestinationSelector value={to} onChange={setTo} /></StepBlock>
        <StepBlock n={2} title="How heavy is it?" done={lbs > 0}>
          <WeightInput value={weight} unit={unit} onChange={setWeight} onUnitChange={setUnit} />
          <details className="mt-4 rounded-2xl bg-sand-50 p-4">
            <summary className="cursor-pointer font-bold">📏 Add the box size (optional, more accurate)</summary>
            <p className="mt-2 text-sm text-ink-soft">Big, light boxes are priced by size. Enter inches.</p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {(["l", "w", "h"] as const).map((k) => (
                <label key={k} className="block">
                  <span className="mb-1 block text-sm font-bold text-ink-soft">{{ l: "Length", w: "Width", h: "Height" }[k]}</span>
                  <input inputMode="decimal" type="number" min={0} value={dims[k]} onChange={(e) => setDims({ ...dims, [k]: e.target.value })} className="min-h-12 w-full rounded-xl bg-white px-3 text-lg font-bold ring-2 ring-sand-200" />
                </label>
              ))}
            </div>
          </details>
        </StepBlock>
        <StepBlock n={3} title="How should it travel?" done={!!service}><ModeSelector value={service} onChange={setService} /></StepBlock>
      </div>
      <div ref={ref} className="lg:sticky lg:top-28" aria-live="polite">
        <div className={`rounded-[var(--radius-card)] p-6 sm:p-7 ${est ? "bg-ink text-white shadow-[var(--shadow-lift)]" : "bg-sand-100 text-ink-soft ring-1 ring-sand-200"}`}>
          <div className="flex items-center justify-between gap-2"><h2 className="text-xl font-extrabold">Estimated cost</h2><DemoBadge>Demo estimate</DemoBadge></div>
          {est ? (
            <div className="animate-rise">
              <p className="mt-3 text-6xl font-black tracking-tight text-sun-300">{fmtUsd(est.total)}</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-white/60">Billable weight</dt><dd className="font-bold">{fmtLb(est.billableWeight)}</dd></div>
                <div><dt className="text-white/60">Service</dt><dd className="font-bold">{service === "air" ? "✈️ Air" : "🚢 Ocean"}</dd></div>
                <div><dt className="text-white/60">Timing</dt><dd className="font-bold">{est.transit}</dd></div>
              </dl>
              {est.basis === "dimensional" && <p className="mt-2 text-sm text-sun-300">📏 Priced by size ({fmtLb(est.dimensionalWeight)} size-based vs {fmtLb(est.actualWeight)} actual).</p>}
              <ul className="mt-4 space-y-1.5 border-t border-white/15 pt-3 text-white/85">
                {est.lines.map((l) => <li key={l.label} className="flex justify-between gap-4"><span>{l.label}</span><span className="font-bold">{fmtUsd(l.amount)}</span></li>)}
              </ul>
              <p className="mt-4 rounded-xl bg-white/10 p-3">&ldquo;Your final price may change depending on the package.&rdquo;</p>
              <div className="mt-5 grid gap-3">
                <ButtonLink href={`/ship?to=${to}&weight=${lbs}`} variant="gold" size="xl" full icon="🚚">Start Shipping</ButtonLink>
                <ButtonLink href="/assistant" variant="secondary" full icon="💬" className="!bg-white/10 !text-white !ring-white/20">Ask Shipping OS</ButtonLink>
              </div>
            </div>
          ) : <p className="mt-3 text-lg">Answer the questions and your price shows up here. 👇</p>}
        </div>
        <ul className="mt-4 space-y-1 px-2 text-sm text-ink-mute">{DISCLAIMERS.map((d) => <li key={d}>• {d}</li>)}</ul>
      </div>
    </div>
  );
}
