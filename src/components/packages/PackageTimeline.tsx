import { STATUS, timelineFor } from "@/lib/status";
import type { PackageStatus } from "@/lib/types";

/** Five big, simple steps. Done = ✓, now = ●, later = ○ — and each says so in words. */
export function PackageTimeline({ status, compact = false }: { status: PackageStatus; compact?: boolean }) {
  const steps = timelineFor(status);

  if (compact) {
    return (
      <ol className="flex items-center gap-1.5" aria-label="Progress">
        {steps.map((s) => (
          <li
            key={s.key}
            className={`h-2 flex-1 rounded-full ${s.state === "done" ? "bg-sea-500" : s.state === "current" ? "bg-sun-400" : "bg-sand-200"}`}
          >
            <span className="sr-only">
              {s.label}: {s.state === "done" ? "done" : s.state === "current" ? "happening now" : "not yet"}
            </span>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <ol className="relative" aria-label="Where your package is">
      {steps.map((s, i) => {
        const last = i === steps.length - 1;
        return (
          <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && (
              <span
                aria-hidden
                className={`absolute left-[23px] top-12 h-[calc(100%-3rem)] w-1 rounded-full ${s.state === "done" ? "bg-sea-500" : "bg-sand-200"}`}
              />
            )}
            <span
              aria-hidden
              className={`relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full text-xl font-black ${
                s.state === "done"
                  ? "bg-sea-600 text-white"
                  : s.state === "current"
                    ? "bg-sun-400 text-ink ring-4 ring-sun-100"
                    : "bg-white text-ink-mute ring-2 ring-sand-200"
              }`}
            >
              {s.state === "done" ? "✓" : s.state === "current" ? <span className="h-3.5 w-3.5 animate-pulse rounded-full bg-ink" /> : "○"}
            </span>
            <div className="pt-2.5">
              <p className={`text-lg font-bold leading-tight ${s.state === "todo" ? "text-ink-mute" : "text-ink"}`}>
                {s.label}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-ink-mute">
                {s.state === "done" ? "Done" : s.state === "current" ? (status === "incoming" ? "On its way to us" : "Happening now") : "Coming up"}
              </p>
            </div>
          </li>
        );
      })}
      {status === "delivered" && (
        <li className="mt-4 rounded-2xl bg-emerald-50 p-4 font-bold text-emerald-800">🎉 {STATUS.delivered.explain}</li>
      )}
    </ol>
  );
}
