import { STATUS, type StatusMeta } from "@/lib/status";
import type { PackageStatus } from "@/lib/types";

export const TONE: Record<StatusMeta["tone"], string> = {
  waiting: "bg-sand-100 text-ink-soft ring-sand-200",
  good: "bg-sea-50 text-sea-800 ring-sea-200",
  moving: "bg-sun-50 text-sun-700 ring-sun-300",
  done: "bg-emerald-50 text-emerald-800 ring-emerald-200",
};

/** Always icon + words. Color is decoration, never the message. */
export function StatusBadge({ status, size = "md" }: { status: PackageStatus; size?: "md" | "lg" }) {
  const s = STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-bold ring-1 ${TONE[s.tone]} ${
        size === "lg" ? "px-4 py-2 text-lg" : "px-3 py-1 text-sm"
      }`}
    >
      <span aria-hidden>{s.icon}</span>
      {s.short}
    </span>
  );
}
