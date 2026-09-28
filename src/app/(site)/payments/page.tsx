"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CustomerView } from "@/components/customer/CustomerView";
import { Money } from "@/components/customer/Money";
import { BillPill } from "@/components/domain/Status";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { fmtDate } from "@/components/ui/Time";
import { useAction } from "@/components/ui/Toast";
import { BILLING_RULES } from "@/domain/billing";
import { fmtUsd } from "@/domain/rates";
import * as svc from "@/services";

const KIND_LABEL: Record<string, string> = { shipping: "Shipping", island_delivery: "Shipping", delivery: "Delivery", storage: "Storage", procurement: "Buy for me", customs_duty: "Customs duty (government)", handling: "Other charges", other: "Other charges" };

export default function PaymentsPage() {
  return <Suspense><Payments /></Suspense>;
}

function Payments() {
  const sp = useSearchParams();
  const run = useAction();
  const [view, setView] = useState<string | null>(sp.get("bill"));
  const [paying, setPaying] = useState<string | null>(null);
  return (
    <CustomerView title="Balance & Payments">
      {(me, actor) => {
        const bal = svc.customerBalance(me.id);
        const bills = svc.listBills({ customerId: me.id }).filter((b) => b.lifecycle === "issued");
        const kinds = Object.entries(bal.byKind).reduce<Record<string, number>>((acc, [k, v]) => ({ ...acc, [KIND_LABEL[k]]: (acc[KIND_LABEL[k]] ?? 0) + v }), {});
        const b = view ? svc.findBill(view) : undefined;
        const bv = b ? svc.billView(b) : undefined;
        const pay = paying ? svc.billView(svc.getBill(paying)) : undefined;
        return (
          <div className="space-y-6">
            <header>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Balance &amp; Payments</h1>
              <p className="mt-1 text-xl text-ink-soft">What you owe, what you paid. <span className="font-bold text-sun-700">DEMO PAYMENTS only — no real money moves.</span></p>
            </header>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Card className="col-span-2 bg-ink p-5 text-white lg:col-span-1"><p className="text-sm font-bold text-white/70">Balance</p><p className="text-4xl font-black text-sun-300"><Money n={bal.balance} /></p></Card>
              <Card className="p-5"><p className="text-sm font-bold text-ink-mute">Amount due next</p><p className="text-2xl font-black"><Money n={bal.nextDue?.balance ?? 0} /></p><p className="text-sm text-ink-mute">{bal.nextDue ? `by ${fmtDate(bal.nextDue.dueAt)}` : "Nothing due"}</p></Card>
              <Card className="p-5"><p className="text-sm font-bold text-ink-mute">Paid (all time)</p><p className="text-2xl font-black"><Money n={bal.paid} /></p></Card>
              <Card className={`p-5 ${bal.overdue ? "bg-coral-50 ring-coral-100" : ""}`}><p className="text-sm font-bold text-ink-mute">Overdue</p><p className={`text-2xl font-black ${bal.overdue ? "text-coral-700" : ""}`}><Money n={bal.overdue} /></p></Card>
            </div>

            {bal.balance > 0 && (
              <Card className="p-5">
                <h2 className="font-extrabold">What your balance is for</h2>
                <ul className="mt-2 grid gap-2 sm:grid-cols-3">
                  {Object.entries(kinds).map(([k, v]) => <li key={k} className="flex justify-between rounded-xl bg-sand-50 px-3 py-2"><span>{k}</span><strong><Money n={v} /></strong></li>)}
                </ul>
                <p className="mt-2 text-xs text-ink-mute">Includes {BILLING_RULES.vatRate * 100}% VAT on Shipping OS&apos;s services.</p>
              </Card>
            )}

            <section>
              <h2 className="mb-3 text-2xl font-extrabold">Bills</h2>
              {!bills.length ? <EmptyState icon="🧾" title="No bills yet" /> : (
                <ul className="space-y-3">
                  {bills.map((x) => (
                    <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-sand-200">
                      <span>
                        <span className="flex flex-wrap items-center gap-2 text-lg font-extrabold">{x.id} <BillPill status={x.status} /></span>
                        <span className="text-ink-soft">{x.lines[0]?.description.split(" · ")[0]}{x.shipmentId ? ` · ${x.shipmentId}` : ""} · issued {fmtDate(x.issuedAt)}{x.balance > 0 ? ` · due ${fmtDate(x.dueAt)}` : ""}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="mr-2 text-right"><span className="block text-xl font-black"><Money n={x.balance > 0 ? x.balance : x.total} /></span><span className="text-xs text-ink-mute">{x.balance > 0 ? "to pay" : "total"}</span></span>
                        <button onClick={() => setView(x.id)} className="min-h-11 rounded-xl px-3 font-bold ring-1 ring-sand-200">View Invoice</button>
                        {x.balance > 0 && <button onClick={() => setPaying(x.id)} className="min-h-11 rounded-xl bg-sun-400 px-4 font-bold">Pay Now</button>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="mb-3 text-2xl font-extrabold">Payment history</h2>
              {!bal.payments.length ? <p className="text-ink-mute">No payments yet.</p> : (
                <ul className="divide-y divide-sand-200 rounded-2xl bg-white ring-1 ring-sand-200">
                  {bal.payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                      <span><strong>{p.id}</strong> <span className="text-ink-soft">· {p.method.replace("_", " ")} · {fmtDate(p.receivedAt)}{p.billId ? ` · for ${p.billId}` : " · not linked to a bill yet"}</span></span>
                      <span className="flex items-center gap-2"><span className="rounded bg-sun-100 px-1.5 text-[11px] font-black text-sun-700">DEMO PAYMENT</span><strong><Money n={p.amount} /></strong></span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <Modal open={!!bv} onClose={() => setView(null)} title={bv ? `Invoice ${bv.id}` : ""}>
              {bv && (
                <div className="space-y-3">
                  <BillPill status={bv.status} size="md" />
                  <ul className="divide-y divide-sand-200">
                    {bv.lines.map((l) => <li key={l.id} className="flex justify-between gap-4 py-2"><span>{l.description}</span><span className="tabular-nums">{fmtUsd(l.amount)}</span></li>)}
                    <li className="flex justify-between py-2 text-ink-soft"><span>VAT {BILLING_RULES.vatRate * 100}% (on our services)</span><span>{fmtUsd(bv.vat)}</span></li>
                    <li className="flex justify-between py-2 text-lg font-black"><span>Total</span><span>{fmtUsd(bv.total)}</span></li>
                    {bv.paid > 0 && <li className="flex justify-between py-2 text-emerald-800"><span>Paid</span><span>−{fmtUsd(bv.paid)}</span></li>}
                    {bv.balance > 0 && <li className="flex justify-between py-2 text-lg font-black"><span>To pay</span><span>{fmtUsd(bv.balance)}</span></li>}
                  </ul>
                  {bv.balance > 0 && <Button full onClick={() => { setView(null); setPaying(bv.id); }}>Pay Now</Button>}
                </div>
              )}
            </Modal>
            <Modal open={!!pay} onClose={() => setPaying(null)} title="Pay your bill">
              {pay && (
                <div className="space-y-4 text-center">
                  <p className="text-ink-soft">Bill {pay.id}</p>
                  <p className="text-5xl font-black">{fmtUsd(pay.balance)}</p>
                  <p className="rounded-2xl bg-sun-50 p-3 font-semibold text-sun-700 ring-1 ring-sun-300">DEMO PAYMENT — this is simulated. No card is charged and no money moves.</p>
                  <Button size="xl" full variant="gold" onClick={() => { const r = run(() => svc.demoPay(actor, pay.id), (p) => `Paid ${fmtUsd(p.amount)} (demo). Thank you!`); if (r) setPaying(null); }}>
                    💳 Pay {fmtUsd(pay.balance)} (demo)
                  </Button>
                  <p className="text-sm text-ink-mute">You can also pay in person at any pickup center.</p>
                </div>
              )}
            </Modal>
          </div>
        );
      }}
    </CustomerView>
  );
}
