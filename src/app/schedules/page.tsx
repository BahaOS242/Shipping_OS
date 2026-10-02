"use client";

import { useState } from "react";
import { Btn, OpsPage } from "@/components/ops/OpsPage";
import { Field, Input, Select } from "@/components/ui/Field";
import { Section } from "@/components/ui/Section";
import { useAction } from "@/components/ui/Toast";
import { useLive } from "@/data/useLive";
import * as svc from "@/services";

export default function SchedulesPage() {
  useLive();
  const run = useAction();
  const actor = svc.currentActor();
  const routes = svc.listRoutes();
  const vessels = svc.listVessels().filter((v) => v.status === "active");
  const [form, setForm] = useState({ routeId: "", vesselId: "", days: [1, 4] as number[], departureTime: "07:00" });
  const trips = svc.listTrips({ fromDaysAgo: 0, days: 30 });
  return (
    <OpsPage title="Schedules" sub="Recurring sailings. Each schedule generates the trips customers book and manifests load.">
      <Section title={`Schedules (${svc.listSchedules().length})`} pad={false}>
        <ul className="divide-y divide-[#eef1f4]">
          {svc.listSchedules().map((sc) => {
            const r = svc.findRoute(sc.routeId);
            const v = svc.findVessel(sc.vesselId);
            const next = trips.filter((t) => t.scheduleId === sc.id);
            return (
              <li key={sc.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="font-bold">{v?.name} · <span className="font-mono">{r?.code}</span></p>
                  <p className="text-sm text-ink-soft">{sc.daysOfWeek.map((d) => svc.DAY_NAMES[d]).join(" · ")} at {sc.departureTime} · {next.length} trips in the next 30 days</p>
                </div>
                <Btn tone="light" onClick={() => run(() => svc.generateTrips(actor, sc.id, { days: 30 }), (c) => (c.length ? `${c.length} trips added` : "Trips are already up to date"))}>Generate next 30 days</Btn>
              </li>
            );
          })}
          {!svc.listSchedules().length && <li className="px-5 py-6 text-ink-mute">No schedules yet. Add routes and vessels first.</li>}
        </ul>
      </Section>
      <Section title="Add a schedule">
        <form className="grid gap-3 md:grid-cols-[1fr_1fr_1.6fr_auto_auto]" onSubmit={(e) => { e.preventDefault(); run(() => svc.createSchedule(actor, { routeId: form.routeId, vesselId: form.vesselId, daysOfWeek: form.days, departureTime: form.departureTime }), "Schedule added"); }}>
          <Field label="Route"><Select value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })}><option value="">Choose…</option>{routes.map((r) => <option key={r.id} value={r.id}>{r.code} · {r.name}</option>)}</Select></Field>
          <Field label="Vessel"><Select value={form.vesselId} onChange={(e) => setForm({ ...form, vesselId: e.target.value })}><option value="">Choose…</option>{vessels.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</Select></Field>
          <fieldset>
            <legend className="mb-1 text-sm font-bold text-ink-soft">Sailing days</legend>
            <div className="flex flex-wrap gap-1">
              {svc.DAY_NAMES.map((d, i) => {
                const on = form.days.includes(i);
                return (
                  <button type="button" key={d} aria-pressed={on} onClick={() => setForm({ ...form, days: on ? form.days.filter((x) => x !== i) : [...form.days, i] })} className={`min-h-11 rounded-lg px-3 text-sm font-bold ring-1 ${on ? "bg-ink text-white ring-ink" : "bg-white ring-[#dfe4ea]"}`}>{d}</button>
                );
              })}
            </div>
          </fieldset>
          <Field label="Departs"><Input type="time" value={form.departureTime} onChange={(e) => setForm({ ...form, departureTime: e.target.value })} /></Field>
          <div className="flex items-end"><Btn type="submit">Add</Btn></div>
        </form>
      </Section>
    </OpsPage>
  );
}
