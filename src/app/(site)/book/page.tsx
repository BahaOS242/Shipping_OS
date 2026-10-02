"use client";

import { useState } from "react";
import { CustomerView } from "@/components/customer/CustomerView";
import { CapacityBar } from "@/components/ops/Network";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { fmtDateTime } from "@/components/ui/Time";
import { useAction } from "@/components/ui/Toast";
import * as svc from "@/services";

const LABEL = { requested: "Waiting for confirmation", confirmed: "Confirmed", checked_in: "Checked in", cancelled: "Cancelled" } as const;

/** Booking portal: customers reserve space on a scheduled sailing. */
export default function BookPage() {
  const run = useAction();
  const [form, setForm] = useState({ tripId: "", description: "", pieces: "1", weightLb: "" });
  return (
    <CustomerView title="Book cargo">
      {(me, actor) => {
        const trips = svc.bookableTrips();
        const mine = svc.listBookings({ customerId: me.id });
        const chosen = trips.find((t) => t.id === form.tripId);
        return (
          <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
            <form
              className="space-y-4 rounded-3xl bg-white p-6 ring-1 ring-sand-200"
              onSubmit={(e) => {
                e.preventDefault();
                if (run(() => svc.requestBooking(actor, { customerId: me.id, tripId: form.tripId, description: form.description, pieces: Number(form.pieces), weightLb: Number(form.weightLb) }), (b) => `Request ${b.id} sent. We'll confirm your space.`)) setForm({ ...form, description: "", weightLb: "" });
              }}
            >
              <h1 className="text-3xl font-black tracking-tight">Book space on a sailing</h1>
              <Field label="Sailing">
                <Select value={form.tripId} onChange={(e) => setForm({ ...form, tripId: e.target.value })}>
                  <option value="">Choose a sailing…</option>
                  {trips.map((t) => <option key={t.id} value={t.id}>{svc.findRoute(t.routeId)?.name} · {fmtDateTime(t.departsAt)}</option>)}
                </Select>
              </Field>
              {chosen && svc.isModuleEnabled("capacity") && <CapacityBar c={svc.tripCapacity(chosen)} />}
              <Field label="What are you shipping?"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g. 10 cases of groceries" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Pieces"><Input inputMode="numeric" value={form.pieces} onChange={(e) => setForm({ ...form, pieces: e.target.value })} /></Field>
                <Field label="Approx. weight (lb)"><Input inputMode="decimal" value={form.weightLb} onChange={(e) => setForm({ ...form, weightLb: e.target.value })} /></Field>
              </div>
              <Button type="submit">Request booking</Button>
            </form>
            <section>
              <h2 className="text-xl font-extrabold">Your bookings</h2>
              <ul className="mt-3 space-y-3">
                {mine.map((b) => {
                  const t = svc.getVoyage(b.tripId);
                  return (
                    <li key={b.id} className="rounded-2xl bg-white p-4 ring-1 ring-sand-200">
                      <p className="flex flex-wrap items-center gap-2"><span className="font-bold">{b.description}</span><Pill size="xs" tone={b.status === "cancelled" ? "bad" : b.status === "requested" ? "moving" : "good"}>{LABEL[b.status]}</Pill></p>
                      <p className="text-sm text-ink-soft">{t?.label} · {fmtDateTime(t?.departsAt)} · {b.pieces} pc · {b.weightLb} lb</p>
                      {(b.status === "requested" || b.status === "confirmed") && <button className="mt-2 min-h-11 text-sm font-bold text-coral-700" onClick={() => run(() => svc.cancelBooking(actor, b.id, "Cancelled by customer"), "Booking cancelled")}>Cancel booking</button>}
                    </li>
                  );
                })}
                {!mine.length && <li className="text-ink-mute">No bookings yet.</li>}
              </ul>
            </section>
          </div>
        );
      }}
    </CustomerView>
  );
}
