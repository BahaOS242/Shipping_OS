"use client";

import { useLive } from "@/data/useLive";
import Link from "next/link";
import { use, useState } from "react";
import { Activity } from "@/components/domain/Activity";
import { ReceiptPill } from "@/components/domain/Status";
import { Extraction } from "@/components/invoice/Extraction";
import { BillLink, CustomerLink, PackageLink, ShipmentLink } from "@/components/ops/Links";
import { Btn, OpsPage } from "@/components/ops/OpsPage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select } from "@/components/ui/Field";
import { Section } from "@/components/ui/Section";
import { fmtDateTime } from "@/components/ui/Time";
import { useAction } from "@/components/ui/Toast";
import { fmtLb, fmtUsd } from "@/domain/rates";
import * as svc from "@/services";

type View = "warehouse" | "customs" | "accounting";

/** Invoice Engine record: one invoice, three department views. */
export default function PurchaseInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  useLive();
  const { id } = use(params);
  const run = useAction();
  const actor = svc.currentActor();
  const [view, setView] = useState<View>(actor.role === "customs" ? "customs" : actor.role === "warehouse" ? "warehouse" : "accounting");
  const [total, setTotal] = useState("");
  const [pkg, setPkg] = useState("");
  const [reason, setReason] = useState("");
  const inv = svc.findPurchaseInvoice(id);
  if (!inv) return <EmptyState icon="🔎" title={`No invoice ${id}`} />;
  const v = svc.departmentViews(inv);
  const candidates = svc.listPackages({ customerId: inv.customerId }).filter((p) => !p.purchaseInvoiceId);

  return (
    <OpsPage
      eyebrow={<Link href="/accounting?tab=invoices" className="text-sea-700">← Store invoices</Link>}
      title={`${inv.merchant} ${inv.invoiceNumber}`}
      sub={<span className="flex flex-wrap items-center gap-2"><span className="font-mono">{inv.id}</span> · <CustomerLink id={inv.customerId} /> · <PackageLink id={inv.packageId} /> <ReceiptPill status={inv.status} /></span>}
      actions={inv.status !== "verified" && inv.status !== "rejected" ? <Btn tone="sea" onClick={() => run(() => svc.verifyInvoice(actor, inv.id, "Checked against the document"), "Verified by a person.")}>✓ Verify extraction</Btn> : undefined}
    >
      <p className="text-sm text-ink-soft">Source: <strong>{inv.source.fileName}</strong> ({inv.source.fileType}) uploaded by {inv.source.uploadedBy.replace("_", " ")} · {fmtDateTime(inv.source.uploadedAt)}{inv.verifiedBy ? ` · verified by ${inv.verifiedBy}` : ""}</p>
      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Section title="Structured invoice (simulated AI extraction)"><Extraction inv={inv} staff /></Section>
        <div className="space-y-5">
          <Section title="One invoice, three departments">
            <div className="mb-4 flex gap-1.5">
              {(["warehouse", "customs", "accounting"] as View[]).map((k) => <button key={k} onClick={() => setView(k)} aria-pressed={view === k} className={`min-h-10 rounded-full px-3 text-sm font-bold capitalize ring-1 ${view === k ? "bg-ink text-white ring-ink" : "ring-[#e3e7ec]"}`}>{k}</button>)}
            </div>
            <p className="mb-3 text-lg font-extrabold">“{v[view].question}”</p>
            {view === "warehouse" && (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-ink-mute">Customer</dt><dd><CustomerLink id={v.warehouse.customerId} /></dd>
                <dt className="text-ink-mute">Merchant / order</dt><dd>{v.warehouse.merchant} · {v.warehouse.order ?? "—"}</dd>
                <dt className="text-ink-mute">Items</dt><dd>{v.warehouse.items.map((i) => `${i.quantity} × ${i.name}`).join(", ")}</dd>
                <dt className="text-ink-mute">Weight</dt><dd>{fmtLb(v.warehouse.weight)}</dd>
                <dt className="text-ink-mute">Destination</dt><dd>{v.warehouse.destinationId ? svc.getDestination(v.warehouse.destinationId).name : "—"}</dd>
                <dt className="text-ink-mute">Package</dt><dd><PackageLink id={v.warehouse.packageId} /></dd>
              </dl>
            )}
            {view === "customs" && (
              <div className="space-y-2 text-sm">
                <p>Package <PackageLink id={v.customs.packageId} /> · Shipment <ShipmentLink id={v.customs.shipmentId} /></p>
                <p>Declared value: <strong>{fmtUsd(v.customs.declaredValueUsd)}</strong> (from {v.customs.currency})</p>
                <ul>{v.customs.items.map((i) => <li key={i.sku}>• {i.quantity} × {i.name} — {i.category ?? "uncategorized"}</li>)}</ul>
                <p>Documents: {v.customs.documents.join(", ")}</p>
                {v.customs.reviewFlags.map((f) => <p key={f} className="font-bold text-coral-700">⚑ {f}</p>)}
                <p className="rounded-xl bg-sun-50 p-2 font-semibold text-sun-700">{v.customs.disclaimer}</p>
              </div>
            )}
            {view === "accounting" && (
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-ink-mute">Invoice</dt><dd>{v.accounting.invoice}</dd>
                <dt className="text-ink-mute">Amount</dt><dd>{v.accounting.currency} {v.accounting.amount.toFixed(2)} (≈ {fmtUsd(v.accounting.amountUsd)})</dd>
                <dt className="text-ink-mute">Merchant payment</dt><dd>{v.accounting.merchantPayment}</dd>
                <dt className="text-ink-mute">Shipping OS bill</dt><dd>{v.accounting.linkBillId ? <BillLink id={v.accounting.linkBillId} /> : "Not billed yet"}</dd>
                <dt className="text-ink-mute">Reconciliation</dt><dd>{v.accounting.linkBillId ? svc.reconciliationRows().find((r) => r.billId === v.accounting.linkBillId)?.status.replace("_", " ") : "—"}</dd>
              </dl>
            )}
          </Section>
          {inv.status !== "rejected" && (
            <Section title="Human review">
              <div className="space-y-3">
                <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(() => svc.correctInvoice(actor, inv.id, { total: Number(total) }), "Total corrected — declared value updated."); }}>
                  <Field label="Correct total"><Input type="number" step="0.01" value={total} onChange={(e) => setTotal(e.target.value)} placeholder={inv.total.toFixed(2)} /></Field>
                  <Btn type="submit" tone="light">Save</Btn>
                </form>
                {!inv.packageId && (
                  <div className="flex items-end gap-2">
                    <Field label="Link to package"><Select value={pkg} onChange={(e) => setPkg(e.target.value)}><option value="">Choose…</option>{candidates.map((p) => <option key={p.id} value={p.id}>{p.id} · {p.merchant}</option>)}</Select></Field>
                    <Btn tone="light" disabled={!pkg} onClick={() => run(() => svc.linkInvoiceToPackage(actor, inv.id, pkg), "Linked.")}>Link</Btn>
                  </div>
                )}
                <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); run(() => svc.rejectInvoice(actor, inv.id, reason), "Rejected — customer asked for a clearer copy."); }}>
                  <Field label="Reject (unreadable / wrong document)"><Input required value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
                  <Btn type="submit" tone="danger">Reject</Btn>
                </form>
              </div>
            </Section>
          )}
          <Section title="Audit"><Activity events={svc.timeline({ purchaseInvoiceId: inv.id })} /></Section>
        </div>
      </div>
    </OpsPage>
  );
}
