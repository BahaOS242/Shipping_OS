"use client";

import { useState } from "react";
import { Btn, OpsPage } from "@/components/ops/OpsPage";
import { Field, Input, Select } from "@/components/ui/Field";
import { Section } from "@/components/ui/Section";
import { useAction } from "@/components/ui/Toast";
import { useLive } from "@/data/useLive";
import type { Vessel, VesselKind } from "@/domain/types";
import * as svc from "@/services";

export default function VesselsPage() {
  useLive();
  const run = useAction();
  const actor = svc.currentActor();
  const [form, setForm] = useState({ name: "", kind: "mailboat" as VesselKind, capacityLb: "40000", registration: "" });
  const vessels = svc.listVessels();
  const upcoming = svc.listTrips({ fromDaysAgo: 0, days: 14, status: "scheduled" });
  return (
    <OpsPage title="Vessels" sub="Your fleet. Capacity here is what the Capacity module enforces on every trip.">
      <Section title={`Fleet (${vessels.length})`} pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-ink-mute"><tr><th className="px-5 py-2">Vessel</th><th>Type</th><th>Capacity</th><th>Registration</th><th>Trips (14d)</th><th className="pr-5">Status</th></tr></thead>
            <tbody className="divide-y divide-[#eef1f4]">
              {vessels.map((v) => (
                <tr key={v.id}>
                  <td className="px-5 py-3 font-bold">🚢 {v.name}</td>
                  <td>{svc.VESSEL_KINDS.find((k) => k.id === v.kind)?.label}</td>
                  <td className="tabular-nums">{v.capacityLb.toLocaleString()} lb</td>
                  <td className="font-mono">{v.registration ?? "—"}</td>
                  <td>{upcoming.filter((t) => t.vesselId === v.id).length}</td>
                  <td className="pr-5">
                    <label className="sr-only" htmlFor={`st-${v.id}`}>Status of {v.name}</label>
                    <Select id={`st-${v.id}`} value={v.status} onChange={(e) => run(() => svc.setVesselStatus(actor, v.id, e.target.value as Vessel["status"]), "Status updated")} className="!min-h-10 max-w-40">
                      <option value="active">Active</option><option value="maintenance">Maintenance</option><option value="retired">Retired</option>
                    </Select>
                  </td>
                </tr>
              ))}
              {!vessels.length && <tr><td colSpan={6} className="px-5 py-6 text-ink-mute">No vessels yet — add your first below.</td></tr>}
            </tbody>
          </table>
        </div>
      </Section>
      <Section title="Add a vessel">
        <form className="grid gap-3 md:grid-cols-5" onSubmit={(e) => { e.preventDefault(); if (run(() => svc.createVessel(actor, { ...form, capacityLb: Number(form.capacityLb) }), (v) => `${v.name} added`)) setForm({ ...form, name: "", registration: "" }); }}>
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="MV Island Star" /></Field>
          <Field label="Type"><Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as VesselKind })}>{svc.VESSEL_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}</Select></Field>
          <Field label="Cargo capacity (lb)"><Input inputMode="numeric" value={form.capacityLb} onChange={(e) => setForm({ ...form, capacityLb: e.target.value })} /></Field>
          <Field label="Registration"><Input value={form.registration} onChange={(e) => setForm({ ...form, registration: e.target.value })} placeholder="Optional" /></Field>
          <div className="flex items-end"><Btn type="submit">Add vessel</Btn></div>
        </form>
      </Section>
    </OpsPage>
  );
}
