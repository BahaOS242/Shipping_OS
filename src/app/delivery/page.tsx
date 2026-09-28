"use client";

import { useLive } from "@/data/useLive";
import { useState } from "react";
import { DeliveryPill } from "@/components/domain/Status";
import { CustomerLink, ShipmentLink } from "@/components/ops/Links";
import { Btn, OpsPage } from "@/components/ops/OpsPage";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Section, StatTile } from "@/components/ui/Section";
import { fmtDate, fmtDateTime } from "@/components/ui/Time";
import { useAction } from "@/components/ui/Toast";
import { PhotoTile, Signature } from "@/components/ui/Visuals";
import { DELIVERY_COPY } from "@/domain/copy";
import { fmtUsd } from "@/domain/rates";
import type { Delivery, DeliveryStatus } from "@/domain/types";
import * as svc from "@/services";

const COLS: DeliveryStatus[] = ["not_scheduled", "scheduled", "rescheduled", "out_for_delivery", "failed", "delivered"];

export default function DeliveryPage() {
  useLive();
  const run = useAction();
  const actor = svc.currentActor();
  const [method, setMethod] = useState<Delivery["method"]>("home_delivery");
  const [sched, setSched] = useState<Delivery | null>(null);
  const [done, setDone] = useState<Delivery | null>(null);
  const [fail, setFail] = useState<Delivery | null>(null);
  const [proof, setProof] = useState<Delivery | null>(null);
  const [now] = useState(() => Date.now());
  const [form, setForm] = useState(() => ({ date: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), from: "10:00", to: "13:00", driver: svc.DRIVERS[0], route: "Route A" }));
  const [who, setWho] = useState("");
  const [reason, setReason] = useState("Nobody home");
  const all = svc.listDeliveries();
  const list = all.filter((d) => d.method === method);

  const Card = ({ d }: { d: Delivery }) => {
    const pk = svc.shipmentPackagesById(d.shipmentId);
    return (
      <li className="rounded-2xl bg-white p-3 text-sm ring-1 ring-[#e3e7ec]">
        <p className="flex items-center justify-between gap-2"><span className="font-mono font-bold">{d.id}</span><DeliveryPill status={d.status} staff size="xs" /></p>
        <p className="mt-1"><CustomerLink id={d.customerId} /> · <ShipmentLink id={d.shipmentId} /></p>
        <p className="text-ink-soft">📍 {d.address}</p>
        <p className="text-ink-soft">📦 {pk.map((p) => p.merchant).join(", ")}</p>
        {d.window && d.method === "home_delivery" && <p className="text-ink-soft">🗓️ {fmtDate(d.window.date, { weekday: "short", month: "short", day: "numeric" })} {d.window.from}–{d.window.to}</p>}
        {d.driver && <p className="text-ink-soft">🚚 {d.driver} · {d.route}</p>}
        {d.fee > 0 && <p className="text-ink-soft">💵 Fee {fmtUsd(d.fee)}</p>}
        {d.notes.at(-1) && <p className="text-coral-700">📝 {d.notes.at(-1)!.text}</p>}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {d.method === "home_delivery" && ["not_scheduled", "failed", "scheduled", "rescheduled"].includes(d.status) && <Btn tone="light" onClick={() => { setSched(d); setForm({ ...form, driver: d.driver ?? svc.DRIVERS[0] }); }}>{d.status === "not_scheduled" ? "Schedule" : "Reschedule"}</Btn>}
          {["scheduled", "rescheduled"].includes(d.status) && d.method === "home_delivery" && <Btn tone="sea" onClick={() => run(() => svc.dispatchDelivery(actor, d.id), "Out for delivery — customer notified.")}>Dispatch</Btn>}
          {(d.status === "out_for_delivery" || (d.method === "pickup" && d.status === "scheduled")) && <Btn tone="sea" onClick={() => { setDone(d); setWho(svc.customerName(svc.findCustomer(d.customerId))); }}>{d.method === "pickup" ? "Collected" : "Delivered"}</Btn>}
          {d.status === "out_for_delivery" && <Btn tone="danger" onClick={() => setFail(d)}>Failed</Btn>}
          {d.proof && <Btn tone="light" onClick={() => setProof(d)}>Proof</Btn>}
        </div>
      </li>
    );
  };

  return (
    <OpsPage title="Delivery" sub="Last mile across The Bahamas — scheduling, drivers, proof of delivery.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="○" label="Not scheduled" value={all.filter((d) => d.status === "not_scheduled").length} tone={all.some((d) => d.status === "not_scheduled") ? "alert" : "neutral"} />
        <StatTile icon="🚚" label="Out for delivery" value={all.filter((d) => d.status === "out_for_delivery").length} />
        <StatTile icon="⚠" label="Failed" value={all.filter((d) => d.status === "failed").length} tone={all.some((d) => d.status === "failed") ? "alert" : "neutral"} />
        <StatTile icon="✅" label="Waiting for pickup" value={all.filter((d) => d.method === "pickup" && d.status === "scheduled").length} />
      </div>
      {(() => {
        const inbound = svc.listShipments({ status: "departed" });
        return (
          <Section title={`✈️🚢 On the way to The Bahamas (${inbound.length})`} pad={false}>
            {!inbound.length ? <p className="p-5 text-ink-mute">Nothing in transit.</p> : (
              <ul className="divide-y divide-[#eef1f4]">
                {inbound.map((s) => {
                  const v = svc.getVoyage(s.voyageId);
                  const late = v && new Date(v.arrivesAt).getTime() < now;
                  return (
                    <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                      <span><ShipmentLink id={s.id} /> · <CustomerLink id={s.customerId} /> · {s.packageIds.length} pcs → {svc.getDestination(s.destinationId).name}<span className={`block ${late ? "font-bold text-coral-700" : "text-ink-soft"}`}>{v?.label ?? "Trip"} · due {fmtDate(v?.arrivesAt, { weekday: "short", month: "short", day: "numeric" })}{late ? " · late" : ""}</span></span>
                      <Btn tone="sea" onClick={() => run(() => svc.arriveShipment(actor, s.id), `${s.id} arrived — ${s.deliveryMethod === "pickup" ? "ready for pickup" : "ready to schedule delivery"}.`)}>Mark arrived 🇧🇸</Btn>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        );
      })()}
      <div className="flex gap-1.5">
        {(["home_delivery", "pickup"] as const).map((m) => <button key={m} onClick={() => setMethod(m)} aria-pressed={method === m} className={`min-h-10 rounded-full px-3.5 text-sm font-bold ring-1 ${method === m ? "bg-ink text-white ring-ink" : "bg-white ring-[#e3e7ec]"}`}>{m === "home_delivery" ? "🚚 Home delivery" : "📍 Pickups"}</button>)}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {COLS.filter((c) => method === "home_delivery" || ["scheduled", "delivered"].includes(c)).map((c) => {
          const items = list.filter((d) => d.status === c);
          return (
            <Section key={c} title={<span>{DELIVERY_COPY[c].icon} {method === "pickup" && c === "scheduled" ? "Waiting for pickup" : DELIVERY_COPY[c].label} <span className="text-ink-mute">({items.length})</span></span>} className="bg-[#f7f9fa]">
              {items.length ? <ul className="space-y-2">{items.map((d) => <Card key={d.id} d={d} />)}</ul> : <p className="text-sm text-ink-mute">—</p>}
            </Section>
          );
        })}
      </div>

      <Modal open={!!sched} onClose={() => setSched(null)} title={`Schedule ${sched?.id ?? ""}`}>
        {sched && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (run(() => svc.scheduleDelivery(actor, sched.id, { ...form, date: new Date(form.date + "T12:00:00").toISOString() }), "Scheduled — customer notified.")) setSched(null); }}>
            <p className="text-ink-soft">📍 {sched.address}</p>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Date"><Input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
              <Field label="From"><Input type="time" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></Field>
              <Field label="To"><Input type="time" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} /></Field>
            </div>
            <Field label="Driver"><Select value={form.driver} onChange={(e) => setForm({ ...form, driver: e.target.value })}>{svc.DRIVERS.map((d) => <option key={d}>{d}</option>)}</Select></Field>
            <Field label="Route"><Input value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} /></Field>
            <Btn type="submit" tone="dark">Save</Btn>
          </form>
        )}
      </Modal>
      <Modal open={!!done} onClose={() => setDone(null)} title="Proof of delivery (simulated)">
        {done && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (run(() => svc.completeDelivery(actor, done.id, { receivedBy: who }), "Delivered 🎉 — customer notified.")) setDone(null); }}>
            <Field label="Received by"><Input required value={who} onChange={(e) => setWho(e.target.value)} /></Field>
            <p className="text-sm text-ink-mute">A signature, photo and GPS point are simulated for the demo.</p>
            <Btn type="submit" tone="sea">Mark {done.method === "pickup" ? "collected" : "delivered"}</Btn>
          </form>
        )}
      </Modal>
      <Modal open={!!fail} onClose={() => setFail(null)} title="Failed delivery">
        {fail && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (run(() => svc.failDelivery(actor, fail.id, reason), "Marked failed — customer notified.")) setFail(null); }}>
            <Field label="What happened?"><Select value={reason} onChange={(e) => setReason(e.target.value)}>{["Nobody home", "Gate locked — address not found", "Wrong address", "Customer refused", "Vehicle problem"].map((r) => <option key={r}>{r}</option>)}</Select></Field>
            <Btn type="submit" tone="danger">Save</Btn>
          </form>
        )}
      </Modal>
      <Modal open={!!proof} onClose={() => setProof(null)} title="Proof of delivery">
        {proof?.proof && (
          <div className="space-y-3">
            <Signature path={proof.proof.signature} name={proof.proof.receivedBy} />
            <PhotoTile id={proof.proof.photo} />
            <p className="text-sm">Received by <strong>{proof.proof.receivedBy}</strong> · {fmtDateTime(proof.proof.at)}{proof.proof.gps ? ` · ${proof.proof.gps}` : ""}</p>
          </div>
        )}
      </Modal>
    </OpsPage>
  );
}
