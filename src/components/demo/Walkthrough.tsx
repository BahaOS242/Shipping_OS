"use client";

import { useState } from "react";
import type { DemoScenario } from "@/demo/types";
import { Icon } from "./Icon";
import { Button } from "./ui";

/** "Step 2 of 6" + ● ● ○ ○ ○ ○ — dots jump to a step. */
export function Progress({ scenario, index, finished, done, onGoto, tone = "dark" }: { scenario: DemoScenario; index: number; finished: boolean; done: Record<string, true>; onGoto: (i: number) => void; tone?: "dark" | "light" }) {
  const n = scenario.steps.length;
  return (
    <nav aria-label="Demo progress" className="flex items-center gap-3">
      <span className={`whitespace-nowrap text-[12px] font-bold ${tone === "dark" ? "text-white/80" : "text-ink-soft"}`}>{finished ? "Complete" : `Step ${index + 1} of ${n}`}</span>
      <ol className="flex items-center gap-1.5">
        {scenario.steps.map((s, i) => {
          const filled = finished || i <= index;
          return (
            <li key={s.id}>
              <button
                onClick={() => onGoto(i)}
                aria-label={`Step ${i + 1}: ${s.title}${done[s.id] ? " (done)" : ""}`}
                aria-current={!finished && i === index ? "step" : undefined}
                className={`block h-2.5 rounded-full transition-all duration-300 ${!finished && i === index ? "w-6" : "w-2.5"} ${filled ? (tone === "dark" ? "bg-sun-400" : "bg-sea-600") : tone === "dark" ? "bg-white/25 hover:bg-white/50" : "bg-[#cfd6de] hover:bg-ink-mute"}`}
              />
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Guided walkthrough: what you're looking at, the one thing to try, Back / Next. Bottom sheet on small screens. */
export function Walkthrough({ scenario, index, done, onBack, onNext }: { scenario: DemoScenario; index: number; done: Record<string, true>; onBack: () => void; onNext: () => void }) {
  const [open, setOpen] = useState(false);
  const step = scenario.steps[index];
  const isDone = !!done[step.id];
  const last = index === scenario.steps.length - 1;
  const controls = (
    <div className="flex gap-2">
      <Button variant="secondary" icon="arrowLeft" onClick={onBack} disabled={index === 0} className="flex-1">Back</Button>
      <Button variant={isDone ? "accent" : "primary"} onClick={onNext} className="flex-[1.4]">
        {last ? "Finish" : "Next"}
        <Icon name="arrowRight" className="h-4 w-4" />
      </Button>
    </div>
  );
  return (
    <aside aria-label="Guided walkthrough" className="z-20 border-t border-[#dfe4ea] bg-white shadow-[0_-8px_24px_-12px_rgb(15_29_43/0.25)] max-xl:fixed max-xl:inset-x-0 max-xl:bottom-0 xl:w-[340px] xl:shrink-0 xl:border-l xl:border-t-0 xl:shadow-none">
      <div className="flex h-full flex-col">
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={open ? "Hide step details" : "Show step details"} className="flex min-h-11 items-center justify-between gap-2 px-4 pt-2 text-left xl:hidden">
          <span className="min-w-0 truncate text-[13px] font-bold"><span className="text-ink-mute">Step {index + 1} of {scenario.steps.length} · </span>{step.title}</span>
          <span className="flex shrink-0 items-center gap-1 text-[12px] font-bold text-sea-700">{open ? "Less" : "Why it matters"}<Icon name={open ? "minus" : "plus"} className="h-4 w-4" /></span>
        </button>
        <div className="max-h-[45dvh] overflow-y-auto px-4 pb-2 xl:flex xl:max-h-none xl:flex-1 xl:flex-col xl:px-5 xl:py-6">
          <p className="hidden text-[12px] font-bold uppercase tracking-wider text-ink-mute xl:block">Step {index + 1} of {scenario.steps.length}</p>
          <h2 className="mt-1 hidden text-xl font-black tracking-tight xl:block">{step.title}</h2>
          <p className={`${open ? "block" : "hidden"} mt-1 text-[14px] leading-relaxed text-ink-soft xl:mt-2 xl:block`}>{step.description}</p>
          <div className={`mt-2 rounded-md border px-3 py-2 xl:mt-4 xl:p-3 ${isDone ? "border-emerald-200 bg-emerald-50" : "border-sun-300 bg-sun-50"}`} role="status">
            <p className={`flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide ${isDone ? "text-emerald-800" : "text-sun-700"}`}>
              <Icon name={isDone ? "check" : "arrowRight"} className="h-4 w-4" />
              {isDone ? "Done" : "Try it"}
            </p>
            <p className="mt-1 text-[14px] font-semibold">{step.task}</p>
          </div>
          <ol className="mt-5 hidden space-y-1 xl:block" aria-label="All steps">
            {scenario.steps.map((s, i) => (
              <li key={s.id} className={`flex items-center gap-2 text-[13px] ${i === index ? "font-bold text-ink" : "text-ink-mute"}`}>
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-black ${done[s.id] ? "bg-emerald-500 text-white" : i === index ? "bg-ink text-white" : "bg-[#eef1f4]"}`}>{done[s.id] ? "✓" : i + 1}</span>
                {s.title}
              </li>
            ))}
          </ol>
          <div className="mt-5 hidden xl:mt-auto xl:block xl:pt-6">{controls}</div>
        </div>
        <div className="border-t border-[#eef1f4] px-4 py-3 xl:hidden">{controls}</div>
      </div>
    </aside>
  );
}
