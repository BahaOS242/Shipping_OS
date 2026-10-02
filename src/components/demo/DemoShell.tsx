"use client";

import { useEffect, useRef, useState } from "react";
import type { DemoAction, DemoState } from "@/demo/engine";
import type { DemoScenario } from "@/demo/types";
import { MODULES } from "@/platform/modules";
import { Completion } from "./Completion";
import { StepProvider } from "./DemoContext";
import { Icon } from "./Icon";
import { Screen, defaultTarget } from "./screens";
import { Progress, Walkthrough } from "./Walkthrough";

const initials = (name: string) => name.split(/\s+/).filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join("");

/**
 * A miniature Shipping OS workspace for one scenario: sidebar (drawer on mobile),
 * top bar, notifications, the step's screen, the guided walkthrough and demo controls.
 * Renders any scenario from configuration — no business-type branches.
 */
export function DemoShell({ scenario, state, dispatch, onExit }: { scenario: DemoScenario; state: DemoState; dispatch: (a: DemoAction) => void; onExit: () => void }) {
  const step = scenario.steps[state.stepIndex];
  const [drawer, setDrawer] = useState(false);
  const [bell, setBell] = useState(false);
  const [modulesOpen, setModulesOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Move focus to the new step's heading so keyboard and screen-reader users follow along.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [state.stepIndex, state.finished]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDrawer(false);
        setBell(false);
        setModulesOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (key: string) => {
    const i = scenario.steps.findIndex((s) => s.nav === key);
    setDrawer(false);
    if (i >= 0) {
      setNotice(null);
      dispatch({ type: "goto", index: i });
    } else {
      const label = scenario.sidebarItems.find((x) => x.key === key)?.label;
      setNotice(`${label} is part of your workspace — it's not in this ${scenario.steps.length}-step tour.`);
    }
  };

  const alerts = scenario.steps.find((s) => s.screen.kind === "dashboard");
  const bellItems = alerts?.screen.kind === "dashboard" ? alerts.screen.data.alerts : [];
  const section = scenario.sidebarItems.find((x) => x.key === step.nav)?.label ?? "";

  const sidebar = (
    <div className="flex h-full flex-col bg-ink text-white">
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-sea-600 text-[13px] font-black">{initials(scenario.organizationName)}</span>
        <div className="min-w-0">
          <p className="line-clamp-2 text-[14px] font-extrabold leading-tight">{scenario.organizationName}</p>
          <p className="truncate text-[11px] text-white/55">Shipping OS · {scenario.label}</p>
        </div>
      </div>
      <nav aria-label="Workspace" className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-0.5">
          {scenario.sidebarItems.map((item) => {
            const active = !state.finished && item.key === step.nav;
            const inTour = scenario.steps.some((s) => s.nav === item.key);
            return (
              <li key={item.key}>
                <button
                  onClick={() => go(item.key)}
                  aria-current={active ? "page" : undefined}
                  className={`relative flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-left text-[13px] font-semibold transition-colors ${active ? "bg-white/12 text-white" : "text-white/65 hover:bg-white/6 hover:text-white"}`}
                >
                  {active && <span className="absolute inset-y-1.5 left-0 w-1 rounded-r bg-sun-400" aria-hidden />}
                  <Icon name={item.icon} className="h-[18px] w-[18px]" />
                  <span className="flex-1">{item.label}</span>
                  {inTour && !active && <span className="h-1.5 w-1.5 rounded-full bg-sea-400" aria-label="in this tour" />}
                </button>
              </li>
            );
          })}
        </ul>
        {notice && <p role="status" className="mx-1 mt-3 rounded-md bg-white/8 p-2.5 text-[12px] text-white/80">{notice}</p>}
      </nav>
      <div className="relative border-t border-white/10 p-3">
        <button onClick={() => setModulesOpen((o) => !o)} aria-expanded={modulesOpen} className="flex min-h-10 w-full items-center gap-2 rounded-md px-2 text-left text-[12px] font-semibold text-white/70 hover:bg-white/6">
          <Icon name="grid" className="h-4 w-4" />
          {scenario.enabledModules.length} modules enabled
        </button>
        {modulesOpen && (
          <div className="absolute bottom-full left-3 right-3 mb-2 max-h-72 overflow-y-auto rounded-md bg-white p-3 text-ink shadow-[var(--shadow-lift)]">
            <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Configured for a {scenario.label.toLowerCase()}</p>
            <ul className="mt-2 space-y-1 text-[12px]">{scenario.enabledModules.map((m) => <li key={m} className="flex items-center gap-2"><Icon name="check" className="h-3.5 w-3.5 text-emerald-600" />{MODULES[m].label}</li>)}</ul>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh flex-col bg-[#f4f6f8]">
      {/* Demo controls — always visible */}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-[#0a1520] px-3 py-1.5 text-white sm:px-4">
        <p className="flex items-center gap-2 text-[12px]"><span className="rounded bg-sun-400 px-1.5 py-0.5 text-[10px] font-black tracking-wider text-ink">INTERACTIVE DEMO</span><span className="hidden text-white/60 md:inline">Simulated data · nothing here touches a real system</span></p>
        <Progress scenario={scenario} index={state.stepIndex} finished={state.finished} done={state.done} onGoto={(i) => dispatch({ type: "goto", index: i })} />
        <div className="flex items-center gap-1">
          <button onClick={() => dispatch({ type: "restart" })} className="flex min-h-9 items-center gap-1.5 rounded px-2 text-[12px] font-bold text-white/80 hover:bg-white/10"><Icon name="restart" className="h-4 w-4" /><span className="max-sm:sr-only">Restart</span></button>
          <button onClick={onExit} className="flex min-h-9 items-center gap-1.5 rounded px-2 text-[12px] font-bold text-white/80 hover:bg-white/10"><Icon name="exit" className="h-4 w-4" /><span className="max-sm:sr-only">Exit demo</span></button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="hidden w-60 shrink-0 lg:block">{sidebar}</div>
        {drawer && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Workspace menu">
            <div className="absolute inset-0 bg-ink/50" aria-hidden onClick={() => setDrawer(false)} />
            <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] motion-safe:animate-rise">
              {sidebar}
              <button autoFocus onClick={() => setDrawer(false)} aria-label="Close menu" className="absolute right-2 top-3 grid h-10 w-10 place-items-center rounded-md text-white/80 hover:bg-white/10"><Icon name="close" /></button>
            </div>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* App top bar */}
          <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[#dfe4ea] bg-white px-3 sm:px-5">
            <button className="grid h-10 w-10 place-items-center rounded-md ring-1 ring-[#dfe4ea] lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu" aria-expanded={drawer}><Icon name="menu" /></button>
            <p className="min-w-0 truncate text-[13px] text-ink-mute"><span className="hidden sm:inline">{scenario.organizationName} › </span><b className="text-ink">{state.finished ? "Tour complete" : section}</b></p>
            <div className="ml-auto hidden min-w-0 max-w-xs flex-1 items-center gap-2 rounded-md bg-[#f4f6f8] px-3 py-2 text-[13px] text-ink-mute ring-1 ring-[#e3e8ee] md:flex" aria-hidden>
              <Icon name="search" className="h-4 w-4" /><span className="truncate">Search shipments, trips, customers…</span>
            </div>
            <div className="relative ml-auto md:ml-0">
              <button onClick={() => setBell((b) => !b)} aria-expanded={bell} aria-label={`Notifications, ${bellItems.length} new`} className="relative grid h-10 w-10 place-items-center rounded-md ring-1 ring-[#dfe4ea]">
                <Icon name="bell" />
                {bellItems.length > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-coral-500 px-1 text-[10px] font-black text-white">{bellItems.length}</span>}
              </button>
              {bell && (
                <div className="absolute right-0 top-full z-30 mt-2 w-80 max-w-[90vw] rounded-md border border-[#dfe4ea] bg-white shadow-[var(--shadow-lift)]">
                  <p className="border-b border-[#eef1f4] px-4 py-2 text-[12px] font-bold uppercase tracking-wide text-ink-mute">Notifications</p>
                  <ul className="max-h-72 divide-y divide-[#f0f2f5] overflow-y-auto">
                    {bellItems.map((a) => <li key={a.id} className="px-4 py-2.5 text-[13px]"><p className="font-bold">{a.title}</p><p className="text-ink-mute">{a.area}</p></li>)}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-sun-400 text-[12px] font-black" aria-hidden>{initials(scenario.user.name)}</span>
              <span className="hidden leading-tight xl:block"><span className="block text-[13px] font-bold">{scenario.user.name}</span><span className="block text-[11px] text-ink-mute">{scenario.user.role}</span></span>
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            <main id="main" className="min-w-0 flex-1 overflow-y-auto px-3 pb-52 pt-5 sm:px-6 xl:pb-10">
              {state.finished ? (
                <Completion headingRef={heading} scenario={scenario} onRestart={() => dispatch({ type: "restart" })} onBack={() => dispatch({ type: "back" })} onExit={onExit} />
              ) : (
                <div key={step.id} data-screen={step.screen.kind} className="mx-auto max-w-[1180px] motion-safe:animate-rise">
                  <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <p className="text-[12px] font-bold uppercase tracking-wider text-ink-mute">{section}</p>
                      <h1 ref={heading} tabIndex={-1} className="text-2xl font-black tracking-tight outline-none sm:text-[28px]">{step.title}</h1>
                    </div>
                  </div>
                  <StepProvider
                    value={{
                      stepId: step.id,
                      done: !!state.done[step.id],
                      highlight: step.highlight ?? defaultTarget(step.screen),
                      state: state.screens[step.id],
                      setState: (value) => dispatch({ type: "screen", stepId: step.id, value }),
                      complete: () => dispatch({ type: "complete", stepId: step.id }),
                    }}
                  >
                    <Screen config={step.screen} />
                  </StepProvider>
                </div>
              )}
            </main>
            {!state.finished && <Walkthrough scenario={scenario} index={state.stepIndex} done={state.done} onBack={() => dispatch({ type: "back" })} onNext={() => dispatch({ type: "next" })} />}
          </div>
        </div>
      </div>
    </div>
  );
}
