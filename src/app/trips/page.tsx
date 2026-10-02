"use client";

import Link from "next/link";
import { useState } from "react";
import { CapacityBar, TripLine } from "@/components/ops/Network";
import { Btn, OpsPage } from "@/components/ops/OpsPage";
import { Section } from "@/components/ui/Section";
import { useAction } from "@/components/ui/Toast";
import { useLive } from "@/data/useLive";
import * as svc from "@/services";

export default function TripsPage() {
  useLive();
  const run = useAction();
  const actor = svc.currentActor();
  const [past, setPast] = useState(false);
  const trips = svc.listTrips({ fromDaysAgo: past ? 14 : 1, days: past ? 0 : 14, routed: true });
  return (
    <OpsPage
      title="Trips"
      sub="Every sailing from your schedules: what's on it, how full it is, and where it is."
      actions={<Btn tone="light" onClick={() => setPast((p) => !p)}>{past ? "Upcoming trips" : "Past 14 days"}</Btn>}
    >
      <Section title={past ? "Past trips" : "Next 14 days"} pad={false}>
        <ul className="divide-y divide-[#eef1f4]">
          {trips.map((t) => {
            const d = svc.tripDetails(t);
            return (
              <li key={t.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[1.5fr_1fr_auto] lg:items-center">
                <TripLine trip={t} route={d.route?.name} sub={<p className="text-xs text-ink-mute">{d.shipments.length} shipment{d.shipments.length === 1 ? "" : "s"} loaded · {d.bookings.filter((b) => b.status !== "checked_in").length} bookings waiting{svc.isModuleEnabled("manifest") ? ` · manifest ${d.manifestClosed ? "closed" : "open"}` : ""}</p>} />
                <CapacityBar c={d.capacity} />
                <div className="flex flex-wrap gap-2">
                  {svc.isModuleEnabled("manifest") && <Link href={`/manifest?trip=${t.id}`} className="inline-flex min-h-11 items-center rounded-xl px-4 font-bold ring-1 ring-[#dfe4ea] hover:ring-sea-400">Manifest</Link>}
                  {t.status === "scheduled" && <Btn onClick={() => run(() => svc.departTrip(actor, t.id), (r) => `${r.trip.label} departed${r.leftBehind.length ? ` — ${r.leftBehind.length} not ready` : ""}`)}>Depart</Btn>}
                  {t.status === "departed" && <Btn tone="sea" onClick={() => run(() => svc.arriveTrip(actor, t.id), "Arrived")}>Mark arrived</Btn>}
                </div>
              </li>
            );
          })}
          {!trips.length && <li className="px-5 py-6 text-ink-mute">No trips in this window. Generate them from <Link className="font-bold text-sea-700" href="/schedules">Schedules</Link>.</li>}
        </ul>
      </Section>
    </OpsPage>
  );
}
