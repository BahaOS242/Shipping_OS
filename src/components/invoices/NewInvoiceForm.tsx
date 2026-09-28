"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { INVOICE_RULES, fmtUsd, linesForPackages, withTotals } from "@/lib/invoices";
import { ISLANDS, fmtLbs } from "@/lib/pricing";
import { STATUS } from "@/lib/status";
import type { Customer, Package, ShippingMode } from "@/lib/types";

type Pkg = Pick<Package, "id" | "customerId" | "merchant" | "itemName" | "weight" | "declaredValue" | "destination" | "mode" | "status">;

export function NewInvoiceForm({ customers, packages }: { customers: Pick<Customer, "id" | "firstName" | "lastName" | "accountNumber" | "businessName">[]; packages: Pkg[] }) {
  const router = useRouter();
  const withWork = customers.filter((c) => packages.some((p) => p.customerId === c.id));
  const [customerId, setCustomerId] = useState(withWork[0]?.id ?? "");
  const mine = packages.filter((p) => p.customerId === customerId);
  const [picked, setPicked] = useState<string[]>([]);
  const [mode, setMode] = useState<ShippingMode>("air");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = mine.filter((p) => picked.includes(p.id));
  const destination = chosen[0]?.destination;
  const mixed = chosen.some((p) => p.destination !== destination);
  const preview = useMemo(
    () => (chosen.length && !mixed ? withTotals({ lines: linesForPackages(chosen, destination!, mode) }) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [picked.join(), mode, customerId],
  );

  async function create(issue: boolean) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, packageIds: picked, mode }),
      });
      const json = (await res.json()) as { invoice?: { id: string }; error?: string };
      if (!res.ok || !json.invoice) throw new Error(json.error ?? "Could not create invoice");
      if (issue) await fetch(`/api/invoices/${json.invoice.id}/issue`, { method: "POST" });
      router.push(`/admin/invoices/${json.invoice.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (!withWork.length) return <p className="rounded-2xl bg-white p-6 ring-1 ring-[#e3e7ec]">Every arrived package is already on an invoice. 🎉</p>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
      <div className="space-y-4">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-[#e3e7ec]">
          <label htmlFor="cust" className="font-extrabold">1 · Customer</label>
          <select
            id="cust"
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value);
              setPicked([]);
            }}
            className="mt-2 min-h-12 w-full rounded-xl bg-[#f7f9fa] px-3 text-lg ring-1 ring-[#e3e7ec]"
          >
            {withWork.map((c) => (
              <option key={c.id} value={c.id}>
                {c.businessName ?? `${c.firstName} ${c.lastName}`} · {c.accountNumber} · {packages.filter((p) => p.customerId === c.id).length} to bill
              </option>
            ))}
          </select>
        </section>

        <fieldset className="min-w-0 rounded-2xl bg-white p-5 ring-1 ring-[#e3e7ec]">
          <legend className="sr-only">Packages</legend>
          <p className="font-extrabold">2 · Packages not billed yet</p>
          <p className="text-sm text-ink-mute">Packages billed together are charged on their combined weight.</p>
          <ul className="mt-3 space-y-2">
            {mine.map((p) => {
              const on = picked.includes(p.id);
              return (
                <li key={p.id}>
                  <label className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl p-3 ring-2 ${on ? "bg-sea-50 ring-sea-500" : "ring-[#e3e7ec]"}`}>
                    <input type="checkbox" checked={on} onChange={() => setPicked((s) => (on ? s.filter((x) => x !== p.id) : [...s, p.id]))} className="h-5 w-5 accent-[var(--color-sea-600)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">
                        {p.merchant} — {p.itemName}
                      </span>
                      <span className="block text-sm text-ink-soft">
                        {fmtLbs(p.weight)} · {ISLANDS[p.destination].name} · {STATUS[p.status].short}
                        {p.declaredValue ? ` · value ${fmtUsd(p.declaredValue)}` : ""}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>

        <section className="rounded-2xl bg-white p-5 ring-1 ring-[#e3e7ec]">
          <p className="font-extrabold">3 · How it traveled</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["air", "sea"] as const).map((m) => (
              <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`min-h-12 rounded-xl font-bold ring-2 ${mode === m ? "bg-sea-50 ring-sea-500" : "ring-[#e3e7ec]"}`}>
                {m === "air" ? "✈️ Air" : "🚢 Sea"} {mode === m && "✓"}
              </button>
            ))}
          </div>
        </section>
      </div>

      <aside className="rounded-2xl bg-white p-5 ring-1 ring-[#e3e7ec] lg:sticky lg:top-6">
        <h2 className="text-lg font-extrabold">Preview</h2>
        {mixed && <p className="mt-2 rounded-xl bg-coral-50 p-3 font-semibold text-coral-700">Pick packages going to the same island.</p>}
        {!preview && !mixed && <p className="mt-2 text-ink-mute">Pick one or more packages.</p>}
        {preview && (
          <>
            <ul className="mt-3 divide-y divide-[#eef1f4] text-sm">
              {preview.lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-3 py-2">
                  <span>{l.description}</span>
                  <span className="tabular-nums">{fmtUsd(l.amount)}</span>
                </li>
              ))}
              <li className="flex justify-between py-2">
                <span className="text-ink-soft">VAT {INVOICE_RULES.vatRate * 100}%</span>
                <span className="tabular-nums">{fmtUsd(preview.vat)}</span>
              </li>
            </ul>
            <p className="mt-2 flex justify-between text-xl font-black">
              <span>Total</span>
              <span className="tabular-nums">{fmtUsd(preview.total)}</span>
            </p>
          </>
        )}
        {error && <p role="alert" className="mt-3 rounded-xl bg-coral-50 p-3 font-semibold text-coral-700">{error}</p>}
        <div className="mt-4 grid gap-2">
          <button disabled={!preview || busy} onClick={() => create(true)} className="min-h-12 rounded-xl bg-sea-600 font-bold text-white disabled:opacity-40">
            Create &amp; send to customer
          </button>
          <button disabled={!preview || busy} onClick={() => create(false)} className="min-h-12 rounded-xl bg-white font-bold ring-1 ring-[#e3e7ec] disabled:opacity-40">
            Save as draft
          </button>
        </div>
      </aside>
    </div>
  );
}
