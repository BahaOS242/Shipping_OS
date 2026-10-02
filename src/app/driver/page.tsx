"use client";

import { useState } from "react";
import { DeliveryPill } from "@/components/domain/Status";
import { Btn, OpsPage } from "@/components/ops/OpsPage";
import { Field, Input, Select } from "@/components/ui/Field";
import { Section } from "@/components/ui/Section";
import { fmtDate } from "@/components/ui/Time";
import { useAction } from "@/components/ui/Toast";
import { Signature } from "@/components/ui/Visuals";
import { useLive } from "@/data/useLive";
import * as svc from "@/services";

/** Driver portal: a driver's run for the day, with proof of delivery. Dispatch can look at any driver's run. */
export default function DriverPage() {
  useLive();
  const run = useAction();
  const actor = svc.currentActor();
  const drivers = svc.listDrivers();
  const isDriver = actor.role === "driver";
  const [picked, setPicked] = useState(drivers[0] ?? "");
  const driver = isDriver ? actor.name : picked;
  const list = svc.driverRun(driver);
  const [who, setWho] = useState<Record<string, string>>({});
  return (
    <OpsPage
      title={isDriver ? `Your run, ${actor.name.split(" ")[0]}` : "Driver runs"}
      sub="Start each stop, then capture who received it. Failed attempts go back to dispatch."
      actions={!isDriver && <Select aria-label="Driver" value={picked} onChange={(e) => setPicked(e.target.value)} className="!min-h-11">{drivers.map((d) => <option key={d}>{d}</option>)}</Select>}
    >
      <Section title={`${list.length} stop${list.length === 1 ? "" : "s"}`} pad={false}>
        <ol className="divide-y divide-[#eef1f4]">
          {list.map((d, i) => {
            const c = svc.findCustomer(d.customerId);
            return (
              <li key={d.id} className="grid gap-3 px-5 py-4 md:grid-cols-[auto_1fr_auto] md:items-center">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-ink font-black text-white">{i + 1}</span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2"><span className="font-bold">{svc.customerName(c)}</span><DeliveryPill status={d.status} staff size="xs" /></p>
                  <p className="text-ink-soft">📍 {d.address}</p>
                  <p className="text-sm text-ink-mute">{d.window ? `${fmtDate(d.window.date)} · ${d.window.from}–${d.window.to}` : ""}{c?.phone ? ` · 📞 ${c.phone}` : ""}</p>
                  {d.proof && <div className="mt-1 flex items-center gap-2 text-sm text-ink-soft"><Signature path={d.proof.signature} name={d.proof.receivedBy} /> Received by {d.proof.receivedBy}</div>}
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  {["scheduled", "rescheduled"].includes(d.status) && <Btn onClick={() => run(() => svc.dispatchDelivery(actor, d.id), "On the way")}>Start</Btn>}
                  {d.status === "out_for_delivery" && (
                    <>
                      <Field label="Received by"><Input value={who[d.id] ?? ""} onChange={(e) => setWho({ ...who, [d.id]: e.target.value })} className="!min-h-11 w-44" /></Field>
                      <Btn tone="sea" onClick={() => run(() => svc.completeDelivery(actor, d.id, { receivedBy: who[d.id] ?? "" }), "Delivered — proof saved")}>Delivered</Btn>
                      <Btn tone="danger" onClick={() => run(() => svc.failDelivery(actor, d.id, "Nobody home"), "Marked as missed")}>Nobody home</Btn>
                    </>
                  )}
                </div>
              </li>
            );
          })}
          {!list.length && <li className="px-5 py-6 text-ink-mute">No stops on this run.</li>}
        </ol>
      </Section>
    </OpsPage>
  );
}
