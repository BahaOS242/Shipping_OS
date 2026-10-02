"use client";

import { CapacityBar } from "@/components/ops/Network";
import { OpsPage } from "@/components/ops/OpsPage";
import { Section, StatTile } from "@/components/ui/Section";
import { fmtDateTime } from "@/components/ui/Time";
import { useLive } from "@/data/useLive";
import * as svc from "@/services";

export default function CapacityPage() {
  useLive();
  const trips = svc.listTrips({ fromDaysAgo: 0, days: 14, status: "scheduled", routed: true });
  const caps = trips.map((t) => ({ t, c: svc.tripCapacity(t) }));
  const full = caps.filter((x) => (x.c.percent ?? 0) >= 95).length;
  const total = caps.reduce((a, x) => a + (x.c.capacityLb ?? 0), 0);
  const used = caps.reduce((a, x) => a + x.c.usedLb, 0);
  return (
    <OpsPage title="Capacity" sub="Weight booked and loaded against each vessel's capacity. Bookings and load planning can't exceed it.">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon="🗓️" label="Upcoming trips" value={trips.length} sub="next 14 days" />
        <StatTile icon="⚖️" label="Space used" value={`${total ? Math.round((used / total) * 100) : 0}%`} sub={`${Math.round(used).toLocaleString()} of ${total.toLocaleString()} lb`} />
        <StatTile icon="🟥" label="Full or nearly full" value={full} tone={full ? "alert" : "neutral"} />
        <StatTile icon="🚢" label="Vessels" value={svc.listVessels().filter((v) => v.status === "active").length} sub="active" />
      </div>
      {svc.listVessels().map((v) => {
        const mine = caps.filter((x) => x.t.vesselId === v.id);
        if (!mine.length) return null;
        return (
          <Section key={v.id} title={`${v.name} · ${v.capacityLb.toLocaleString()} lb`}>
            <ul className="space-y-3">
              {mine.map(({ t, c }) => (
                <li key={t.id} className="grid gap-2 md:grid-cols-[1fr_2fr] md:items-center">
                  <p className="text-sm font-bold">{fmtDateTime(t.departsAt)} <span className="font-normal text-ink-mute">· {svc.findRoute(t.routeId)?.code}</span></p>
                  <CapacityBar c={c} />
                </li>
              ))}
            </ul>
          </Section>
        );
      })}
    </OpsPage>
  );
}
