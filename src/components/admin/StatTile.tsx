export function StatTile({ label, value, icon, tone = "neutral" }: { label: string; value: number; icon: string; tone?: "neutral" | "alert" }) {
  return (
    <div className={`rounded-2xl p-5 ring-1 ${tone === "alert" ? "bg-coral-50 ring-coral-100" : "bg-white ring-[#e3e7ec]"}`}>
      <p className="flex items-center gap-2 text-sm font-bold text-ink-soft">
        <span aria-hidden>{icon}</span> {label}
      </p>
      <p className={`mt-2 text-4xl font-black tabular-nums ${tone === "alert" ? "text-coral-700" : "text-ink"}`}>{value}</p>
    </div>
  );
}
