import { journeyFor } from "@/domain/copy";
import type { PackageStatus } from "@/domain/types";

/** Six simple steps. ✓ done, ● now, ○ later — each also said in words. */
export function Journey({ status, compact = false, outForDelivery }: { status: PackageStatus; compact?: boolean; outForDelivery?: boolean }) {
  const steps = journeyFor(status);
  if (compact) {
    return (
      <ol className="flex items-center gap-1.5" aria-label="Progress">
        {steps.map((s) => (
          <li key={s.key} className={`h-2 flex-1 rounded-full ${s.state === "done" ? "bg-sea-500" : s.state === "current" ? "bg-sun-400" : "bg-sand-200"}`}>
            <span className="sr-only">{s.label}: {s.state === "done" ? "done" : s.state === "current" ? "happening now" : "not yet"}</span>
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ol className="relative" aria-label="Where your package is">
      {steps.map((s, i) => (
        <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0">
          {i < steps.length - 1 && <span aria-hidden className={`absolute left-[23px] top-12 h-[calc(100%-3rem)] w-1 rounded-full ${s.state === "done" ? "bg-sea-500" : "bg-sand-200"}`} />}
          <span aria-hidden className={`relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl font-black ${s.state === "done" ? "bg-sea-600 text-white" : s.state === "current" ? "bg-sun-400 text-ink ring-4 ring-sun-100" : "bg-white text-ink-mute ring-2 ring-sand-200"}`}>
            {s.state === "done" ? "✓" : s.state === "current" ? <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-ink" /> : "○"}
          </span>
          <div className="pt-2.5">
            <p className={`text-lg font-bold leading-tight ${s.state === "todo" ? "text-ink-mute" : ""}`}>{s.label}</p>
            <p className="mt-0.5 text-sm font-semibold text-ink-mute">
              {s.state === "done" ? "Done" : s.state === "current" ? (status === "incoming" ? "On its way to us" : outForDelivery && s.key === "for_you" ? "Out for delivery 🚚" : "Happening now") : "Coming up"}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
