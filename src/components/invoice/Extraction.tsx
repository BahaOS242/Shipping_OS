"use client";

import type { InvoiceField, PurchaseInvoice } from "@/domain/types";
import * as svc from "@/services";
import { fmtDate } from "../ui/Time";

const FIELD_LABEL: Record<InvoiceField, string> = { merchant: "Store", invoiceNumber: "Invoice #", orderNumber: "Order #", purchaseDate: "Purchase date", total: "Total", items: "Items", customer: "Customer match" };

export function Confidence({ value, showLabel = false }: { value?: number; showLabel?: boolean }) {
  const lvl = svc.confidenceLevel(value);
  const c = svc.CONFIDENCE_COPY[lvl];
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-bold" title={`${c.label}${value !== undefined ? ` (${Math.round(value * 100)}%)` : ""}`}>
      <span aria-hidden>{c.icon}</span>
      <span className={showLabel ? "" : "sr-only"}>{c.label}</span>
      {value !== undefined && <span className="text-ink-mute">{Math.round(value * 100)}%</span>}
    </span>
  );
}

/** The structured result of the (simulated) AI extraction, with per-field confidence. */
export function Extraction({ inv, staff = false }: { inv: PurchaseInvoice; staff?: boolean }) {
  const fields: [InvoiceField, React.ReactNode][] = [
    ["merchant", inv.merchant],
    ["invoiceNumber", inv.invoiceNumber],
    ["orderNumber", inv.orderNumber ?? "—"],
    ["purchaseDate", fmtDate(inv.purchaseDate, { month: "short", day: "numeric", year: "numeric" })],
    ["total", `${inv.currency} ${inv.total.toFixed(2)}`],
    ["customer", inv.customerId ? svc.customerName(svc.findCustomer(inv.customerId)) : "Not matched"],
  ];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="font-bold">Overall</span> <Confidence value={inv.confidence} showLabel />
        <span className="text-ink-mute">🟢 High confidence · 🟡 Review · 🔴 Problem</span>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {fields.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-[#f7f9fa] p-3">
            <dt className="flex items-center justify-between gap-2 text-xs font-bold text-ink-mute">{FIELD_LABEL[k]} <Confidence value={inv.fieldConfidence[k]} /></dt>
            <dd className="mt-0.5 font-bold">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="overflow-x-auto rounded-xl ring-1 ring-[#e3e7ec]">
        <table className="w-full min-w-[480px] text-left text-sm">
          <caption className="sr-only">Items</caption>
          <thead className="bg-[#f7f9fa] text-ink-mute">
            <tr><th className="px-3 py-2">Item <Confidence value={inv.fieldConfidence.items} /></th><th className="px-3 py-2">SKU</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Unit</th><th className="px-3 py-2 text-right">Total</th></tr>
          </thead>
          <tbody className="divide-y divide-[#eef1f4]">
            {inv.items.map((i) => (
              <tr key={i.sku + i.name}>
                <td className="px-3 py-2">
                  <span className="font-semibold">{i.name}</span>
                  {staff && i.category && <span className="block text-xs text-ink-mute">AI category: {i.category}</span>}
                  {i.reviewFlag && <span className="mt-0.5 block text-xs font-bold text-coral-700">⚠ {i.reviewFlag}</span>}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{i.sku}</td>
                <td className="px-3 py-2 text-right">{i.quantity}</td>
                <td className="px-3 py-2 text-right tabular-nums">{i.unitPrice.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{i.totalPrice.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="text-right tabular-nums">
            <tr><td colSpan={4} className="px-3 pt-2 text-ink-soft">Subtotal</td><td className="px-3 pt-2">{inv.subtotal.toFixed(2)}</td></tr>
            {inv.discount > 0 && <tr><td colSpan={4} className="px-3 text-ink-soft">Discount</td><td className="px-3">−{inv.discount.toFixed(2)}</td></tr>}
            <tr><td colSpan={4} className="px-3 text-ink-soft">Shipping</td><td className="px-3">{inv.shipping.toFixed(2)}</td></tr>
            <tr><td colSpan={4} className="px-3 text-ink-soft">Tax</td><td className="px-3">{inv.tax.toFixed(2)}</td></tr>
            <tr className="font-black"><td colSpan={4} className="px-3 pb-2">Total ({inv.currency})</td><td className="px-3 pb-2">{inv.total.toFixed(2)}</td></tr>
          </tfoot>
        </table>
      </div>
      {inv.reviewNotes.length > 0 && (
        <ul className="space-y-1 text-sm">
          {inv.reviewNotes.map((n, i) => <li key={i} className="rounded-lg bg-sun-50 px-3 py-1.5 text-sun-700">• {n}</li>)}
        </ul>
      )}
      <p className="rounded-xl bg-[#f7f9fa] px-3 py-2 text-xs font-semibold text-ink-soft">🤖 {svc.AI_DISCLAIMER} Simulated extraction in this demo — no document is sent anywhere.</p>
    </div>
  );
}
