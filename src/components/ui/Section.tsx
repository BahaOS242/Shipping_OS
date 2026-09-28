/** Titled card used across operations screens. */
export function Section({ title, action, children, className = "", pad = true, id }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; pad?: boolean; id?: string }) {
  return (
    <section id={id} className={`min-w-0 rounded-2xl bg-white ring-1 ring-[#e3e7ec] ${className}`}>
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eef1f4] px-5 py-3.5">
          {title && <h2 className="text-base font-extrabold sm:text-lg">{title}</h2>}
          {action}
        </div>
      )}
      <div className={pad ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function StatTile({ label, value, sub, icon, tone = "neutral", href }: { label: string; value: React.ReactNode; sub?: React.ReactNode; icon?: string; tone?: "neutral" | "alert" | "good"; href?: string }) {
  const cls = tone === "alert" ? "bg-coral-50 ring-coral-100" : tone === "good" ? "bg-emerald-50 ring-emerald-200" : "bg-white ring-[#e3e7ec]";
  const body = (
    <>
      <p className="flex items-center gap-2 text-sm font-bold text-ink-soft">
        {icon && <span aria-hidden>{icon}</span>} {label}
      </p>
      <p className={`mt-1.5 break-words text-2xl font-black tabular-nums sm:text-3xl ${tone === "alert" ? "text-coral-700" : ""}`}>{value}</p>
      {sub && <p className="text-sm text-ink-mute">{sub}</p>}
    </>
  );
  return href ? (
    <a href={href} className={`block rounded-2xl p-4 ring-1 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] sm:p-5 ${cls}`}>{body}</a>
  ) : (
    <div className={`rounded-2xl p-4 ring-1 sm:p-5 ${cls}`}>{body}</div>
  );
}
