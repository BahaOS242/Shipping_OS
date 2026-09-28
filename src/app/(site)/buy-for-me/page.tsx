"use client";

import { useState } from "react";
import { CustomerView } from "@/components/customer/CustomerView";
import { Money } from "@/components/customer/Money";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { fmtDate } from "@/components/ui/Time";
import { useAction } from "@/components/ui/Toast";
import { customerPrice } from "@/domain/billing";
import * as svc from "@/services";

/** Procurement, customer side: "Tell us what you need and we'll get it to you." */
export default function BuyForMePage() {
  const run = useAction();
  const [what, setWhat] = useState("");
  const [qty, setQty] = useState(1);
  return (
    <CustomerView title="Buy for me">
      {(me, actor) => {
        const list = svc.listProcurements(me.id);
        return (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); if (run(() => svc.requestProcurement(actor, me.id, what, qty), "Request sent — we'll send you a price.")) setWhat(""); }}>
              <h1 className="text-4xl font-black tracking-tight">Tell us what you need.</h1>
              <p className="text-xl text-ink-soft">We find it, buy it, ship it and deliver it — and show you the full price up front.</p>
              <Field label="What do you need?"><Textarea rows={4} required value={what} onChange={(e) => setWhat(e.target.value)} placeholder="e.g. A 2-door commercial refrigerator for our kitchen" /></Field>
              <Field label="How many?"><Input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} /></Field>
              <Button type="submit" size="xl" full>Send request</Button>
            </form>
            <section>
              <h2 className="mb-3 text-2xl font-extrabold">Your requests</h2>
              {!list.length && <p className="text-ink-mute">No requests yet.</p>}
              <ul className="space-y-3">
                {list.map((p) => {
                  const price = p.costs ? customerPrice(p.costs, p.marginRate) : undefined;
                  return (
                    <li key={p.id}>
                      <Card className="p-5">
                        <p className="text-sm font-bold text-ink-mute">{p.id} · {fmtDate(p.createdAt)} · {svc.syncProcurementStatus(p)}</p>
                        <p className="text-lg font-extrabold">{p.product ?? p.request}</p>
                        {p.supplier && <p className="text-ink-soft">From {p.supplier}</p>}
                        {price && (
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sand-50 p-3">
                            <span><span className="block text-xs font-bold text-ink-mute">All-in price to your door (demo)</span><Money n={price.price} className="text-2xl font-black" /></span>
                            {p.status === "quoted" && <button onClick={() => run(() => svc.approveProcurement(actor, p.id), "Approved — we'll buy it.")} className="min-h-11 rounded-xl bg-sea-600 px-4 font-bold text-white">Approve</button>}
                          </div>
                        )}
                      </Card>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>
        );
      }}
    </CustomerView>
  );
}
