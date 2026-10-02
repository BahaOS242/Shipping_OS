"use client";

/** Vessel, bookings and capacity screens. */
import type { ScreenData } from "@/demo/types";
import { useStep, useStepState } from "../DemoContext";
import { Icon } from "../Icon";
import { Badge, Button, CapacityMeter, DataTable, Done, KvList, Panel } from "../ui";

/* ---------------- Vessel ---------------- */

export function VesselScreen({ data }: { data: ScreenData["vessel"] }) {
  const { complete, spot } = useStep();
  const [s, set] = useStepState<{ checked: number[]; ready: boolean }>(() => ({ checked: [], ready: false }));
  const all = s.checked.length === data.checklist.length;
  const toggle = (i: number) => set({ ...s, checked: s.checked.includes(i) ? s.checked.filter((x) => x !== i) : [...s.checked, i] });
  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
      <div className="space-y-4">
        <Panel>
          <div className="flex flex-wrap items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-lg bg-ink text-white" aria-hidden><Icon name="ship" className="h-7 w-7" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-xl font-black">{data.name}</p>
              <p className="text-[13px] text-ink-soft">{data.kind}</p>
            </div>
            <Badge tone={s.ready ? "good" : "info"}>{s.ready ? "Boarding" : "Ready"}</Badge>
          </div>
          <div className="mt-4"><KvList items={data.facts} cols={3} /></div>
        </Panel>
        <Panel title={data.trips.title} pad={false}><DataTable table={data.trips} /></Panel>
      </div>
      <Panel title="Pre-departure checklist" action={<span className="text-[13px] tabular-nums text-ink-soft">{s.checked.length}/{data.checklist.length}</span>}>
        <ul className={`space-y-1 rounded-md ${spot("checklist")}`}>
          {data.checklist.map((c, i) => (
            <li key={c}>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-[14px] hover:bg-[#f6f8fa]">
                <input type="checkbox" className="h-5 w-5 accent-[var(--color-sea-600)]" checked={s.checked.includes(i)} disabled={s.ready} onChange={() => toggle(i)} />
                <span className={s.checked.includes(i) ? "text-ink" : "text-ink-soft"}>{c}</span>
              </label>
            </li>
          ))}
        </ul>
        <div className="mt-4 space-y-3">
          {!s.ready && (
            <div className="flex flex-wrap gap-2">
              <Button variant="accent" icon="check" disabled={!all} onClick={() => { set({ ...s, ready: true }); complete(); }}>{data.readyLabel}</Button>
              {!all && <Button variant="ghost" size="sm" onClick={() => set({ ...s, checked: data.checklist.map((_, i) => i) })}>Check all</Button>}
            </div>
          )}
          {s.ready && <Done>{data.name} is ready for boarding. Crew and dock team notified; boarding opens on the departure board.</Done>}
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- Bookings / queue ---------------- */

export function BookingsScreen({ data }: { data: ScreenData["bookings"] }) {
  const { complete, spot } = useStep();
  const [s, set] = useStepState<{ open: string | null; confirmed: string[] }>(() => ({ open: null, confirmed: [] }));
  const statusOf = (id: string, base: string) => (s.confirmed.includes(id) ? "confirmed" : base);
  const open = data.items.find((i) => i.id === s.open);
  const firstPending = data.items.find((i) => i.status === "pending")?.id;
  const label = { pending: "Pending", confirmed: "Confirmed", ready: "Ready" } as const;
  const tone = { pending: "warn", confirmed: "good", ready: "good" } as const;
  const pendingCount = data.items.filter((i) => statusOf(i.id, i.status) === "pending").length;
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Panel title={data.heading} action={<span className="text-[13px] text-ink-soft">{data.items.length} total · <b className="text-sun-700">{pendingCount} pending</b></span>} pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[13px]">
            <caption className="sr-only">{data.heading}</caption>
            <thead>
              <tr className="border-b border-[#eef1f4] text-[11px] font-bold uppercase tracking-wide text-ink-mute">
                <th scope="col" className="px-4 py-2">Ref</th>
                {data.columns.map((c) => <th key={c} scope="col" className="px-4 py-2">{c}</th>)}
                <th scope="col" className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f0f2f5]">
              {data.items.map((it) => {
                const st = statusOf(it.id, it.status);
                return (
                  <tr key={it.id} className={s.open === it.id ? "bg-sea-50/60" : "hover:bg-[#f8fafb]"}>
                    <td className="px-4 py-1.5">
                      <button onClick={() => set({ ...s, open: it.id })} aria-label={`Open ${it.id}, ${it.title}`} className={`min-h-9 whitespace-nowrap rounded px-1 font-mono font-bold text-sea-700 underline-offset-2 hover:underline ${it.id === firstPending ? spot("open-booking") : ""}`}>{it.id}</button>
                    </td>
                    {it.cells.map((c, j) => <td key={j} className="px-4 py-1.5 text-ink-soft">{c}</td>)}
                    <td className="px-4 py-1.5"><Badge tone={tone[st as keyof typeof tone]}>{label[st as keyof typeof label]}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title={open ? `${open.id} · ${open.title}` : "Details"}>
        {!open ? (
          <p className="text-[13px] text-ink-mute">Open a record to see everything about it — contact, cargo, payment and notes.</p>
        ) : (
          <div className="space-y-4 motion-safe:animate-rise">
            <KvList items={[...data.columns.map((c, i) => ({ label: c, value: open.cells[i] })), ...open.detail]} />
            {open.note && <p className="rounded-md bg-sun-50 px-3 py-2 text-[13px] text-sun-700 ring-1 ring-sun-300">{open.note}</p>}
            {statusOf(open.id, open.status) === "pending" ? (
              <Button variant="accent" icon="check" onClick={() => { set({ ...s, confirmed: [...s.confirmed, open.id] }); complete(); }}>{data.confirmLabel}</Button>
            ) : (
              <Done>{s.confirmed.includes(open.id) ? "Done — the customer got a WhatsApp confirmation." : "Already confirmed."}</Done>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ---------------- Capacity ---------------- */

type CapState = { accepted: string[]; declined: string[]; blocked: string | null };

export function CapacityScreen({ data }: { data: ScreenData["capacity"] }) {
  const { complete, spot } = useStep();
  const [s, set] = useStepState<CapState>(() => ({ accepted: [], declined: [], blocked: null }));
  const used = data.limits.map((l, i) => l.used + data.requests.filter((r) => s.accepted.includes(r.id)).reduce((a, r) => a + (r.adds[i] ?? 0), 0));
  const fits = (adds: number[]) => data.limits.every((l, i) => used[i] + (adds[i] ?? 0) <= l.capacity);
  const accept = (id: string, adds: number[]) => {
    if (!fits(adds)) return set({ ...s, blocked: id });
    set({ ...s, accepted: [...s.accepted, id], blocked: null });
    complete();
  };
  const undo = (id: string) => set({ ...s, accepted: s.accepted.filter((x) => x !== id), declined: s.declined.filter((x) => x !== id), blocked: null });
  return (
    <div className="space-y-4">
      <Panel title={data.trip}>
        <div className={`grid gap-6 ${data.limits.length > 1 ? "md:grid-cols-2" : ""}`}>
          {data.limits.map((l, i) => <CapacityMeter key={l.label} label={l.label} used={used[i]} capacity={l.capacity} unit={l.unit} />)}
        </div>
      </Panel>
      <Panel title="Requests waiting" pad={false}>
        <ul className={`divide-y divide-[#f0f2f5] ${spot("requests")}`}>
          {data.requests.map((r) => {
            const isIn = s.accepted.includes(r.id);
            const isOut = s.declined.includes(r.id);
            const wouldFit = fits(r.adds);
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold"><span className="whitespace-nowrap font-mono">{r.id}</span> · {r.customer}</p>
                  <p className="text-[13px] text-ink-soft">{r.detail} · adds {data.limits.map((l, i) => (r.adds[i] ? `${r.adds[i]} ${l.unit || (r.adds[i] === 1 ? l.label.replace(/s$/, "") : l.label).toLowerCase()}` : null)).filter(Boolean).join(", ")}</p>
                  {s.blocked === r.id && <p role="alert" className="mt-1 text-[13px] font-bold text-coral-700">Won&apos;t fit — it would exceed this trip&apos;s capacity. Offer the next sailing instead.</p>}
                </div>
                {isIn || isOut ? (
                  <span className="flex items-center gap-2">
                    <Badge tone={isIn ? "good" : "neutral"}>{isIn ? "Accepted" : "Declined"}</Badge>
                    <Button size="sm" variant="ghost" onClick={() => undo(r.id)} aria-label={`Undo ${r.id}`}>Undo</Button>
                  </span>
                ) : (
                  <span className="flex gap-2">
                    <Button size="sm" variant="accent" icon="plus" onClick={() => accept(r.id, r.adds)} aria-label={`Accept ${r.id}`} className={!wouldFit ? "opacity-60" : ""}>Accept</Button>
                    <Button size="sm" variant="secondary" icon="minus" onClick={() => set({ ...s, declined: [...s.declined, r.id], blocked: null })} aria-label={`Decline ${r.id}`}>Decline</Button>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </div>
  );
}
