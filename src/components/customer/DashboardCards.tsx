import Link from "next/link";

export function BigStat({ href, icon, label, value, sub, tone = "default" }: { href: string; icon: string; label: string; value: React.ReactNode; sub?: string; tone?: "default" | "alert" | "money" }) {
  const cls = tone === "alert" ? "bg-coral-50 ring-coral-100" : tone === "money" ? "bg-ink text-white ring-ink" : "bg-white ring-sand-200/70";
  return (
    <Link href={href} className={`group flex flex-col rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-card)] ring-1 transition hover:-translate-y-0.5 sm:p-5 ${cls}`}>
      <span className="flex items-center justify-between text-sm font-bold opacity-80">
        <span><span aria-hidden className="mr-1">{icon}</span> {label}</span>
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">›</span>
      </span>
      <span className={`mt-1 text-3xl font-black tabular-nums sm:text-4xl ${tone === "money" ? "text-sun-300" : tone === "alert" ? "text-coral-700" : ""}`}>{value}</span>
      {sub && <span className="mt-0.5 text-sm opacity-75">{sub}</span>}
    </Link>
  );
}
