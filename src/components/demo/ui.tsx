/** Demo UI primitives — operational, dense, readable. Built on the app's ink / sea / sun / coral tokens. */
import type { Kv, Metric, Table, Tone } from "@/demo/types";
import { Icon } from "./Icon";

export const TONE: Record<Tone, { badge: string; dot: string; text: string; bar: string }> = {
  neutral: { badge: "bg-[#eef1f4] text-ink-soft ring-[#dfe4ea]", dot: "bg-ink-mute", text: "text-ink-soft", bar: "bg-ink-mute" },
  info: { badge: "bg-sea-50 text-sea-800 ring-sea-200", dot: "bg-sea-500", text: "text-sea-700", bar: "bg-sea-500" },
  good: { badge: "bg-emerald-50 text-emerald-800 ring-emerald-200", dot: "bg-emerald-500", text: "text-emerald-700", bar: "bg-emerald-500" },
  warn: { badge: "bg-sun-50 text-sun-700 ring-sun-300", dot: "bg-sun-500", text: "text-sun-700", bar: "bg-sun-500" },
  bad: { badge: "bg-coral-50 text-coral-700 ring-coral-100", dot: "bg-coral-500", text: "text-coral-700", bar: "bg-coral-500" },
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${TONE[tone].badge}`}>{children}</span>;
}

export function Panel({ title, action, children, className = "", pad = true }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`min-w-0 rounded-lg border border-[#dfe4ea] bg-white ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef1f4] px-4 py-2.5">
          {title && <h3 className="text-[13px] font-extrabold uppercase tracking-wide text-ink-soft">{title}</h3>}
          {action}
        </header>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

type BtnProps = { variant?: "primary" | "accent" | "secondary" | "ghost"; size?: "sm" | "md"; icon?: React.ComponentProps<typeof Icon>["name"] } & React.ComponentProps<"button">;
export function Button({ variant = "primary", size = "md", icon, className = "", children, ...rest }: BtnProps) {
  const v = {
    primary: "bg-ink text-white hover:bg-[#1d3044]",
    accent: "bg-sea-600 text-white hover:bg-sea-700",
    secondary: "bg-white text-ink ring-1 ring-[#cfd6de] hover:ring-ink-mute",
    ghost: "text-ink-soft hover:bg-[#eef1f4]",
  }[variant];
  const s = size === "sm" ? "min-h-9 px-3 text-[13px]" : "min-h-11 px-4 text-sm";
  return (
    <button type="button" {...rest} className={`inline-flex items-center justify-center gap-2 rounded-md font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${v} ${s} ${className}`}>
      {icon && <Icon name={icon} className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function MetricTile({ m }: { m: Metric }) {
  return (
    <div className="rounded-lg border border-[#dfe4ea] bg-white p-4">
      <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-ink-mute">
        {m.icon && <Icon name={m.icon} className="h-4 w-4" />}
        {m.label}
      </p>
      <p className={`mt-1 text-2xl font-black tabular-nums sm:text-[28px] ${m.tone && m.tone !== "neutral" ? TONE[m.tone].text : "text-ink"}`}>{m.value}</p>
      {m.sub && <p className="text-[12px] text-ink-mute">{m.sub}</p>}
    </div>
  );
}

export function DataTable({ table, dense }: { table: Table; dense?: boolean }) {
  const hasStatus = table.rows.some((r) => r.status);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-[13px]">
        <caption className="sr-only">{table.title}</caption>
        <thead>
          <tr className="border-b border-[#eef1f4] text-[11px] font-bold uppercase tracking-wide text-ink-mute">
            {table.columns.map((c) => <th key={c} scope="col" className="px-4 py-2 font-bold">{c}</th>)}
            {hasStatus && <th scope="col" className="px-4 py-2 font-bold">Status</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#f0f2f5]">
          {table.rows.map((r, i) => (
            <tr key={i} className="hover:bg-[#f8fafb]">
              {r.cells.map((c, j) => <td key={j} className={`px-4 ${dense ? "py-1.5" : "py-2.5"} ${j === 0 ? "whitespace-nowrap font-mono font-semibold text-ink" : "text-ink-soft"}`}>{c}</td>)}
              {hasStatus && <td className="px-4 py-2">{r.status && <Badge tone={r.tone}>{r.status}</Badge>}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function KvList({ items, cols = 2 }: { items: Kv[]; cols?: 1 | 2 | 3 }) {
  const c = { 1: "", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3" }[cols];
  return (
    <dl className={`grid gap-x-6 gap-y-3 ${c}`}>
      {items.map((k) => (
        <div key={k.label}>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">{k.label}</dt>
          <dd className="text-[14px] font-semibold text-ink">{k.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Used vs capacity. Colour moves sea → sun → coral as it fills. */
export function CapacityMeter({ label, used, capacity, unit }: { label: string; used: number; capacity: number; unit: string }) {
  const pct = capacity ? Math.round((used / capacity) * 100) : 0;
  const tone: Tone = pct > 100 ? "bad" : pct >= 90 ? "bad" : pct >= 75 ? "warn" : "info";
  const fmt = (n: number) => `${n.toLocaleString()}${unit ? ` ${unit}` : ""}`;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[13px]">
        <span className="font-bold text-ink">{label}</span>
        <span className="tabular-nums text-ink-soft">
          <b className="text-ink">{fmt(used)}</b> / {fmt(capacity)} · <b className={TONE[tone].text}>{pct}%</b>
        </span>
      </div>
      <div className="mt-1.5 h-3 overflow-hidden rounded-sm bg-[#e8ecf0]" role="meter" aria-label={`${label} used`} aria-valuemin={0} aria-valuemax={capacity} aria-valuenow={used} aria-valuetext={`${fmt(used)} of ${fmt(capacity)}, ${pct}%`}>
        <div className={`h-full transition-[width] duration-500 ${TONE[tone].bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="mt-1 text-[12px] text-ink-mute">{capacity - used >= 0 ? `${fmt(capacity - used)} free` : `${fmt(used - capacity)} over`}</p>
    </div>
  );
}

/** Honest label on every AI moment. */
export const SimulatedAi = () => (
  <span className="inline-flex items-center gap-1.5 rounded-md bg-[#eef1f4] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink-soft">
    <Icon name="spark" className="h-3.5 w-3.5" /> Simulated AI · demo data
  </span>
);

/** Confirmation strip shown after an action completes. */
export function Done({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="flex items-start gap-2 rounded-md bg-emerald-50 px-3 py-2 text-[13px] font-semibold text-emerald-800 ring-1 ring-emerald-200 motion-safe:animate-rise">
      <Icon name="check" className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
