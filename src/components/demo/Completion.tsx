"use client";

import Link from "next/link";
import { bookDemoHref, whatsappHref } from "@/demo/cta";
import { DEMO_SCENARIOS } from "@/demo/registry";
import type { DemoScenario } from "@/demo/types";
import { MODULES } from "@/platform/modules";
import { Icon } from "./Icon";
import { Button } from "./ui";

export function Completion({ scenario, onRestart, onBack, onExit, headingRef }: { scenario: DemoScenario; onRestart: () => void; onBack: () => void; onExit: () => void; headingRef: React.RefObject<HTMLHeadingElement | null> }) {
  const others = DEMO_SCENARIOS.filter((s) => s.id !== scenario.id);
  return (
    <div className="mx-auto max-w-4xl space-y-6 motion-safe:animate-rise">
      <section className="rounded-lg border border-[#dfe4ea] bg-white p-6 sm:p-8">
        <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wider text-emerald-700"><Icon name="check" className="h-4 w-4" />Tour complete · {scenario.organizationName}</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-2 text-3xl font-black tracking-tight outline-none sm:text-4xl">{scenario.completion.headline}</h1>
        <ul className="mt-5 grid gap-3 sm:grid-cols-2">
          {scenario.completion.points.map((p) => (
            <li key={p} className="flex gap-3 rounded-md bg-[#f6f8fa] p-3 text-[14px]"><Icon name="check" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />{p}</li>
          ))}
        </ul>
        <p className="mt-6 text-[12px] font-bold uppercase tracking-wide text-ink-mute">This workspace ran on {scenario.enabledModules.length} Shipping OS modules</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {scenario.enabledModules.map((m) => <li key={m} className="rounded bg-[#eef1f4] px-2 py-1 text-[12px] font-semibold text-ink-soft">{MODULES[m].label}</li>)}
        </ul>
      </section>

      <section className="rounded-lg bg-ink p-6 text-white sm:p-8">
        <h2 className="text-2xl font-black tracking-tight sm:text-3xl">Ready to see Shipping OS configured around your operation?</h2>
        <p className="mt-2 max-w-2xl text-[15px] text-white/75">Every logistics company works differently. We&apos;ll configure Shipping OS around your workflows, services, islands, routes and team.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href={bookDemoHref(scenario.label)} className="inline-flex min-h-12 items-center gap-2 rounded-md bg-sun-400 px-5 text-[15px] font-black text-ink hover:bg-sun-300"><Icon name="calendar" className="h-5 w-5" />Book a Personalized Demo</a>
          <Button variant="secondary" icon="restart" onClick={onRestart} className="!min-h-12 !bg-transparent !text-white !ring-white/40 hover:!ring-white">Restart Demo</Button>
          <a href={whatsappHref(scenario.label)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-md px-4 text-[15px] font-bold text-white/85 ring-1 ring-white/25 hover:ring-white/60"><Icon name="chat" className="h-5 w-5" />Talk to Us on WhatsApp</a>
        </div>
      </section>

      <section>
        <h2 className="text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">Same platform, different operation — try another</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {others.map((s) => (
            <li key={s.id}>
              <Link href={`/demo?op=${s.id}`} className="flex min-h-14 items-center gap-3 rounded-md border border-[#dfe4ea] bg-white px-3 py-2 hover:border-ink-mute">
                <Icon name={s.icon} className="h-5 w-5 text-sea-700" />
                <span className="min-w-0"><span className="block text-[14px] font-bold">{s.label}</span><span className="block truncate text-[12px] text-ink-mute">{s.organizationName}</span></span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="ghost" icon="arrowLeft" onClick={onBack}>Back to the last step</Button>
          <Button variant="ghost" icon="exit" onClick={onExit}>All operations</Button>
        </div>
      </section>
    </div>
  );
}
