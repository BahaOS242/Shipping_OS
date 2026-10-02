"use client";

/** Tracking timeline and the customer's own portal / WhatsApp view. */
import type { ScreenData } from "@/demo/types";
import { useStep, useStepState } from "../DemoContext";
import { Icon } from "../Icon";
import { Badge, Button, Panel } from "../ui";

export function TimelineScreen({ data }: { data: ScreenData["timeline"] }) {
  const { complete, spot } = useStep();
  const [at, setAt] = useStepState<number>(() => data.startAt);
  const last = data.events.length - 1;
  const delivered = at >= last;
  // Position on the island route comes from the event itself (0 = first place, .5 = between).
  const routePct = Math.round((data.events[at].at / (data.route.length - 1)) * 100);
  const sailing = !Number.isInteger(data.events[at].at);
  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-lg font-black">{data.ref}</p>
            <p className="text-[13px] text-ink-soft">{data.customer} · {data.route.join(" → ")}</p>
          </div>
          <Badge tone={delivered ? "good" : "info"}>{data.events[at].label}</Badge>
        </div>
        {/* Island route */}
        <div className="relative mx-2 mt-6 mb-2 h-14" aria-hidden>
          <div className="absolute inset-x-0 top-3 h-1 rounded bg-[repeating-linear-gradient(90deg,#c9d3dc_0_8px,transparent_8px_14px)]" />
          <div className="absolute left-0 top-3 h-1 rounded bg-sea-500 transition-[width] duration-700" style={{ width: `${routePct}%` }} />
          {data.route.map((place, i) => {
            const left = (i / (data.route.length - 1)) * 100;
            const reached = routePct >= left - 0.5;
            return (
              <div key={place} className="absolute top-0 -translate-x-1/2 text-center" style={{ left: `${left}%` }}>
                <span className={`mx-auto block h-7 w-7 rounded-full border-4 ${reached ? "border-sea-500 bg-white" : "border-[#c9d3dc] bg-white"}`} />
                <span className="mt-1 block whitespace-nowrap text-[12px] font-bold text-ink">{place}</span>
              </div>
            );
          })}
          <span className="absolute top-[-2px] -translate-x-1/2 text-sea-700 transition-[left] duration-700" style={{ left: `${routePct}%` }}>
            <Icon name={sailing ? "ship" : delivered ? "check" : "box"} className="h-6 w-6 rounded bg-white" />
          </span>
        </div>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <Panel title="Timeline">
          <ol className="relative ml-2 border-l-2 border-[#e3e8ee]">
            {data.events.map((e, i) => {
              const done = i <= at;
              const current = i === at;
              return (
                <li key={e.label} className={`relative pb-5 pl-6 last:pb-0 ${done ? "" : "opacity-45"}`} aria-current={current ? "step" : undefined}>
                  <span className={`absolute -left-[9px] top-0.5 grid h-4 w-4 place-items-center rounded-full ${current ? "bg-sea-500 ring-4 ring-sea-100" : done ? "bg-sea-500" : "bg-[#cfd6de]"}`} aria-hidden />
                  <p className="flex flex-wrap items-baseline gap-x-2 text-[14px] font-bold">{e.label}<span className="text-[12px] font-normal text-ink-mute">{done ? e.time : "Pending"}</span></p>
                  <p className="text-[13px] text-ink-soft">{e.place}{done ? ` · ${e.detail}` : ""}</p>
                </li>
              );
            })}
          </ol>
        </Panel>
        <Panel title="Scanner">
          <p className="text-[13px] text-ink-soft">Each scan — at the warehouse, the dock or the door — updates this timeline, the customer&apos;s portal and their WhatsApp thread together.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="accent" icon="arrowRight" className={spot("advance-btn")} disabled={delivered} onClick={() => { setAt(Math.min(last, at + 1)); complete(); }}>
              {delivered ? "Delivered" : `Record: ${data.events[at + 1].label}`}
            </Button>
            {at > data.startAt && <Button variant="ghost" size="sm" onClick={() => setAt(data.startAt)}>Reset scans</Button>}
          </div>
        </Panel>
      </div>
    </div>
  );
}

type PortalState = { tab: "status" | "documents" | "help"; whatsapp: boolean };

