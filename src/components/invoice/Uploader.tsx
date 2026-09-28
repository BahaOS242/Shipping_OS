"use client";

import { useState } from "react";
import type { Actor, ID, PurchaseInvoice } from "@/domain/types";
import * as svc from "@/services";
import { Button } from "../ui/Button";
import { Field, Select } from "../ui/Field";
import { useAction } from "../ui/Toast";

const STEPS = ["Reading the document", "Pulling out items and prices", "Matching to you and your package", "Sending to warehouse, customs & accounting"];

/** Upload → simulated AI extraction (animated) → structured invoice. */
export function Uploader({ actor, customerId, packageId, onDone }: { actor: Actor; customerId: ID; packageId?: ID; onDone: (inv: PurchaseInvoice) => void }) {
  const run = useAction();
  const pkgs = svc.listPackages({ customerId }).filter((p) => !p.purchaseInvoiceId && p.status !== "delivered");
  const [file, setFile] = useState<File | null>(null);
  const [pkg, setPkg] = useState<string>(packageId ?? pkgs[0]?.id ?? "");
  const [step, setStep] = useState(-1);

  function start(name: string, type: "pdf" | "image") {
    setStep(0);
    STEPS.forEach((_, i) => setTimeout(() => setStep(i + 1), 500 * (i + 1)));
    setTimeout(() => {
      const p = svc.findPackage(pkg);
      const inv = run(() => svc.uploadInvoice(actor, { fileName: name, fileType: type, customerId, packageId: p?.id, merchant: p?.merchant, orderNumber: p?.orderNumber, itemHint: p?.itemName }));
      setStep(-1);
      setFile(null);
      if (inv) onDone(inv);
    }, 500 * (STEPS.length + 1));
  }

  if (step >= 0) {
    return (
      <ol className="space-y-2 rounded-2xl bg-white p-5 ring-1 ring-sand-200" aria-live="polite">
        {STEPS.map((s, i) => (
          <li key={s} className={`flex items-center gap-3 text-lg font-semibold ${i < step ? "text-ink" : i === step ? "text-sea-700" : "text-ink-mute"}`}>
            <span aria-hidden className="w-6 text-center">{i < step ? "✓" : i === step ? <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-sea-500" /> : "○"}</span>
            {s}
          </li>
        ))}
        <li className="pt-1 text-sm text-ink-mute">🤖 Simulated AI extraction</li>
      </ol>
    );
  }

  return (
    <form
      className="space-y-4 rounded-2xl bg-white p-5 ring-1 ring-sand-200"
      onSubmit={(e) => {
        e.preventDefault();
        if (file) start(file.name, file.type.includes("pdf") ? "pdf" : "image");
      }}
    >
      {pkgs.length > 0 && (
        <Field label="Which package is this receipt for?">
          <Select value={pkg} onChange={(e) => setPkg(e.target.value)}>
            {pkgs.map((p) => <option key={p.id} value={p.id}>{p.merchant} — {p.itemName} ({p.id})</option>)}
            <option value="">Not sure — match it for me</option>
          </Select>
        </Field>
      )}
      <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sea-200 bg-sea-50/50 p-6 text-center hover:bg-sea-50">
        <span aria-hidden className="text-4xl">📄</span>
        <span className="text-lg font-bold">{file ? file.name : "Choose a PDF or photo of your receipt"}</span>
        <span className="text-sm text-ink-mute">Demo: the file stays on your device.</span>
        <input type="file" accept="application/pdf,image/*" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button type="submit" disabled={!file} full icon="✨">Read my receipt</Button>
        <Button type="button" variant="secondary" full onClick={() => { const p = svc.findPackage(pkg); start(`${(p?.merchant ?? "store").toLowerCase().replace(/\W/g, "")}-order-receipt.pdf`, "pdf"); }}>
          Use a sample receipt
        </Button>
      </div>
    </form>
  );
}
