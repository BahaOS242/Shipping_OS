"use client";

/** Bin storage, shipment grouping, connected workflow and billing screens. */
import { useState } from "react";
import type { ScreenData } from "@/demo/types";
import { useStep, useStepState } from "../DemoContext";
import { Icon } from "../Icon";
import { Badge, Button, Done, Panel } from "../ui";
import { useReveal } from "../useReveal";

const money = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/* ---------------- Storage ---------------- */

export function StorageScreen({ data }: { data: ScreenData["storage"] }) {
  const { complete, spot } = useStep();
  const [binOf, setBinOf] = useStepState<Record<string, string>>(() => ({}));
  const [selected, setSelected] = useState<string | null>(null);
  const free = (binId: string) => data.bins.find((b) => b.id === binId)!.free - Object.values(binOf).filter((x) => x === binId).length;
  const waiting = data.packages.filter((p) => !binOf[p.id]);
  const assign = (pkg: string, bin: string) => {
    if (free(bin) <= 0) return;
    const next = { ...binOf, [pkg]: bin };
    setBinOf(next);
    setSelected(null);
    if (data.packages.every((p) => next[p.id])) complete();
  };
  const suggest = () => {
    const next = { ...binOf };
    const room = Object.fromEntries(data.bins.map((b) => [b.id, free(b.id)]));
    const zoneFor = { S: "Small parts", M: "Medium", L: "Bulky" } as const;
    for (const p of waiting) {
      const bin = data.bins.find((b) => b.zone === zoneFor[p.size] && room[b.id] > 0) ?? data.bins.find((b) => room[b.id] > 0);
      if (bin) {
        next[p.id] = bin.id;
        room[bin.id]--;
      }
    }
    setBinOf(next);
    if (data.packages.every((p) => next[p.id])) complete();
  };
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <Panel title={`Received — needs a bin (${waiting.length})`} action={waiting.length > 0 && <Button size="sm" variant="secondary" icon="spark" className={spot("auto-bin")} onClick={suggest}>Suggest bins</Button>} pad={false}>
        <ul className="divide-y divide-[#f0f2f5]">
          {data.packages.map((p) => {
            const bin = binOf[p.id];
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-2.5">
                <button
                  disabled={!!bin}
                  aria-pressed={selected === p.id}
                  onClick={() => setSelected(selected === p.id ? null : p.id)}
                  className={`flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md px-2 text-left text-[13px] ${selected === p.id ? "bg-sea-50 ring-2 ring-sea-500" : "hover:bg-[#f6f8fa]"} disabled:hover:bg-transparent`}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-[#eef1f4] text-[11px] font-black" aria-label={`Size ${p.size}`}>{p.size}</span>
                  <span className="min-w-0"><span className="block font-mono font-bold">{p.id}</span><span className="block truncate text-ink-soft">{p.customer} · {p.description}</span></span>
                </button>
                {bin ? <Badge tone="good">Bin {bin}</Badge> : <span className="text-[12px] text-ink-mute">{selected === p.id ? "Pick a bin →" : "Select"}</span>}
              </li>
            );
          })}
        </ul>
        {waiting.length === 0 && <div className="p-4"><Done>Every package has a location. Pickers will be sent straight to the bin.</Done></div>}
      </Panel>
      <Panel title="Aisles & bins">
        <p className="mb-3 text-[13px] text-ink-mute">{selected ? `Choose a bin for ${selected}.` : "Select a package, then a bin — or let Shipping OS suggest bins by size."}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {data.bins.map((b) => {
            const left = free(b.id);
            const items = Object.entries(binOf).filter(([, v]) => v === b.id).map(([k]) => k);
            return (
              <button
                key={b.id}
                disabled={!selected || left <= 0}
                onClick={() => selected && assign(selected, b.id)}
                aria-label={`Bin ${b.id}, ${b.zone}, ${left} free`}
                className={`min-h-20 rounded-md border p-2 text-left text-[12px] transition ${left <= 0 ? "border-[#e3e8ee] bg-[#f4f6f8] text-ink-mute" : selected ? "border-sea-400 bg-white hover:bg-sea-50" : "border-[#dfe4ea] bg-white"}`}
              >
                <span className="flex items-center justify-between"><b className="font-mono text-[13px] text-ink">{b.id}</b><span>{left <= 0 ? "Full" : `${left} free`}</span></span>
                <span className="block text-ink-mute">{b.zone}</span>
                {items.map((i) => <span key={i} className="mt-1 block truncate font-mono text-sea-700">{i}</span>)}
              </button>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- Grouping ---------------- */

export function GroupingScreen({ data }: { data: ScreenData["grouping"] }) {
  const { complete, spot } = useStep();
  const [s, set] = useStepState<{ picked: string[]; created: boolean }>(() => ({ picked: [], created: false }));
  const picked = data.packages.filter((p) => s.picked.includes(p.id));
  const weight = picked.reduce((a, p) => a + p.weightKg, 0);
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Panel title={data.destination} pad={false}>
        <ul className="divide-y divide-[#f0f2f5]">
          {data.packages.map((p) => (
            <li key={p.id}>
              <label className={`flex min-h-12 items-center gap-3 px-4 py-2 text-[13px] ${p.docs ? "cursor-pointer hover:bg-[#f8fafb]" : "opacity-70"}`}>
                <input type="checkbox" className="h-5 w-5 accent-[var(--color-sea-600)]" disabled={!p.docs || s.created} checked={s.picked.includes(p.id)} onChange={() => set({ ...s, picked: s.picked.includes(p.id) ? s.picked.filter((x) => x !== p.id) : [...s.picked, p.id] })} />
                <span className="font-mono font-bold">{p.id}</span>
                <span className="min-w-0 flex-1 truncate text-ink-soft">{p.description}</span>
                <span className="tabular-nums text-ink-soft">{p.weightKg} kg</span>
                {p.docs ? <Badge tone="good">Invoice ✓</Badge> : <Badge tone="bad">No invoice</Badge>}
              </label>
            </li>
          ))}
        </ul>
        <p className="border-t border-[#eef1f4] px-4 py-2 text-[12px] text-ink-mute">Packages without a commercial invoice can&apos;t travel — Shipping OS holds them back automatically.</p>
      </Panel>
      <Panel title="New shipment">
        {!s.created ? (
          <div className="space-y-3">
            <p className="text-[14px]"><b>{picked.length}</b> packages · <b>{weight} kg</b></p>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={s.created} onClick={() => set({ ...s, picked: data.packages.filter((p) => p.docs).map((p) => p.id) })}>Select all ready</Button>
              <Button variant="accent" icon="box" className={spot("create-btn")} disabled={!picked.length} onClick={() => { set({ ...s, created: true }); complete(); }}>{data.createLabel}</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 motion-safe:animate-rise">
            <p className="font-mono text-lg font-black">{data.result.ref}</p>
            <p className="text-[13px] text-ink-soft">{picked.length} packages · {weight} kg · {data.result.next}</p>
            <Done>Shipment created. Customer notified; customs paperwork assembled from the invoices on file.</Done>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ---------------- Connected workflow ---------------- */

export function FlowScreen({ data }: { data: ScreenData["flow"] }) {
  const { complete, spot } = useStep();
  const [s, set] = useStepState<{ ran: boolean; focus: string }>(() => ({ ran: false, focus: data.nodes[0].id }));
  const reveal = useReveal(data.nodes.length, s.ran, 260);
  const focus = data.nodes.find((n) => n.id === s.focus)!;
  return (
    <div className="space-y-4">
      <Panel title={data.title} action={<Button size="sm" variant="accent" icon="arrowRight" className={spot("run-btn")} disabled={reveal.animating} onClick={() => { set({ ran: true, focus: data.nodes[0].id }); reveal.start(); complete(); }}>{s.ran ? "Run again" : "Run the shipment through"}</Button>}>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {data.nodes.map((n, i) => {
            const lit = s.ran && i < reveal.visible;
            return (
              <li key={n.id} className="relative">
                <button
                  onClick={() => set({ ...s, focus: n.id })}
                  aria-pressed={s.focus === n.id}
                  className={`flex min-h-20 w-full flex-col items-start justify-between rounded-md border p-2.5 text-left transition-colors ${s.focus === n.id ? "border-ink bg-ink text-white" : lit ? "border-sea-400 bg-sea-50" : "border-[#dfe4ea] bg-white hover:border-ink-mute"}`}
                >
                  <span className="flex w-full items-center justify-between"><Icon name={n.icon} className="h-5 w-5" /><span className={`text-[10px] font-bold ${s.focus === n.id ? "text-white/60" : "text-ink-mute"}`}>{String(i + 1).padStart(2, "0")}</span></span>
                  <span className="text-[13px] font-bold">{n.label}</span>
                  {lit && <span className={`text-[11px] ${s.focus === n.id ? "text-sun-300" : "text-sea-700"}`}>✓ {n.metric}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </Panel>
      <Panel title={`${focus.label}`}>
        <div className="flex items-start gap-3 motion-safe:animate-rise" key={focus.id}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-ink text-white" aria-hidden><Icon name={focus.icon} /></span>
          <div><p className="text-[14px]">{focus.detail}</p><p className="mt-1 font-mono text-[13px] font-bold text-sea-700">{focus.metric}</p></div>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- Billing ---------------- */

export function BillingScreen({ data }: { data: ScreenData["billing"] }) {
  const { complete, spot } = useStep();
  const [s, set] = useStepState<{ issued: boolean; paid: boolean }>(() => ({ issued: false, paid: false }));
  const subtotal = data.lines.reduce((a, l) => a + l.amount, 0);
  const vat = Math.round(subtotal * data.vatRate * 100) / 100;
  const total = subtotal + vat;
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Panel title={`Invoice · ${data.customer}`} action={<Badge tone={s.paid ? "good" : s.issued ? "info" : "neutral"}>{s.paid ? "Paid" : s.issued ? "Issued" : "Draft"}</Badge>} pad={false}>
        <table className="w-full text-left text-[13px]">
          <caption className="sr-only">Invoice lines for {data.ref}</caption>
          <thead><tr className="border-b border-[#eef1f4] text-[11px] font-bold uppercase tracking-wide text-ink-mute"><th scope="col" className="px-4 py-2">Charge (from {data.ref})</th><th scope="col" className="px-4 py-2 text-right">Amount</th></tr></thead>
          <tbody className="divide-y divide-[#f0f2f5]">
            {data.lines.map((l) => <tr key={l.description}><td className="px-4 py-2 text-ink-soft">{l.description}</td><td className="px-4 py-2 text-right tabular-nums">{money(l.amount)}</td></tr>)}
          </tbody>
          <tfoot className="border-t border-[#eef1f4]">
            <tr><td className="px-4 pt-2 text-right text-ink-mute">Subtotal</td><td className="px-4 pt-2 text-right tabular-nums">{money(subtotal)}</td></tr>
            <tr><td className="px-4 text-right text-ink-mute">VAT {Math.round(data.vatRate * 100)}%</td><td className="px-4 text-right tabular-nums">{money(vat)}</td></tr>
            <tr><td className="px-4 pb-3 text-right font-bold">Total</td><td className="px-4 pb-3 text-right text-lg font-black tabular-nums">{money(total)}</td></tr>
          </tfoot>
        </table>
      </Panel>
      <Panel title="Actions">
        <div className="space-y-3">
          <p className="text-[13px] text-ink-soft">Every charge came from the work itself — freight from the manifest, handling from the warehouse, delivery from dispatch. Nothing re-keyed.</p>
          {!s.issued && <Button variant="accent" icon="receipt" className={spot("issue-btn")} onClick={() => { set({ ...s, issued: true }); complete(); }}>Issue invoice</Button>}
          {s.issued && <Done>Invoice {data.invoiceRef} sent by {data.channel}, with a pay-online link.</Done>}
          {s.issued && !s.paid && <Button variant="secondary" icon="dollar" onClick={() => set({ ...s, paid: true })}>Record payment {money(total)}</Button>}
          {s.paid && <Done>Payment matched to the invoice — reconciled automatically.</Done>}
        </div>
      </Panel>
    </div>
  );
}
