"use client";

import { useState } from "react";

type Datum = { label: string; value: number; display?: string };

/** Single-series column chart (time series). Hover/focus tooltip on every bar + table view. */
export function ColumnChart({ title, data, unit = "", height = 160 }: { title: string; data: Datum[]; unit?: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const ticks = [0, Math.ceil(max / 2), max];
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-sm font-bold text-ink-soft">{title}</figcaption>
      <div className="relative flex gap-2">
        <div className="flex flex-col justify-between text-right text-[11px] text-ink-mute" style={{ height }} aria-hidden>
          {[...ticks].reverse().map((t) => <span key={t} className="-translate-y-1/2 leading-none">{t}</span>)}
        </div>
        <div className="relative flex-1" style={{ height }}>
          {ticks.map((t) => <div key={t} aria-hidden className="absolute inset-x-0 border-t border-[#eef1f4]" style={{ bottom: `${(t / max) * 100}%` }} />)}
          <ol className="absolute inset-0 flex items-end gap-[2px]" aria-label={title}>
            {data.map((d, i) => (
              <li key={d.label} className="relative flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <button
                  type="button"
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${d.label}: ${d.display ?? d.value}${unit}`}
                  className={`w-full rounded-t-[4px] transition-colors ${hover === i ? "bg-sea-700" : "bg-sea-500"}`}
                  style={{ height: `${Math.max(d.value ? 2 : 0, (d.value / max) * 100)}%` }}
                />
                {hover === i && (
                  <span role="tooltip" className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2 py-1 text-xs font-semibold text-white shadow">
                    {d.label}: {d.display ?? d.value}{unit}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className="ml-6 mt-1 flex justify-between text-[11px] text-ink-mute" aria-hidden>
        <span>{data[0]?.label}</span>
        <span>{data.at(-1)?.label}</span>
      </div>
      <DataTable data={data} unit={unit} />
    </figure>
  );
}

/** Single-series horizontal bars for comparing categories. Values are direct-labeled in ink. */
export function BarList({ title, data, unit = "" }: { title: string; data: Datum[]; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-sm font-bold text-ink-soft">{title}</figcaption>
      <ul className="space-y-2">
        {data.map((d) => (
          <li key={d.label} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-2 text-sm" title={`${d.label}: ${d.display ?? d.value}${unit}`}>
            <span className="truncate text-ink-soft">{d.label}</span>
            <span className="h-3 rounded-r-[4px] bg-[#eef1f4]"><span className="block h-3 rounded-r-[4px] bg-sea-500" style={{ width: `${(d.value / max) * 100}%` }} /></span>
            <span className="text-right font-bold tabular-nums">{d.display ?? d.value}{unit}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

function DataTable({ data, unit }: { data: Datum[]; unit: string }) {
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer font-semibold text-sea-700">Show as table</summary>
      <table className="mt-1 w-full"><tbody>{data.map((d) => <tr key={d.label}><td className="py-0.5 text-ink-soft">{d.label}</td><td className="text-right tabular-nums">{d.display ?? d.value}{unit}</td></tr>)}</tbody></table>
    </details>
  );
}
