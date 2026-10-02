"use client";

/** Dashboard, receiving, manifest and departure-board screens. */
import type { ScreenData } from "@/demo/types";
import { useStep, useStepState } from "../DemoContext";
import { Icon } from "../Icon";
import { Badge, Button, CapacityMeter, DataTable, Done, KvList, MetricTile, Panel, TONE } from "../ui";
import { useReveal } from "../useReveal";

const kg = (s: string) => Number(s.replace(/,/g, "")) || 0;

/* ---------------- Dashboard ---------------- */

export function DashboardScreen({ data }: { data: ScreenData["dashboard"] }) {
  const { complete, spot } = useStep();
  const [handled, setHandled] = useStepState<string[]>(() => []);
  const open = data.alerts.filter((a) => !handled.includes(a.id));
  return (
    <div className="space-y-4">
      <p className="text-[15px] font-semibold text-ink-soft">{data.heading}</p>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{data.metrics.map((m) => <MetricTile key={m.label} m={m} />)}</div>
      {data.aiSummary && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#dfe4ea] bg-white px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-ink text-sun-400" aria-hidden><Icon name="spark" className="h-4 w-4" /></span>
          <p className="min-w-0 flex-1 text-[14px]"><span className="font-bold">Operations summary · </span>{data.aiSummary}</p>
          <span className="text-[12px] text-ink-mute">{open.length} open</span>
        </div>
      )}
      <div className="grid gap-4 2xl:grid-cols-[1.15fr_1fr]">
        <Panel title={`Needs attention (${open.length})`} pad={false}>
          <ul className="divide-y divide-[#f0f2f5]">
            {data.alerts.map((a, i) => {
              const done = handled.includes(a.id);
              return (
                <li key={a.id} className={`flex gap-3 px-4 py-3 ${done ? "opacity-60" : ""}`}>
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${TONE[a.tone].dot}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">{a.area}</p>
                    <p className="text-[14px] font-bold text-ink">{a.title}</p>
                    <p className="text-[13px] text-ink-soft">{a.detail}</p>
                    {done && <p className="mt-1 text-[12px] font-bold text-emerald-700">✓ Assigned and added to today&apos;s work queue</p>}
                  </div>
                  {!done && (
                    <Button size="sm" variant="secondary" className={`self-start ${i === 0 ? spot("alert-0") : ""}`} onClick={() => { setHandled([...handled, a.id]); complete(); }}>
                      {a.action}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>
        {data.board && <Panel title={data.board.title} pad={false}><DataTable table={data.board} /></Panel>}
      </div>
    </div>
  );
}

/* ---------------- Receiving ---------------- */

type ReceiveState = { received: boolean };

export function ReceiveScreen({ data }: { data: ScreenData["receive"] }) {
  const { complete, spot } = useStep();
  const [s, set] = useStepState<ReceiveState>(() => ({ received: false }));
  const reveal = useReveal(data.packages.length, s.received, 160);
  const total = data.packages.reduce((a, p) => a + p.weightKg, 0);
  const allIn = s.received && !reveal.animating;
  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Panel
        title={<span className="flex items-center gap-2 normal-case tracking-normal"><span className="font-mono text-[15px] text-ink">{data.ref}</span><span className="text-ink-mute">· {data.route}</span></span>}
        action={<Badge tone={allIn ? "good" : s.received ? "info" : "warn"}>{allIn ? "Received" : s.received ? "Receiving…" : "Expected"}</Badge>}
      >
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <p className="text-[14px]"><span className="text-ink-mute">Customer</span> <b>{data.customer}</b></p>
          <p className="text-[14px]"><span className="text-ink-mute">Pieces</span> <b>{data.packages.length}</b></p>
          <p className="text-[14px]"><span className="text-ink-mute">Weight</span> <b>{total} kg</b></p>
        </div>
        <ol className="mt-4 divide-y divide-[#f0f2f5] rounded-md border border-[#eef1f4]">
          {data.packages.map((p, i) => {
            const isIn = i < reveal.visible;
            return (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2 text-[13px]">
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded ${isIn ? "bg-emerald-500 text-white" : "bg-[#eef1f4] text-ink-mute"} transition-colors`} aria-hidden>
                  {isIn ? <Icon name="check" className="h-4 w-4" /> : <Icon name="box" className="h-3.5 w-3.5" />}
                </span>
                <span className="font-mono font-semibold">{p.id}</span>
                <span className="min-w-0 flex-1 truncate text-ink-soft">{p.description}</span>
                <span className="tabular-nums text-ink-soft">{p.weightKg} kg</span>
                <span className="sr-only">{isIn ? "received" : "expected"}</span>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button variant="accent" icon="inbox" className={spot("receive-btn")} disabled={s.received} onClick={() => { set({ received: true }); reveal.start(); complete(); }}>
            {s.received ? "Received" : data.receiveLabel}
          </Button>
          <span className="text-[13px] text-ink-mute">{s.received ? `${Math.min(reveal.visible, data.packages.length)} of ${data.packages.length} checked in` : "Scanner ready · Dock door 2"}</span>
        </div>
      </Panel>
      <div className="space-y-4">
        <Panel title="Shipment details"><KvList items={data.facts} cols={1} /></Panel>
        <Panel title="What happened automatically">
          {allIn ? (
            <ul className="space-y-2">{data.afterReceive.map((x) => <li key={x}><Done>{x}</Done></li>)}</ul>
          ) : (
            <p className="text-[13px] text-ink-mute">Receiving updates stock, tracking, customs and the customer in one step.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- Manifest ---------------- */

type ManifestState = { built: boolean; finalized: boolean };

export function ManifestScreen({ data }: { data: ScreenData["manifest"] }) {
  const { complete, spot } = useStep();
  const [s, set] = useStepState<ManifestState>(() => ({ built: false, finalized: false }));
  const reveal = useReveal(data.lines.length, s.built);
  const shown = data.lines.slice(0, reveal.visible);
  const weight = shown.reduce((a, l) => a + kg(l[data.weightKey]), 0);
  const ready = s.built && !reveal.animating;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-lg border border-[#dfe4ea] bg-white p-4 sm:grid-cols-2 xl:grid-cols-5">
        <div className="xl:col-span-2"><p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Trip</p><p className="font-mono text-lg font-black">{data.trip.ref}</p><p className="text-[13px] text-ink-soft">{data.trip.route}</p></div>
        <div><p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Vessel</p><p className="text-[14px] font-bold">{data.trip.vessel}</p></div>
        <div><p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Departs</p><p className="text-[14px] font-bold">{data.trip.departs}</p></div>
        <div><p className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Cutoff</p><p className="text-[14px] font-bold text-coral-700">{data.trip.cutoff}</p></div>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-sea-200 bg-sea-50 px-4 py-3 text-[14px] text-sea-900">
        <Icon name="spark" className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1"><b>Shipping OS:</b> {data.insight}</span>
        {!s.built && <Button variant="accent" icon="manifest" className={spot("build-btn")} onClick={() => { set({ ...s, built: true }); reveal.start(); }}>{data.buildLabel}</Button>}
      </div>
      <Panel
        title={`Manifest ${s.finalized ? "· closed" : s.built ? "· draft" : ""}`}
        action={<span className="text-[13px] tabular-nums text-ink-soft"><b className="text-ink">{shown.length}</b> lines · <b className="text-ink">{weight.toLocaleString()} kg</b></span>}
        pad={false}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-[13px]">
            <caption className="sr-only">Manifest for {data.trip.ref}</caption>
            <thead>
              <tr className="border-b border-[#eef1f4] text-[11px] font-bold uppercase tracking-wide text-ink-mute">
                <th scope="col" className="w-10 px-4 py-2">#</th>
                {data.columns.map((c) => <th key={c.key} scope="col" className={`px-4 py-2 ${c.numeric ? "text-right" : ""}`}>{c.label}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f5]">
              {shown.map((l, i) => (
                <tr key={i} className="motion-safe:animate-rise">
                  <td className="px-4 py-2 tabular-nums text-ink-mute">{i + 1}</td>
                  {data.columns.map((c, j) => <td key={c.key} className={`px-4 py-2 ${c.numeric ? "text-right tabular-nums" : ""} ${j === 0 ? "font-mono font-semibold" : "text-ink-soft"}`}>{l[c.key]}</td>)}
                </tr>
              ))}
              {!s.built && (
                <tr><td colSpan={data.columns.length + 1} className="px-4 py-8 text-center text-ink-mute">No lines yet — build the manifest from cargo that&apos;s ready for this trip.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      {ready && !s.finalized && (
        <div className="flex flex-wrap items-center gap-3">
          <Button className={spot("build-btn")} icon="check" onClick={() => { set({ ...s, finalized: true }); complete(); }}>{data.finalize.label}</Button>
          <span className="text-[13px] text-ink-mute">Locks the manifest and notifies the vessel.</span>
        </div>
      )}
      {s.finalized && <Done>{data.finalize.done}</Done>}
    </div>
  );
}

/* ---------------- Departure board ---------------- */

export function ScheduleScreen({ data }: { data: ScreenData["schedule"] }) {
  const { complete, spot } = useStep();
  const [departed, setDeparted] = useStepState<string[]>(() => []);
  const statusTone = { Boarding: "info", Scheduled: "neutral", Departed: "good", Delayed: "warn" } as const;
  return (
    <Panel title={data.heading} pad={false}>
      <ul className="divide-y divide-[#f0f2f5]">
        {data.trips.map((t) => {
          const status = departed.includes(t.id) ? "Departed" : t.status;
          const [booked, cap] = t.booked.split("/").map((x) => parseInt(x));
          return (
            <li key={t.id} className="grid gap-3 px-4 py-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2"><span className="whitespace-nowrap font-mono font-bold">{t.id}</span><Badge tone={statusTone[status]}>{status}</Badge></p>
                <p className="text-[14px] font-semibold">{t.route}</p>
                <p className="text-[13px] text-ink-soft"><Icon name="ship" className="mr-1 inline h-4 w-4 align-[-3px]" />{t.vessel} · departs <b>{t.departs}</b> · cargo {t.cargo}</p>
              </div>
              {cap ? <CapacityMeter label="Booked" used={booked} capacity={cap} unit="" /> : <p className="text-[13px] text-ink-soft">{t.booked}</p>}
              <div className="md:text-right">
                {t.status === "Boarding" && status !== "Departed" && (
                  <Button className={spot("depart-btn")} icon="anchor" onClick={() => { setDeparted([...departed, t.id]); complete(); }}>{data.departLabel}</Button>
                )}
                {status === "Departed" && <span className="text-[13px] font-bold text-emerald-700">✓ Departed · customers notified</span>}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}
