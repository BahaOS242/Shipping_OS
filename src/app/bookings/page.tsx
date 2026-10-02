"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Btn, OpsPage } from "@/components/ops/OpsPage";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { Section } from "@/components/ui/Section";
import { Ago, fmtDateTime } from "@/components/ui/Time";
import { useAction } from "@/components/ui/Toast";
import { useLive } from "@/data/useLive";
import type { Booking, BookingStatus } from "@/domain/types";
import * as svc from "@/services";

const STATUS: Record<BookingStatus, { label: string; tone: "neutral" | "moving" | "good" | "done" | "bad" }> = {
  requested: { label: "Waiting to confirm", tone: "moving" },
  confirmed: { label: "Confirmed", tone: "good" },
  checked_in: { label: "Checked in", tone: "done" },
  cancelled: { label: "Cancelled", tone: "bad" },
};

function Bookings() {
  useLive();
  const run = useAction();
  const actor = svc.currentActor();
  const params = useSearchParams();
  const [status, setStatus] = useState<BookingStatus | "">((params.get("status") as BookingStatus) ?? "");
  const [checkIn, setCheckIn] = useState<Booking | null>(null);
  const [weight, setWeight] = useState("");
  const trips = svc.bookableTrips();
  const customers = svc.listCustomers();
  const [form, setForm] = useState({ customerId: "", tripId: "", description: "", pieces: "1", weightLb: "" });
  const list = svc.listBookings(status ? { status } : {});
  const trip = (id: string) => svc.getVoyage(id);
  return (
    <OpsPage title="Bookings" sub="Space reserved on trips. Confirming checks capacity; check-in at the dock creates the shipment and loads it on the trip.">
      <Section
        title={`Bookings (${list.length})`}
        action={
          <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as BookingStatus | "")} className="!min-h-10 max-w-52">
            <option value="">All</option>
            {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        }
        pad={false}
      >
        <ul className="divide-y divide-[#eef1f4]">
          {list.map((b) => {
            const t = trip(b.tripId);
            return (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2"><span className="font-mono font-bold">{b.id}</span><Pill tone={STATUS[b.status].tone} size="xs">{STATUS[b.status].label}</Pill><span className="text-sm text-ink-mute">by {b.createdBy} · <Ago iso={b.createdAt} /></span></p>
                  <p className="font-semibold">{svc.customerName(svc.findCustomer(b.customerId))} — {b.description}</p>
                  <p className="text-sm text-ink-soft">{b.pieces} pc · {b.weightLb.toLocaleString()} lb · {t?.label} · departs {fmtDateTime(t?.departsAt)}{b.shipmentId ? ` · shipment ${b.shipmentId}` : ""}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {b.status === "requested" && <Btn onClick={() => run(() => svc.confirmBooking(actor, b.id), "Confirmed")}>Confirm</Btn>}
                  {b.status === "confirmed" && <Btn tone="sea" onClick={() => { setCheckIn(b); setWeight(String(b.weightLb)); }}>Check in cargo</Btn>}
                  {(b.status === "requested" || b.status === "confirmed") && <Btn tone="danger" onClick={() => run(() => svc.cancelBooking(actor, b.id, "Cancelled by staff"), "Cancelled")}>Cancel</Btn>}
                </div>
              </li>
            );
          })}
          {!list.length && <li className="px-5 py-6 text-ink-mute">No bookings.</li>}
        </ul>
      </Section>
      <Section title="New booking (confirmed straight away)">
        <form className="grid gap-3 md:grid-cols-6" onSubmit={(e) => { e.preventDefault(); if (run(() => svc.requestBooking(actor, { customerId: form.customerId, tripId: form.tripId, description: form.description, pieces: Number(form.pieces), weightLb: Number(form.weightLb) }), (b) => `${b.id} confirmed`)) setForm({ ...form, description: "", weightLb: "" }); }}>
          <Field label="Customer"><Select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}><option value="">Choose…</option>{customers.map((c) => <option key={c.id} value={c.id}>{svc.customerName(c)}</option>)}</Select></Field>
          <Field label="Trip"><Select value={form.tripId} onChange={(e) => setForm({ ...form, tripId: e.target.value })}><option value="">Choose…</option>{trips.map((t) => { const c = svc.tripCapacity(t); return <option key={t.id} value={t.id}>{t.label} · {fmtDateTime(t.departsAt)}{c.remainingLb !== undefined ? ` · ${c.remainingLb.toLocaleString()} lb free` : ""}</option>; })}</Select></Field>
          <Field label="Cargo"><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="10 cases of water" /></Field>
          <Field label="Pieces"><Input inputMode="numeric" value={form.pieces} onChange={(e) => setForm({ ...form, pieces: e.target.value })} /></Field>
          <Field label="Weight (lb)"><Input inputMode="decimal" value={form.weightLb} onChange={(e) => setForm({ ...form, weightLb: e.target.value })} /></Field>
          <div className="flex items-end"><Btn type="submit">Book</Btn></div>
        </form>
      </Section>
      <Modal open={!!checkIn} onClose={() => setCheckIn(null)} title={`Check in ${checkIn?.id ?? ""}`}>
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (checkIn && run(() => svc.checkInBooking(actor, checkIn.id, { actualWeight: Number(weight) }), (r) => `${r.shipment.id} loaded on the trip`)) setCheckIn(null); }}>
          <p className="text-ink-soft">{checkIn?.description} · booked at {checkIn?.weightLb.toLocaleString()} lb</p>
          <Field label="Weighed at the dock (lb)"><Input inputMode="decimal" value={weight} onChange={(e) => setWeight(e.target.value)} autoFocus /></Field>
          <Btn type="submit" tone="sea">Check in &amp; load</Btn>
        </form>
      </Modal>
    </OpsPage>
  );
}

export default function BookingsPage() {
  return (
    <Suspense>
      <Bookings />
    </Suspense>
  );
}