export function PortalScreen({ data }: { data: ScreenData["portal"] }) {
  const { complete, spot } = useStep();
  const [s, set] = useStepState<PortalState>(() => ({ tab: "status", whatsapp: false }));
  const tabs = [
    { id: "status", label: "Status" },
    { id: "documents", label: "Documents" },
    { id: "help", label: "Help" },
  ] as const;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      <div className="overflow-hidden rounded-xl border border-[#dfe4ea] bg-sand-50 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2 border-b border-sand-200 bg-white px-4 py-2 text-[12px] text-ink-mute">
          <span className="flex gap-1" aria-hidden><i className="h-2.5 w-2.5 rounded-full bg-[#e3e8ee]" /><i className="h-2.5 w-2.5 rounded-full bg-[#e3e8ee]" /><i className="h-2.5 w-2.5 rounded-full bg-[#e3e8ee]" /></span>
          <span className="min-w-0 truncate rounded bg-[#f4f6f8] px-2 py-0.5">track.{data.brand.toLowerCase().replace(/\s+/g, "")}.com/{data.ref}</span>
          <Badge tone="info">Customer view</Badge>
        </div>
        <div className="p-5">
          <p className="text-[13px] font-bold text-sea-700">{data.brand}</p>
          <h3 className="text-2xl font-black tracking-tight">Hi {data.customer.split(" ")[0]}, here&apos;s {data.ref}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg bg-white p-3 ring-1 ring-sand-200"><p className="text-[11px] font-bold uppercase text-ink-mute">Status</p><p className="font-bold">{data.status}</p></div>
            <div className="rounded-lg bg-white p-3 ring-1 ring-sand-200"><p className="text-[11px] font-bold uppercase text-ink-mute">Estimated arrival</p><p className="font-bold">{data.eta}</p></div>
          </div>
          <div role="tablist" aria-label="Customer portal" className="mt-4 flex gap-1 border-b border-sand-200">
            {tabs.map((t) => (
              <button key={t.id} role="tab" aria-selected={s.tab === t.id} onClick={() => set({ ...s, tab: t.id })} className={`-mb-px min-h-11 border-b-2 px-3 text-[14px] font-bold ${s.tab === t.id ? "border-sea-600 text-sea-700" : "border-transparent text-ink-mute hover:text-ink"}`}>{t.label}</button>
            ))}
          </div>
          <div role="tabpanel" className="pt-4">
            {s.tab === "status" && (
              <ol className="space-y-2">
                {data.progress.map((p) => (
                  <li key={p.label} className="flex items-center gap-3 text-[14px]">
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full ${p.done ? "bg-sea-600 text-white" : "bg-white ring-2 ring-sand-200"}`} aria-hidden>{p.done && <Icon name="check" className="h-3.5 w-3.5" />}</span>
                    <span className={p.done ? "font-semibold" : "text-ink-mute"}>{p.label}</span>
                    <span className="ml-auto text-[12px] text-ink-mute">{p.time}</span>
                  </li>
                ))}
              </ol>
            )}
            {s.tab === "documents" && (
              <ul className="space-y-2">
                {data.documents.map((d) => (
                  <li key={d.name} className="flex items-center gap-3 rounded-lg bg-white p-3 ring-1 ring-sand-200 text-[14px]"><Icon name="doc" className="h-5 w-5 text-ink-mute" /><span className="flex-1 font-semibold">{d.name}</span><span className="text-[12px] text-ink-mute">{d.kind}</span></li>
                ))}
              </ul>
            )}
            {s.tab === "help" && <p className="text-[14px] text-ink-soft">Questions? Reply on WhatsApp or open a request — it goes straight to the team with {data.ref} attached.</p>}
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant="accent" icon="chat" className={spot("whatsapp-btn")} disabled={s.whatsapp} onClick={() => { set({ ...s, whatsapp: true }); complete(); }}>{s.whatsapp ? "WhatsApp updates on" : "Get updates on WhatsApp"}</Button>
            <Button variant="secondary" icon="doc" onClick={() => set({ ...s, tab: "documents" })}>View documents</Button>
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[300px] rounded-[2rem] border-[6px] border-ink bg-wa-bg p-3 shadow-[var(--shadow-lift)]" aria-label="Customer's WhatsApp">
        <p className="mb-3 flex items-center gap-2 rounded-xl bg-wa-dark px-3 py-2 text-[13px] font-bold text-white"><Icon name="chat" className="h-4 w-4" />{data.brand}</p>
        {s.whatsapp ? (
          <p className="motion-safe:animate-rise rounded-lg rounded-tl-none bg-white p-3 text-[13px] leading-snug shadow-sm">{data.whatsapp}<span className="mt-1 block text-right text-[10px] text-ink-mute">just now ✓✓</span></p>
        ) : (
          <p className="rounded-lg bg-white/70 p-3 text-center text-[12px] text-ink-mute">Updates appear here once WhatsApp is on.</p>
        )}
      </div>
    </div>
  );
}
