"use client";

import { useLive } from "@/data/useLive";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BillPill, ReceiptPill, ReconPill } from "@/components/domain/Status";
import { Confidence } from "@/components/invoice/Extraction";
import { downloadCsv } from "@/components/ops/csv";
import { BillLink, CustomerLink, ShipmentLink } from "@/components/ops/Links";
import { Btn, OpsPage } from "@/components/ops/OpsPage";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Section, StatTile } from "@/components/ui/Section";
import { fmtDate } from "@/components/ui/Time";
import { useAction } from "@/components/ui/Toast";
import { BILL_STATUS_COPY, type BillStatus } from "@/domain/billing";
import { fmtUsd } from "@/domain/rates";
import type { PaymentMethod } from "@/domain/types";
import * as svc from "@/services";

type Tab = "bills" | "reconciliation" | "invoices" | "payments";

export default function AccountingPage() {
  useLive();
  return <Suspense><Accounting /></Suspense>;
}

function Accounting() {
  useLive();
  const sp = useSearchParams();
  const run = useAction();
  const actor = svc.currentActor();
  const [tab, setTab] = useState<Tab>((sp.get("tab") as Tab) ?? "reconciliation");
  const [f, setF] = useState({ customer: "", merchant: "", status: "", currency: "", dest: "", since: "", shipment: "" });
  const [pay, setPay] = useState<{ billId?: string; customerId: string } | null>(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [ref, setRef] = useState("");
  const [accept, setAccept] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const recon = svc.reconciliationRows();
  const invoices = svc.listPurchaseInvoices();
  const payments = [...svc.listPayments()];
  const sinceMs = f.since ? Date.now() - Number(f.since) * 86_400_000 : 0;
  const bills = svc.listBills().filter((b) =>
    (!f.customer || b.customerId === f.customer) && (!f.status || b.status === f.status) && (!f.shipment || (b.shipmentId ?? "").includes(f.shipment.toUpperCase())) &&
    (!f.dest || svc.findShipment(b.shipmentId)?.destinationId === f.dest) && new Date(b.issuedAt ?? b.createdAt).getTime() >= sinceMs,
  );
  const invs = invoices.filter((i) => (!f.customer || i.customerId === f.customer) && (!f.merchant || i.merchant === f.merchant) && (!f.status || i.status === f.status) && (!f.currency || i.currency === f.currency) && new Date(i.source.uploadedAt).getTime() >= sinceMs);
  const merchants = [...new Set(invoices.map((i) => i.merchant))].sort();
  const missingInvoices = svc.listExceptions({ type: "MISSING_INVOICE", status: "active" }).length;

  const exportTab = () => {
    if (tab === "bills" || tab === "reconciliation") downloadCsv("the-link-bills", ["Bill", "Customer", "Shipment", "Status", "Total", "Paid", "Balance", "Issued", "Due"], bills.map((b) => [b.id, svc.customerName(svc.findCustomer(b.customerId)), b.shipmentId, b.status, b.total.toFixed(2), b.paid.toFixed(2), b.balance.toFixed(2), b.issuedAt?.slice(0, 10), b.dueAt?.slice(0, 10)]));
    else if (tab === "invoices") downloadCsv("the-link-purchase-invoices", ["ID", "Merchant", "Invoice", "Order", "Customer", "Package", "Shipment", "Currency", "Total", "Status", "Confidence"], invs.map((i) => [i.id, i.merchant, i.invoiceNumber, i.orderNumber, svc.customerName(svc.findCustomer(i.customerId)), i.packageId, i.shipmentId, i.currency, i.total.toFixed(2), i.status, Math.round(i.confidence * 100)]));
    else downloadCsv("the-link-payments", ["Payment", "Customer", "Bill", "Amount", "Method", "Reference", "Received"], payments.map((p) => [p.id, svc.customerName(svc.findCustomer(p.customerId)), p.billId ?? "UNMATCHED", p.amount.toFixed(2), p.method, p.reference, p.receivedAt.slice(0, 10)]));
  };

  const Filters = (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
      <Field label="Customer"><Select value={f.customer} onChange={(e) => setF({ ...f, customer: e.target.value })}><option value="">All</option>{svc.listCustomers().map((c) => <option key={c.id} value={c.id}>{svc.customerName(c)}</option>)}</Select></Field>
      {tab === "invoices" ? (
        <>
          <Field label="Merchant"><Select value={f.merchant} onChange={(e) => setF({ ...f, merchant: e.target.value })}><option value="">All</option>{merchants.map((m) => <option key={m}>{m}</option>)}</Select></Field>
          <Field label="Invoice status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">All</option>{["needs_review", "matched", "verified", "rejected"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}</Select></Field>
          <Field label="Currency"><Select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}><option value="">All</option>{["USD", "GBP", "CAD", "BSD"].map((c) => <option key={c}>{c}</option>)}</Select></Field>
        </>
      ) : (
        <>
          <Field label="Payment status"><Select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="">All</option>{(Object.keys(BILL_STATUS_COPY) as BillStatus[]).map((s) => <option key={s} value={s}>{BILL_STATUS_COPY[s].label}</option>)}</Select></Field>
          <Field label="Shipment"><Input value={f.shipment} onChange={(e) => setF({ ...f, shipment: e.target.value })} placeholder="TL-SHP-…" /></Field>
          <Field label="Destination"><Select value={f.dest} onChange={(e) => setF({ ...f, dest: e.target.value })}><option value="">All</option>{svc.getDestinations().map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
        </>
      )}
      <Field label="Date"><Select value={f.since} onChange={(e) => setF({ ...f, since: e.target.value })}><option value="">Any</option><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></Select></Field>
    </div>
  );

  return (
    <OpsPage title="Accounting" sub="Bills, DEMO payments, reconciliation and store invoices — one set of records." actions={<Btn tone="light" onClick={exportTab}>⬇ Export CSV</Btn>}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="🧾" label="Invoices processed" value={invoices.filter((i) => i.status !== "processing").length} sub={`${invoices.filter((i) => i.status === "needs_review").length} need review`} />
        <StatTile icon="⚠" label="Pending reconciliation" value={recon.filter((r) => r.status === "needs_review").length} tone="alert" />
        <StatTile icon="📄" label="Missing invoices" value={missingInvoices} />
        <StatTile icon="≠" label="Unmatched payments" value={recon.filter((r) => r.status === "unmatched_payment").length} tone={recon.some((r) => r.status === "unmatched_payment") ? "alert" : "neutral"} />
      </div>
      <nav className="flex flex-wrap gap-1.5" aria-label="Accounting views">
        {([["reconciliation", "Reconciliation"], ["bills", "Bills"], ["invoices", "Store invoices"], ["payments", "Payments"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => { setTab(k); setF({ ...f, status: "" }); }} aria-pressed={tab === k} className={`min-h-10 rounded-full px-3.5 text-sm font-bold ring-1 ${tab === k ? "bg-ink text-white ring-ink" : "bg-white ring-[#e3e7ec]"}`}>{l}</button>
        ))}
      </nav>
      {tab !== "reconciliation" && Filters}

      {tab === "reconciliation" && (
        <Section title="Does the money match?" pad={false}>
          <ul className="divide-y divide-[#eef1f4]">
            {recon.filter((r) => r.status !== "matched" && r.status !== "accepted").concat(recon.filter((r) => r.status === "matched" || r.status === "accepted")).map((r) => (
              <li key={(r.billId ?? "") + r.paymentIds.join()} className="grid gap-2 px-5 py-3 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center">
                <span>{r.billId ? <BillLink id={r.billId} /> : <span className="font-mono font-bold">{r.paymentIds[0]}</span>}<span className="block text-sm text-ink-soft"><CustomerLink id={r.customerId} /></span></span>
                <span className="text-sm tabular-nums">Billed <strong>{fmtUsd(r.billed)}</strong> · Paid <strong>{fmtUsd(r.paid)}</strong>{Math.abs(r.difference) > 0.01 && r.billId && <span className="block font-bold text-coral-700">Difference {fmtUsd(Math.abs(r.difference))}</span>}</span>
                <span className="text-sm"><ReconPill status={r.status} /> <span className="block text-ink-soft">{r.reason}</span></span>
                <span className="flex flex-wrap gap-2">
                  {r.status === "unmatched_payment" && r.suggestion && <Btn tone="sea" onClick={() => run(() => svc.applyPayment(actor, r.paymentIds[0], r.suggestion!), `Applied to ${r.suggestion}.`)}>Apply to {r.suggestion}</Btn>}
                  {r.status === "needs_review" && <Btn tone="light" onClick={() => { setAccept(r.billId!); setNote(""); }}>Reconcile</Btn>}
                  {r.status === "awaiting_payment" && <Btn tone="light" onClick={() => { setPay({ billId: r.billId, customerId: r.customerId }); setAmount(String(Math.abs(r.difference))); }}>Record payment</Btn>}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {tab === "bills" && (
        <Section title={`${bills.length} bills · ${fmtUsd(bills.reduce((a, b) => a + b.balance, 0))} outstanding`} pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-ink-mute"><tr><th className="px-5 py-3">Invoice</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Merchant(s)</th><th className="px-3 py-3">Shipment</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3">Currency</th><th className="px-3 py-3">Payment</th><th className="px-5 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-[#eef1f4]">
                {bills.map((b) => (
                  <tr key={b.id} className="hover:bg-[#f7f9fa]">
                    <td className="px-5 py-3"><BillLink id={b.id} /><span className="block text-xs text-ink-mute">{fmtDate(b.issuedAt)}</span></td>
                    <td className="px-3 py-3"><CustomerLink id={b.customerId} /></td>
                    <td className="px-3 py-3">{[...new Set(svc.shipmentPackagesById(b.shipmentId).map((p) => p.merchant))].join(", ") || (b.procurementId ? "Procurement" : "—")}</td>
                    <td className="px-3 py-3"><ShipmentLink id={b.shipmentId} /></td>
                    <td className="px-3 py-3 text-right tabular-nums">{fmtUsd(b.total)}</td>
                    <td className="px-3 py-3">{b.currency}</td>
                    <td className="px-3 py-3 tabular-nums">{fmtUsd(b.paid)}{b.balance > 0 && <span className="block text-xs text-coral-700">{fmtUsd(b.balance)} due</span>}</td>
                    <td className="px-5 py-3"><BillPill status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tab === "invoices" && (
        <Section title={`${invs.length} store invoices (Invoice Engine)`} pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-ink-mute"><tr><th className="px-5 py-3">Invoice</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Merchant</th><th className="px-3 py-3">Package / shipment</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3">Confidence</th><th className="px-5 py-3">Status</th></tr></thead>
              <tbody className="divide-y divide-[#eef1f4]">
                {invs.map((i) => (
                  <tr key={i.id} className="relative hover:bg-[#f7f9fa]">
                    <td className="px-5 py-3"><Link href={`/accounting/invoices/${i.id}`} className="font-mono font-bold text-sea-700 after:absolute after:inset-0">{i.id}</Link><span className="block text-xs text-ink-mute">{i.invoiceNumber}{i.orderNumber ? ` · ${i.orderNumber}` : ""}</span></td>
                    <td className="px-3 py-3">{svc.customerName(svc.findCustomer(i.customerId))}</td>
                    <td className="px-3 py-3">{i.merchant}</td>
                    <td className="px-3 py-3 font-mono text-xs">{i.packageId ?? "—"}<br />{i.shipmentId ?? ""}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{i.currency} {i.total.toFixed(2)}</td>
                    <td className="px-3 py-3"><Confidence value={i.confidence} showLabel /></td>
                    <td className="px-5 py-3"><ReceiptPill status={i.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {tab === "payments" && (
        <Section title={`${payments.length} payments (all DEMO)`} action={<Btn tone="light" onClick={() => { setPay({ customerId: svc.listCustomers()[0].id }); setAmount(""); }}>+ Record payment</Btn>} pad={false}>
          <ul className="divide-y divide-[#eef1f4]">
            {payments.filter((p) => !f.customer || p.customerId === f.customer).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span><strong className="font-mono">{p.id}</strong> · <CustomerLink id={p.customerId} /> · {p.method.replace("_", " ")} · {fmtDate(p.receivedAt)} · by {p.recordedBy}{p.reference ? ` · ${p.reference}` : ""}</span>
                <span className="flex items-center gap-2">{p.billId ? <BillLink id={p.billId} /> : <span className="font-bold text-coral-700">Unmatched</span>}<strong className="tabular-nums">{fmtUsd(p.amount)}</strong></span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Modal open={!!pay} onClose={() => setPay(null)} title="Record a payment (DEMO)">
        {pay && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (run(() => svc.recordPayment(actor, { customerId: pay.customerId, billId: pay.billId, amount: Number(amount), method, reference: ref }), "Payment recorded (demo).")) setPay(null); }}>
            {!pay.billId && <Field label="Customer"><Select value={pay.customerId} onChange={(e) => setPay({ ...pay, customerId: e.target.value })}>{svc.listCustomers().map((c) => <option key={c.id} value={c.id}>{svc.customerName(c)}</option>)}</Select></Field>}
            {pay.billId && <p className="font-semibold">For {pay.billId}</p>}
            <Field label="Amount"><Input type="number" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
            <Field label="Method"><Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>{["cash", "card", "bank_transfer", "online"].map((m) => <option key={m} value={m}>{m.replace("_", " ")}</option>)}</Select></Field>
            <Field label="Reference"><Input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
            <Btn type="submit" tone="dark">Save</Btn>
          </form>
        )}
      </Modal>
      <Modal open={!!accept} onClose={() => setAccept(null)} title={`Reconcile ${accept ?? ""}`}>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (accept && run(() => svc.acceptDifference(actor, accept, note), "Difference accepted and logged.")) setAccept(null); }}>
          <p className="text-ink-soft">Accepting marks the bill settled with the difference written off. Only accounting can do this, and it&apos;s recorded in the audit log.</p>
          <Field label="Why is the difference OK?"><Input required value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Bank fee absorbed; customer credit agreed" /></Field>
          <div className="flex flex-wrap gap-2">
            <Btn type="submit" tone="dark">Accept difference</Btn>
            {accept && <Btn tone="light" onClick={() => { const b = svc.billView(svc.getBill(accept)); setAccept(null); setPay({ billId: b.id, customerId: b.customerId }); setAmount(String(b.balance)); }}>Record the rest instead</Btn>}
          </div>
        </form>
      </Modal>
    </OpsPage>
  );
}
