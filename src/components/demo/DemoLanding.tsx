"use client";

import Link from "next/link";
import { bookDemoHref } from "@/demo/cta";
import { DEMO_SCENARIOS } from "@/demo/registry";
import type { DemoScenario } from "@/demo/types";
import { MODULES, type ModuleId } from "@/platform/modules";
import { LogoMark } from "../ui/Logo";
import { Icon } from "./Icon";
import { Badge, CapacityMeter } from "./ui";

/** Modules shown in the "one platform" matrix (the rest are listed per workspace inside the demo). */
const MATRIX: ModuleId[] = ["shipments", "warehouse", "customs", "manifest", "tracking", "vessels", "schedules", "capacity", "booking", "delivery", "driver_portal", "billing", "customer_portal"];

function ScenarioCard({ s }: { s: DemoScenario }) {
  return (
    <li className="flex">
      <article className="flex w-full flex-col rounded-lg border border-[#dfe4ea] bg-white p-5 transition-shadow hover:shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-md bg-ink text-white" aria-hidden><Icon name={s.icon} className="h-6 w-6" /></span>
          <div>
            <h3 className="text-lg font-black tracking-tight">{s.label}</h3>
            <p className="text-[12px] text-ink-mute">{s.enabledModules.length} modules · {s.steps.length}-step tour</p>
          </div>
        </div>
        <p className="mt-3 text-[14px] text-ink-soft">{s.cardDescription}</p>
        <p className="mt-4 text-[11px] font-bold uppercase tracking-wide text-ink-mute">Example workflow</p>
        <ol className="mt-1.5 flex flex-wrap items-center gap-1 text-[12px] font-semibold text-ink">
          {s.exampleWorkflow.map((w, i) => (
            <li key={w} className="flex items-center gap-1">
              <span className="rounded bg-[#eef1f4] px-1.5 py-0.5">{w}</span>
              {i < s.exampleWorkflow.length - 1 && <Icon name="arrowRight" className="h-3 w-3 text-ink-mute" />}
            </li>
          ))}
        </ol>
        <Link href={`/demo?op=${s.id}`} className="mt-5 inline-flex min-h-11 items-center justify-between gap-2 self-stretch rounded-md bg-ink px-4 text-[14px] font-bold text-white hover:bg-[#1d3044]" aria-label={`Explore the ${s.label} demo`}>
          Explore
          <Icon name="arrowRight" className="h-4 w-4" />
        </Link>
      </article>
    </li>
  );
}

/** A small, honest slice of the product: today's sailings out of Potter's Cay. */
function HeroPanel() {
  const rows = [
    { trip: "TRP-2214", route: "Nassau → Eleuthera", vessel: "MV Island Express", time: "8:00 AM", used: 1284, cap: 1650, status: "Boarding" as const },
    { trip: "TRP-2216", route: "Nassau → Fresh Creek, Andros", vessel: "MV Andros Runner", time: "10:30 AM", used: 610, cap: 1500, status: "Scheduled" as const },
    { trip: "TRP-2215", route: "Nassau → George Town, Exuma", vessel: "MV Exuma Pride", time: "6:00 PM", used: 2410, cap: 4500, status: "Weather watch" as const },
  ];
  return (
    <div className="rounded-lg border border-[#dfe4ea] bg-white shadow-[var(--shadow-lift)]" aria-label="Example: today's sailings">
      <div className="flex items-center justify-between border-b border-[#eef1f4] px-4 py-3">
        <p className="text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">Potter&apos;s Cay Dock · today</p>
        <span className="text-[12px] text-ink-mute">3 sailings · 100 bookings</span>
      </div>
      <ul className="divide-y divide-[#f0f2f5]">
        {rows.map((r) => (
          <li key={r.trip} className="space-y-2 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[13px] font-bold">{r.trip}</span>
              <Badge tone={r.status === "Boarding" ? "info" : r.status === "Weather watch" ? "warn" : "neutral"}>{r.status}</Badge>
              <span className="ml-auto text-[13px] font-bold">{r.time}</span>
            </div>
            <p className="text-[13px] text-ink-soft">{r.route} · {r.vessel}</p>
            <CapacityMeter label="Cargo" used={r.used} capacity={r.cap} unit="kg" />
          </li>
        ))}
      </ul>
      <p className="flex items-center gap-2 border-t border-[#eef1f4] bg-[#f6f8fa] px-4 py-2.5 text-[12px] text-ink-soft"><Icon name="chat" className="h-4 w-4 text-wa-teal" />38 customers updated on WhatsApp this morning</p>
    </div>
  );
}

