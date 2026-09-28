"use client";

import { useLive } from "@/data/useLive";
import Link from "next/link";
import { use, useState } from "react";
import { Activity } from "@/components/domain/Activity";
import { BillPill } from "@/components/domain/Status";
import { CustomerLink, PackageLink, ShipmentLink } from "@/components/ops/Links";
import { Btn, OpsPage } from "@/components/ops/OpsPage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { Section } from "@/components/ui/Section";
import { fmtDate } from "@/components/ui/Time";
import { useAction } from "@/components/ui/Toast";
import { BILLING_RULES } from "@/domain/billing";
import { fmtUsd } from "@/domain/rates";
import type { PaymentMethod } from "@/domain/types";
import * as svc from "@/services";

export default function BillPage({ params }: { params: Promise<{ id: string }> }) {
  useLive();
  const { id } = use(params);
  const run = useAction();
  const actor = svc.currentActor();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const b0 = svc.findBill(id);
  if (!b0) return <EmptyState icon="🔎" title={`No bill ${id}`} />;
  const b = svc.billView(b0);
  const row = svc.reconciliationRows().find((r) => r.billId === b.id);
  return (
    <OpsPage eyebrow={<Link href="/accounting?tab=bills" className="text-sea-700">← Accounting</Link>} title={<span className="font-mono">{b.id}</span>} sub={<span className="flex flex-wrap items-center gap-2"><CustomerLink id={b.customerId} /> · <ShipmentLink id={b.shipmentId} /> <BillPill status={b.status} /></span>}>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Section title="Invoice lines">
          <table className="w-full text-left">
            <tbody className="divide-y divide-[#eef1f4]">
              {b.lines.map((l) => <tr key={l.id}><td className="py-2 pr-3">{l.description}{l.packageId && <> · <PackageLink id={l.packageId} /></>}{!l.taxable && <span className="ml-2 rounded bg-[#eef1f4] px-1.5 text-xs">no VAT</span>}</td><td className="py-2 text-right tabular-nums">{fmtUsd(l.amount)}</td></tr>)}
            </tbody>
            <tfoot className="text-right tabular-nums">
              <tr><td className="pt-3 text-ink-soft">Subtotal</td><td className="pt-3">{fmtUsd(b.subtotal)}</td></tr>
              <tr><td className="text-ink-soft">VAT {BILLING_RULES.vatRate * 100}%</td><td>{fmtUsd(b.vat)}</td></tr>
              <tr className="text-lg font-black"><td>Total</td><td>{fmtUsd(b.total)}</td></tr>
              <tr className="text-emerald-800"><td>Paid</td><td>−{fmtUsd(b.paid)}</td></tr>
              <tr className="text-lg font-black"><td>Balance</td><td>{fmtUsd(b.balance)}</td></tr>
            </tfoot>
          </table>
          <p className="mt-3 text-sm text-ink-mute">Issued {fmtDate(b.issuedAt)} · due {fmtDate(b.dueAt)} · {b.currency} · all payments are DEMO payments.</p>
          {b.reconciledBy && <p className="mt-2 rounded-xl bg-emerald-50 p-3 text-emerald-900">✓ Accepted by {b.reconciledBy}: {b.reconciliationNote}</p>}
        </Section>
        <div className="space-y-5">
          <Section title="Reconciliation">
            {row ? <p className="font-semibold">{row.status.replace("_", " ")} — {row.reason}</p> : <p className="text-ink-mute">Not issued.</p>}
            <ul className="mt-2 space-y-1 text-sm">{b.payments.map((p) => <li key={p.id}>💳 {p.id} · {fmtUsd(p.amount)} · {p.method} · {fmtDate(p.receivedAt)}{p.reference ? ` · ${p.reference}` : ""}</li>)}</ul>
          </Section>
          {b.lifecycle === "issued" && b.balance > 0 && (
            <Section title="Record payment (DEMO)">
              <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (run(() => svc.recordPayment(actor, { customerId: b.customerId, billId: b.id, amount: Number(amount || b.balance), method }), "Payment recorded.")) setAmount(""); }}>
                <Field label={`Amount (balance ${fmtUsd(b.balance)})`}><Input type="number" step="0.01" value={amount} placeholder={String(b.balance)} onChange={(e) => setAmount(e.target.value)} /></Field>
                <Field label="Method"><Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>{["cash", "card", "bank_transfer", "online"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}</Select></Field>
                <Btn type="submit" tone="dark">Save payment</Btn>
              </form>
            </Section>
          )}
          {row?.status === "needs_review" && (
            <Section title="Accept difference">
              <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => svc.acceptDifference(actor, b.id, note), "Accepted."); }}>
                <Input required value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (logged)" aria-label="Reason" />
                <Btn type="submit" tone="light">Accept {fmtUsd(Math.abs(row.difference))} difference</Btn>
              </form>
            </Section>
          )}
          {b.lifecycle === "issued" && !b.payments.length && (
            <Section title="Void">
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => svc.voidBill(actor, b.id, reason), "Voided."); }}>
                <Input required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason" aria-label="Void reason" />
                <Btn type="submit" tone="danger">Void</Btn>
              </form>
            </Section>
          )}
          <Section title="Audit"><Activity events={svc.timeline({ billId: b.id })} /></Section>
        </div>
      </div>
    </OpsPage>
  );
}
