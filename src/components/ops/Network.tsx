import Link from "next/link";
import type { Voyage } from "@/domain/types";
import type { TripCapacity } from "@/services/capacity";
import { fmtDateTime } from "../ui/Time";
import { Pill } from "../ui/Pill";

const TRIP_TONE = { scheduled: "neutral", departed: "moving", arrived: "done", cancelled: "bad" } as const;

export const TripStatusPill = ({ status }: { status: Voyage["status"] }) => (
  <Pill tone={TRIP_TONE[status]} size="xs">
    {status[0].toUpperCase() + status.slice(1)}
  </Pill>
);

/** Weight used vs capacity. Unlimited trips just show the load. */
export function CapacityBar({ c }: { c: TripCapacity }) {
  if (c.capacityLb === undefined) return <p className="text-sm text-ink-mute">{c.usedLb.toLocaleString()} lb · no capacity limit</p>;
  const pct = Math.min(100, c.percent ?? 0);
  const tone = (c.percent ?? 0) >= 95 ? "bg-coral-500" : (c.percent ?? 0) >= 75 ? "bg-sun-400" : "bg-sea-500";
  return (
    <div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#eef1f4]" role="meter" aria-valuemin={0} aria-valuemax={c.capacityLb} aria-valuenow={c.usedLb} aria-label="Capacity used">
        <div className={`h-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-xs text-ink-soft">
        {c.usedLb.toLocaleString()} / {c.capacityLb.toLocaleString()} lb · {c.percent}% · <b>{(c.remainingLb ?? 0).toLocaleString()} lb free</b>
        {c.reservedLb > 0 && <span className="text-ink-mute"> ({c.reservedLb.toLocaleString()} lb reserved)</span>}
      </p>
    </div>
  );
}

export function TripLine({ trip, route, sub, href = `/manifest?trip=${trip.id}` }: { trip: Voyage; route?: string; sub?: React.ReactNode; href?: string }) {
  return (
    <div className="min-w-0">
      <p className="flex flex-wrap items-center gap-2">
        <Link href={href} className="font-bold hover:underline">{trip.label}</Link>
        <TripStatusPill status={trip.status} />
      </p>
      <p className="text-sm text-ink-soft">
        {route ? `${route} · ` : ""}departs {fmtDateTime(trip.departsAt)} · arrives {fmtDateTime(trip.arrivesAt)}
      </p>
      {sub}
    </div>
  );
}
