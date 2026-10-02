"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CapacityBar, TripStatusPill } from "@/components/ops/Network";
import { Btn, OpsPage } from "@/components/ops/OpsPage";
import { Select } from "@/components/ui/Field";
import { Section } from "@/components/ui/Section";
import { fmtDateTime } from "@/components/ui/Time";
import { useAction } from "@/components/ui/Toast";
import { useLive } from "@/data/useLive";
import * as svc from "@/services";

function Manifest() {
  useLive();
  const run = useAction();
  const router = useRouter();
  const actor = svc.currentActor();
  const all = svc.listManifests();
  const tripId = useSearchParams().get("trip") ?? all[0]?.trip.id;
  const m = tripId ? svc.manifestFor(tripId) : undefined;
  const [assign, setAssign] = useState("");
  const candidates = m ? svc.listShipments({ status: "cleared" }).filter((s) => !s.voyageId && s.destinationId === m.trip.destinationId && s.service === m.trip.mode) : [];
  return (
    <OpsPage
      title="Manifest"
      sub="What is loaded on each trip. Lines come straight from the shipments on the trip; closing the manifest stops further loading."
      actions={
        <Select aria-label="Trip" value={tripId ?? ""} onChange={(e) => router.replace(`/manifest?trip=${e.target.value}`)} className="!min-h-11 max-w-md">
          {all.map((x) => <option key={x.trip.id} value={x.trip.id}>{x.trip.label} · {fmtDateTime(x.trip.departsAt)} · {x.status}</option>)}
        </Select>
      }
    >
      {!m ? (
        <Section><p className="text-ink-mute">No trips have anything on them yet.</p></Section>
      ) : (
        <>
          <Section
            title={<span className="flex flex-wrap items-center gap-2">{m.trip.label} <TripStatusPill status={m.trip.status} /> <span className="text-sm font-semibold text-ink-mute">Manifest {m.record?.id ?? "(not yet closed)"} · {m.status}</span></span>}
            action={
              m.trip.status === "scheduled" && (
                <div className="flex gap-2">
                  {m.status === "open" ? <Btn onClick={() => run(() => svc.closeManifest(actor, m.trip.id), "Manifest closed")}>Close manifest</Btn> : <Btn tone="light" onClick={() => run(() => svc.reopenManifest(actor, m.trip.id), "Reopened")}>Reopen</Btn>}
                  <Btn tone="light" onClick={() => window.print()}>Print</Btn>
                </div>
              )
            }
          >
            <p className="mb-3 text-sm text-ink-soft">Departs {fmtDateTime(m.trip.departsAt)} · arrives {fmtDateTime(m.trip.arrivesAt)}{m.record?.closedBy ? ` · closed by ${m.record.closedBy} ${fmtDateTime(m.record.closedAt)}` : ""}</p>
            <CapacityBar c={m.capacity} />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-ink-mute"><tr><th className="py-2">Shipment</th><th>Consignee</th><th>Cargo</th><th className="text-right">Pieces</th><th className="text-right">Weight</th><th className="pl-4">Booking</th></tr></thead>
                <tbody className="divide-y divide-[#eef1f4]">
                  {m.lines.map((l) => (
                    <tr key={l.shipment.id}>
                      <td className="py-2 font-mono font-bold">{l.shipment.id}</td>
                      <td>{l.customer}</td>
                      <td>{l.description}</td>
                      <td className="text-right tabular-nums">{l.pieces}</td>
                      <td className="text-right tabular-nums">{l.weightLb.toLocaleString()} lb</td>
                      <td className="pl-4 font-mono">{l.bookingId ?? "—"}</td>
                    </tr>
                  ))}
                  {!m.lines.length && <tr><td colSpan={6} className="py-4 text-ink-mute">Nothing loaded yet.</td></tr>}
                </tbody>
                <tfoot className="font-bold"><tr><td className="py-2">{m.totals.shipments} shipment{m.totals.shipments === 1 ? "" : "s"}</td><td /><td /><td className="text-right">{m.totals.pieces}</td><td className="text-right">{m.totals.weightLb.toLocaleString()} lb</td><td /></tr></tfoot>
              </table>
            </div>
          </Section>
          {m.trip.status === "scheduled" && m.status === "open" && (
            <Section title="Load a cleared shipment on this trip">
              {candidates.length ? (
                <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); if (run(() => svc.assignShipmentToTrip(actor, assign, m.trip.id), "Loaded")) setAssign(""); }}>
                  <Select aria-label="Shipment" value={assign} onChange={(e) => setAssign(e.target.value)} className="max-w-md"><option value="">Choose a shipment…</option>{candidates.map((s) => <option key={s.id} value={s.id}>{s.id} · {svc.customerName(svc.findCustomer(s.customerId))} · {s.packageIds.length} pkg</option>)}</Select>
                  <Btn type="submit">Load</Btn>
                </form>
              ) : (
                <p className="text-ink-mute">No cleared shipments are waiting for this island and mode.</p>
              )}
            </Section>
          )}
        </>
      )}
    </OpsPage>
  );
}

export default function ManifestPage() {
  return (
    <Suspense>
      <Manifest />
    </Suspense>
  );
}
