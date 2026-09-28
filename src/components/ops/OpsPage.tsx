/** Operations page frame. Rendered inside OpsShell, which only mounts children once data is live. */
export function OpsPage({ title, sub, actions, children, eyebrow }: { title: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="space-y-5">
      <title>{`${typeof title === "string" ? title : "Operations"} · The Link Ops`}</title>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <div className="mb-1 text-sm font-bold uppercase tracking-wider text-ink-mute">{eyebrow}</div>}
          <h1 className="text-3xl font-black tracking-tight">{title}</h1>
          {sub && <p className="mt-0.5 text-ink-soft">{sub}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function Btn({ children, onClick, tone = "dark", disabled, type = "button", title }: { children: React.ReactNode; onClick?: () => void; tone?: "dark" | "sea" | "light" | "danger" | "gold"; disabled?: boolean; type?: "button" | "submit"; title?: string }) {
  const cls = { dark: "bg-ink text-white", sea: "bg-sea-600 text-white hover:bg-sea-700", light: "bg-white ring-1 ring-[#dfe4ea] hover:ring-sea-400", danger: "bg-white text-coral-700 ring-1 ring-coral-100 hover:bg-coral-50", gold: "bg-sun-400 text-ink" }[tone];
  return (
    <button type={type} title={title} onClick={onClick} disabled={disabled} className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-[15px] font-bold transition active:scale-[0.98] disabled:opacity-40 ${cls}`}>
      {children}
    </button>
  );
}
