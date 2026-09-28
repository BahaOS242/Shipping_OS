"use client";

import Link from "next/link";
import { useState } from "react";
import type { InvoiceView } from "@/lib/api/invoices";
import { demo } from "@/lib/demo-store";
import { INVOICE_RULES, PAYMENT_METHOD_LABEL, fmtDay, fmtUsd } from "@/lib/invoices";
import { ISLANDS } from "@/lib/pricing";
import type { PaymentMethod } from "@/lib/types";
import { InvoiceStatusBadge } from "./InvoiceStatusBadge";

type Panel = null | "pay" | "void";

/**
 * Staff invoice screen. Every change goes through /api/invoices/*, and the
 * screen redraws from the API's response.
 */
export function InvoiceDetail({ initial }: { initial: InvoiceView }) {
  const [inv, setInv] = useState(initial);
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [amount, setAmount] = useState(String(initial.balance || ""));
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");

  const name = inv.customer.businessName ?? `${inv.customer.firstName} ${inv.customer.lastName}`;

  async function call(path: string, body?: unknown, done?: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/invoices/${inv.id}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const json = (await res.json()) as { invoice?: InvoiceView; error?: string };
      if (!res.ok || !json.invoice) throw new Error(json.error ?? "Something went wrong");
      setInv(json.invoice);
      setAmount(String(json.invoice.balance || ""));
      setPanel(null);
      setFlash(done ?? null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function sendReminder() {
    const text =
      inv.status === "overdue"
        ? `Hi ${inv.customer.firstName}, this is Shanice from The Link. Your bill ${inv.number} for ${fmtUsd(inv.balance)} was due on ${fmtDay(inv.dueAt)}. You can pay at any pickup center or reply here if you have questions. Thank you!`
        : `Hi ${inv.customer.firstName}, this is Shanice from The Link. Your bill ${inv.number} for ${fmtUsd(inv.balance)} is ready. It's due ${fmtDay(inv.dueAt)}. Reply here if you have questions!`;
    // DEMO: lands in the shared WhatsApp thread. Production: WhatsApp template message.
    demo.log("whatsapp", inv.customerId, "staff", text, { staffName: "Shanice at The Link", packageId: inv.packageIds[0] });
    setFlash("Reminder sent on WhatsApp (demo).");
  }

  const canPay = inv.lifecycle === "issued" && inv.balance > 0;
  const canVoid = inv.lifecycle !== "void" && inv.payments.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-ink-mute">Invoice</p>
          <h1 className="flex flex-wrap items-center gap-3 text-3xl font-black tracking-tight">
            {inv.number} <InvoiceStatusBadge status={inv.status} daysLate={inv.daysLate} size="lg" />
          </h1>
          <p className="mt-1 text-ink-soft">
            {name} · {inv.customer.accountNumber} · {ISLANDS[inv.destination].name}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-ink-mute">{inv.lifecycle === "issued" ? "Balance due" : "Total"}</p>
          <p className="text-4xl font-black tabular-nums">{fmtUsd(inv.lifecycle === "issued" ? inv.balance : inv.total)}</p>
        </div>
      </div>

      {inv.status === "void" && (
        <p className="rounded-2xl bg-[#eef1f4] p-4 font-semibold text-ink-soft">⊘ Voided: {inv.voidReason}</p>
      )}
      {flash && (
        <p role="status" className="rounded-2xl bg-emerald-50 p-4 font-semibold text-emerald-800 ring-1 ring-emerald-200">
          ✓ {flash}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-2xl bg-coral-50 p-4 font-semibold text-coral-700 ring-1 ring-coral-100">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 print:hidden">
        {inv.lifecycle === "draft" && (
          <button disabled={busy} onClick={() => call("/issue", {}, "Invoice sent to the customer.")} className="min-h-12 rounded-xl bg-sea-600 px-5 font-bold text-white hover:bg-sea-700 disabled:opacity-50">
            ➤ Issue invoice
          </button>
        )}
        {canPay && (
          <button onClick={() => setPanel(panel === "pay" ? null : "pay")} className="min-h-12 rounded-xl bg-sea-600 px-5 font-bold text-white hover:bg-sea-700">
            💵 Record payment
          </button>
        )}
        {canPay && (
          <button onClick={sendReminder} className="min-h-12 rounded-xl bg-white px-5 font-bold text-wa-teal ring-1 ring-[#e3e7ec] hover:ring-wa-teal">
            💬 Send reminder
          </button>
        )}
        <button onClick={() => window.print()} className="min-h-12 rounded-xl bg-white px-5 font-bold ring-1 ring-[#e3e7ec] hover:ring-sea-400">
          🖨 Print
        </button>
        {canVoid && (
          <button onClick={() => setPanel(panel === "void" ? null : "void")} className="min-h-12 rounded-xl px-4 font-bold text-coral-700 hover:bg-coral-50">
            ⊘ Void
          </button>
        )}
      </div>

      {panel === "pay" && (
        <form
          className="animate-rise grid gap-3 rounded-2xl bg-white p-5 ring-1 ring-[#e3e7ec] sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end print:hidden"
          onSubmit={(e) => {
            e.preventDefault();
            void call("/payments", { amount: Number(amount), method, reference }, `Payment of ${fmtUsd(Number(amount))} recorded.`);
          }}
        >
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink-soft">Amount (balance {fmtUsd(inv.balance)})</span>
            <input type="number" step="0.01" min="0.01" max={inv.balance} required value={amount} onChange={(e) => setAmount(e.target.value)} className="min-h-12 w-full rounded-xl bg-[#f7f9fa] px-3 text-lg font-bold ring-1 ring-[#e3e7ec]" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink-soft">How they paid</span>
            <select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} className="min-h-12 w-full rounded-xl bg-[#f7f9fa] px-3 ring-1 ring-[#e3e7ec]">
              {Object.entries(PAYMENT_METHOD_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink-soft">Receipt / reference (optional)</span>
            <input value={reference} onChange={(e) => setReference(e.target.value)} className="min-h-12 w-full rounded-xl bg-[#f7f9fa] px-3 ring-1 ring-[#e3e7ec]" />
          </label>
          <button disabled={busy} className="min-h-12 rounded-xl bg-ink px-5 font-bold text-white disabled:opacity-50">
            {busy ? "Saving…" : "Save payment"}
          </button>
          <p className="text-sm text-ink-mute sm:col-span-4">Demo: this records the payment only. No money is moved.</p>
        </form>
      )}

      {panel === "void" && (
        <form
          className="animate-rise flex flex-wrap items-end gap-3 rounded-2xl bg-coral-50 p-5 ring-1 ring-coral-100 print:hidden"
          onSubmit={(e) => {
            e.preventDefault();
            void call("/void", { reason }, "Invoice voided.");
          }}
        >
          <label className="block min-w-0 flex-1 basis-64">
            <span className="mb-1 block text-sm font-bold text-coral-700">Why are you voiding this invoice?</span>
            <input required value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Duplicate of INV-2026-00118" className="min-h-12 w-full rounded-xl bg-white px-3 ring-1 ring-coral-100" />
          </label>
          <button disabled={busy} className="min-h-12 rounded-xl bg-coral-500 px-5 font-bold text-white disabled:opacity-50">
            Void invoice
          </button>
        </form>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* The invoice itself */}
        <section className="min-w-0 rounded-2xl bg-white p-5 ring-1 ring-[#e3e7ec] sm:p-7">
          <div className="grid gap-4 border-b border-[#eef1f4] pb-5 sm:grid-cols-3">
            <div>
              <p className="text-sm font-semibold text-ink-mute">Bill to</p>
              <p className="font-bold">{name}</p>
              <p className="text-sm text-ink-soft">{inv.customer.accountNumber}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-mute">Issued</p>
              <p className="font-bold">{inv.issuedAt ? fmtDay(inv.issuedAt) : "Not yet"}</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-mute">Due</p>
              <p className={`font-bold ${inv.status === "overdue" ? "text-coral-700" : ""}`}>{inv.dueAt ? fmtDay(inv.dueAt) : "—"}</p>
            </div>
          </div>

          <table className="mt-4 w-full text-left">
            <thead className="text-sm text-ink-mute">
              <tr>
                <th className="py-2 font-semibold">What</th>
                <th className="py-2 text-right font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#eef1f4]">
              {inv.lines.map((l) => (
                <tr key={l.id}>
                  <td className="py-2.5 pr-4">
                    {l.description}
                    {!l.taxable && <span className="ml-2 rounded bg-[#eef1f4] px-1.5 text-xs font-semibold text-ink-mute">no VAT</span>}
                  </td>
                  <td className="py-2.5 text-right tabular-nums">{fmtUsd(l.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="text-right tabular-nums">
              <tr>
                <td className="pt-4 text-ink-soft">Subtotal</td>
                <td className="pt-4">{fmtUsd(inv.subtotal)}</td>
              </tr>
              <tr>
                <td className="text-ink-soft">VAT {INVOICE_RULES.vatRate * 100}%</td>
                <td>{fmtUsd(inv.vat)}</td>
              </tr>
              <tr className="text-lg font-black">
                <td className="pt-2">Total</td>
                <td className="pt-2">{fmtUsd(inv.total)}</td>
              </tr>
              {inv.paid > 0 && (
                <>
                  <tr className="text-emerald-800">
                    <td>Paid</td>
                    <td>−{fmtUsd(inv.paid)}</td>
                  </tr>
                  <tr className="text-lg font-black">
                    <td>Balance due</td>
                    <td>{fmtUsd(inv.balance)}</td>
                  </tr>
                </>
              )}
            </tfoot>
          </table>
          <p className="mt-5 text-xs text-ink-mute">Demo invoice. Customs duty uses a placeholder rate; real duty depends on each item.</p>
        </section>

        <aside className="min-w-0 space-y-4">
          <section className="rounded-2xl bg-white p-5 ring-1 ring-[#e3e7ec]">
            <h2 className="font-extrabold">Payments</h2>
            {inv.payments.length === 0 ? (
              <p className="mt-2 text-ink-mute">None yet.</p>
            ) : (
              <ul className="mt-2 divide-y divide-[#eef1f4]">
                {inv.payments.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-3 py-2.5">
                    <span>
                      <span className="block font-semibold">{PAYMENT_METHOD_LABEL[p.method]}</span>
                      <span className="text-xs text-ink-mute">
                        {fmtDay(p.at)} · by {p.recordedBy}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </span>
                    </span>
                    <span className="font-bold tabular-nums text-emerald-800">{fmtUsd(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {inv.packageIds.length > 0 && (
            <section className="rounded-2xl bg-white p-5 ring-1 ring-[#e3e7ec]">
              <h2 className="font-extrabold">Packages on this bill</h2>
              <ul className="mt-2 space-y-1">
                {inv.packageIds.map((id) => (
                  <li key={id}>
                    <Link href={`/admin/packages/${id}`} className="font-semibold text-sea-700 underline">
                      {id.toUpperCase()}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {inv.notes && (
            <section className="rounded-2xl bg-sun-50 p-5 ring-1 ring-sun-300">
              <h2 className="font-extrabold">Staff notes</h2>
              <p className="mt-1">📝 {inv.notes}</p>
              <p className="mt-1 text-xs text-sun-700">Never shown to the customer.</p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
