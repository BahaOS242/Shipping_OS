"use client";

import { useLive } from "@/data/useLive";
import { useState } from "react";
import { CustomerLink, PackageLink, ReceiptLink, BillLink } from "@/components/ops/Links";
import { Btn, OpsPage } from "@/components/ops/OpsPage";
import { Field, Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { Section, StatTile } from "@/components/ui/Section";
import { fmtDate } from "@/components/ui/Time";
import { useAction } from "@/components/ui/Toast";
import { customerPrice } from "@/domain/billing";
import { fmtUsd } from "@/domain/rates";
import type { LandedCost, Procurement } from "@/domain/types";
import * as svc from "@/services";

const COST_FIELDS: [keyof LandedCost, string][] = [
  ["purchasePrice", "Purchase price"], ["supplierShipping", "Supplier shipping (to FL)"], ["salesTax", "Taxes"], ["freight", "Freight to The Bahamas"],
  ["customsDuty", "Customs duty (estimate)"], ["storage", "Storage"], ["delivery", "Local delivery"],
];
const FLOW = ["requested", "quoted", "approved", "purchased", "received", "shipped", "delivered"];

export default function ProcurementPage() {
  useLive();
  const run = useAction();
  const actor = svc.currentActor();
  const list = svc.listProcurements();
  const [q, setQ] = useState<Procurement | null>(null);
  const [supplier, setSupplier] = useState("");
  const [product, setProduct] = useState("");
  const [margin, setMargin] = useState("12");
  const [costs, setCosts] = useState<Record<keyof LandedCost, string>>({ purchasePrice: "", supplierShipping: "", salesTax: "0", freight: "", customsDuty: "", storage: "0", delivery: "" });
  const num = Object.fromEntries(Object.entries(costs).map(([k, v]) => [k, Number(v) || 0])) as LandedCost;
  const preview = customerPrice(num, (Number(margin) || 0) / 100);

  return (
    <OpsPage title="Procurement" sub="“Tell us what you need and we'll get it to you.” — find supplier → buy → receive → ship → bill with full landed cost.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="📝" label="New requests" value={list.filter((p) => p.status === "requested").length} tone={list.some((p) => p.status === "requested") ? "alert" : "neutral"} />
        <StatTile icon="💬" label="Waiting on customer" value={list.filter((p) => p.status === "quoted").length} />
        <StatTile icon="🛒" label="In progress" value={list.filter((p) => ["approved", "purchased"].includes(p.status)).length} />
        <StatTile icon="💵" label="Margin (approved)" value={fmtUsd(list.filter((p) => p.costs && !["requested", "quoted"].includes(p.status)).reduce((a, p) => a + customerPrice(p.costs!, p.marginRate).margin, 0))} />
      </div>
      <Section title="Requests" pad={false}>
        <ul className="divide-y divide-[#eef1f4]">
          {list.map((p) => {
            const status = svc.syncProcurementStatus(p);
            const price = p.costs ? customerPrice(p.costs, p.marginRate) : undefined;
            return (
              <li key={p.id} className="space-y-3 px-5 py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{p.product ?? p.request}</p>
                    <p className="text-sm text-ink-soft"><span className="font-mono">{p.id}</span> · <CustomerLink id={p.customerId} /> · {fmtDate(p.createdAt)} · “{p.request}”</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {["requested", "quoted"].includes(p.status) && <Btn tone="light" onClick={() => { setQ(p); setSupplier(p.supplier ?? ""); setProduct(p.product ?? p.request); setMargin(String(Math.round(p.marginRate * 100))); if (p.costs) setCosts(Object.fromEntries(Object.entries(p.costs).map(([k, v]) => [k, String(v)])) as never); }}>{p.status === "quoted" ? "Edit quote" : "Build quote"}</Btn>}
                    {p.status === "approved" && <Btn tone="sea" onClick={() => run(() => svc.markPurchased(actor, p.id), "Purchased — supplier invoice and expected package created.")}>Mark purchased</Btn>}
                  </div>
                </div>
                <ol className="flex flex-wrap gap-1 text-xs font-bold">
                  {FLOW.map((s, i) => <li key={s} className={`rounded-full px-2 py-0.5 ${FLOW.indexOf(status) > i ? "bg-sea-100 text-sea-800" : FLOW.indexOf(status) === i ? "bg-ink text-white" : "bg-[#eef1f4] text-ink-mute"}`}>{s}</li>)}
                </ol>
                {price && p.costs && (
                  <div className="grid gap-2 rounded-xl bg-[#f7f9fa] p-3 text-sm sm:grid-cols-4">
                    <span>Supplier: <strong>{p.supplier}</strong></span>
                    <span>Landed cost: <strong>{fmtUsd(price.landed)}</strong></span>
                    <span>Customer price: <strong>{fmtUsd(price.price)}</strong></span>
                    <span>Margin: <strong>{fmtUsd(price.margin)}</strong> ({Math.round(p.marginRate * 100)}%)</span>
                  </div>
                )}
                {(p.packageId || p.supplierInvoiceId || p.billId) && <p className="flex flex-wrap gap-3 text-sm">{p.packageId && <span>Package <PackageLink id={p.packageId} /></span>}{p.supplierInvoiceId && <span>Supplier invoice <ReceiptLink id={p.supplierInvoiceId} /></span>}{p.billId && <span>Bill <BillLink id={p.billId} /></span>}</p>}
                {status === "quoted" && <Pill tone="warn" icon="⏳">Waiting for customer approval</Pill>}
              </li>
            );
          })}
        </ul>
      </Section>
      <Modal open={!!q} onClose={() => setQ(null)} title={`Quote ${q?.id ?? ""}`} wide>
        {q && (
          <form className="grid gap-5 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); if (run(() => svc.quoteProcurement(actor, q.id, { supplier, product, costs: num, marginRate: (Number(margin) || 0) / 100 }), "Quote sent to the customer.")) setQ(null); }}>
            <div className="space-y-3">
              <Field label="Supplier"><Input required value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="e.g. WebstaurantStore" /></Field>
              <Field label="Product"><Input required value={product} onChange={(e) => setProduct(e.target.value)} /></Field>
              <Field label="Margin %"><Input type="number" value={margin} onChange={(e) => setMargin(e.target.value)} /></Field>
            </div>
            <div className="space-y-2">
              {COST_FIELDS.map(([k, l]) => <Field key={k} label={l}><Input type="number" step="0.01" value={costs[k]} onChange={(e) => setCosts({ ...costs, [k]: e.target.value })} /></Field>)}
            </div>
            <div className="rounded-2xl bg-ink p-4 text-white md:col-span-2">
              <p className="grid gap-1 sm:grid-cols-3"><span>Landed cost <strong className="block text-2xl">{fmtUsd(preview.landed)}</strong></span><span>Customer price <strong className="block text-2xl text-sun-300">{fmtUsd(preview.price)}</strong></span><span>Margin <strong className="block text-2xl">{fmtUsd(preview.margin)}</strong></span></p>
              <p className="mt-2 text-xs text-white/60">Demo figures. Duty is an estimate; customs sets the final amount.</p>
            </div>
            <div className="md:col-span-2"><Btn type="submit" tone="sea">Send quote to customer</Btn></div>
          </form>
        )}
      </Modal>
    </OpsPage>
  );
}