export function DemoLanding() {
  return (
    <div className="min-h-dvh bg-[#f4f6f8] text-ink">
      <a href="#operations" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:p-3">Skip to operations</a>
      <header className="border-b border-[#dfe4ea] bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/demo" className="flex items-center gap-2.5" aria-label="Shipping OS"><LogoMark className="h-8 w-8" /><span className="text-lg font-extrabold tracking-tight">SHIPPING OS</span></Link>
          <nav aria-label="Demo" className="flex items-center gap-1 text-[14px] font-semibold">
            <a href="#how" className="hidden min-h-10 items-center rounded-md px-3 text-ink-soft hover:text-ink sm:inline-flex">How it works</a>
            <a href="#operations" className="hidden min-h-10 items-center rounded-md px-3 text-ink-soft hover:text-ink sm:inline-flex">Operations</a>
            <a href={bookDemoHref()} className="inline-flex min-h-10 items-center rounded-md bg-ink px-4 font-bold text-white hover:bg-[#1d3044]">Book a demo</a>
          </nav>
        </div>
      </header>

      <main>
        <section aria-labelledby="hero-title" className="border-b border-[#dfe4ea] bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[1.15fr_1fr] lg:items-center">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-sea-700">Logistics operating system · The Bahamas & the Caribbean</p>
              <h1 id="hero-title" className="mt-3 text-[2.4rem] font-black leading-[1.05] tracking-tight sm:text-[3.4rem]">One operating system for your entire logistics operation.</h1>
              <p className="mt-4 max-w-xl text-lg text-ink-soft">Shipping OS brings shipments, warehousing, transport, deliveries, billing and AI into one system — built for the realities of Caribbean logistics.</p>
              <div className="mt-7 flex flex-wrap gap-3">
                <a href="#operations" className="inline-flex min-h-12 items-center gap-2 rounded-md bg-sea-600 px-5 text-[15px] font-black text-white hover:bg-sea-700">Explore Your Operation <Icon name="arrowRight" className="h-4 w-4" /></a>
                <a href="#how" className="inline-flex min-h-12 items-center rounded-md px-5 text-[15px] font-bold text-ink ring-1 ring-[#cfd6de] hover:ring-ink-mute">See How It Works</a>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-ink-soft">
                {["Islands, ports & inter-island routes", "WhatsApp-first customer updates", "Works with patchy connectivity"].map((t) => <li key={t} className="flex items-center gap-2"><Icon name="check" className="h-4 w-4 text-sea-600" />{t}</li>)}
              </ul>
            </div>
            <HeroPanel />
          </div>
        </section>

        <section id="operations" aria-labelledby="ops-title" className="mx-auto max-w-6xl scroll-mt-4 px-4 py-14 sm:px-6">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-ink-mute">Interactive demo · about 3 minutes</p>
          <h2 id="ops-title" className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Choose your operation</h2>
          <p className="mt-2 max-w-2xl text-ink-soft">Step into a working Shipping OS configured for your kind of business. Receive cargo, build a manifest, fill a sailing, dispatch a driver — click through it yourself.</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{DEMO_SCENARIOS.map((s) => <ScenarioCard key={s.id} s={s} />)}</ul>
        </section>

        <section id="how" aria-labelledby="how-title" className="scroll-mt-4 border-t border-[#dfe4ea] bg-white">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2 id="how-title" className="text-3xl font-black tracking-tight sm:text-4xl">Not six products. One platform, configured.</h2>
            <p className="mt-2 max-w-2xl text-ink-soft">Every operation runs on the same Shipping OS core. What changes is which modules are switched on — and the workflows, routes and team you configure around them.</p>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                { n: "1", t: "Pick your operation", d: "Forwarder, mailboat, courier, warehouse, charter — or all of it." },
                { n: "2", t: "We switch on your modules", d: "Vessels and capacity for a mailboat. Receiving and customs for a forwarder. Drivers and proof of delivery for a courier." },
                { n: "3", t: "Your team works one system", d: "Dispatch, dock, warehouse, accounts and your customers — the same records, live." },
              ].map((x) => (
                <li key={x.n} className="rounded-lg border border-[#dfe4ea] p-5">
                  <span className="grid h-8 w-8 place-items-center rounded-md bg-ink text-[14px] font-black text-white">{x.n}</span>
                  <h3 className="mt-3 text-lg font-black">{x.t}</h3>
                  <p className="mt-1 text-[14px] text-ink-soft">{x.d}</p>
                </li>
              ))}
            </ol>
            <div className="mt-10 overflow-x-auto rounded-lg border border-[#dfe4ea]">
              <table className="w-full min-w-[760px] text-left text-[13px]">
                <caption className="border-b border-[#eef1f4] px-4 py-3 text-left text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">Modules each operation starts with</caption>
                <thead>
                  <tr className="border-b border-[#eef1f4] bg-[#f6f8fa]">
                    <th scope="col" className="px-4 py-2 font-bold">Module</th>
                    {DEMO_SCENARIOS.map((s) => <th key={s.id} scope="col" className="px-3 py-2 text-center font-bold">{s.label}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f2f5]">
                  {MATRIX.map((m) => (
                    <tr key={m}>
                      <th scope="row" className="px-4 py-2 font-semibold">{MODULES[m].label}</th>
                      {DEMO_SCENARIOS.map((s) => (
                        <td key={s.id} className="px-3 py-2 text-center">
                          {s.enabledModules.includes(m) ? <Icon name="check" className="mx-auto h-4 w-4 text-sea-600" label="Included" /> : <span className="text-[#cfd6de]" aria-label="Not included">—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-lg bg-ink p-6 text-white sm:p-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-black tracking-tight sm:text-3xl">See it configured around your routes and team.</h2>
              <p className="mt-2 text-white/75">We&apos;ll set up Shipping OS with your islands, vessels, services and workflows — and walk your team through it.</p>
            </div>
            <a href={bookDemoHref()} className="inline-flex min-h-12 items-center gap-2 rounded-md bg-sun-400 px-5 text-[15px] font-black text-ink hover:bg-sun-300"><Icon name="calendar" className="h-5 w-5" />Book a Personalized Demo</a>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#dfe4ea] bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-[13px] text-ink-mute sm:px-6">
          <p>Shipping OS · interactive product demo. All companies, people and figures in the demo are simulated.</p>
          <Link href="/" className="font-semibold text-sea-700 hover:underline">See a live customer site built on Shipping OS →</Link>
        </div>
      </footer>
    </div>
  );
}
