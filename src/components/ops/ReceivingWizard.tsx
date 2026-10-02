"use client";

import { useState } from "react";
import { EXCEPTION_CATALOG } from "@/domain/copy";
import { fmtLb } from "@/domain/rates";
import type { DestinationId, Package, ServiceLevel } from "@/domain/types";
import * as svc from "@/services";
import { Field, Input, Select } from "../ui/Field";
import { useAction } from "../ui/Toast";
import { PhotoTile, QR } from "../ui/Visuals";
import { Btn } from "./OpsPage";

const STEPS = ["Scan", "Customer", "Invoice", "Weight", "Dimensions", "Photos", "Checks", "Destination", "Receive"];

/**
 * Receiving workflow (9 steps). Nothing is saved until "Mark received" —
 * then one service call records everything and raises any exceptions.
 */
export function ReceivingWizard({ pkg, onDone }: { pkg: Package; onDone: () => void }) {
  const run = useAction();
  const actor = svc.currentActor();
  const [step, setStep] = useState(0);
  const [customerId, setCustomerId] = useState(pkg.customerId ?? "");
  const [weight, setWeight] = useState<string>("");
  const [dims, setDims] = useState({ l: "", w: "", h: "" });
  const [photos, setPhotos] = useState(0);
  const [damaged, setDamaged] = useState(false);
  const [note, setNote] = useState("");
  const cust = svc.findCustomer(customerId);
  const [dest, setDest] = useState<DestinationId>(pkg.destinationId);
  const [service, setService] = useState<ServiceLevel>(pkg.service);
  const [, force] = useState(0);

  const m = { actualWeight: Number(weight) || 0, length: Number(dims.l) || undefined, width: Number(dims.w) || undefined, height: Number(dims.h) || undefined, damaged, service };
  const preview = svc.previewReceivingChecks({ ...pkg, customerId: customerId || undefined }, m);
  const canNext = [true, true, true, m.actualWeight > 0, true, photos > 0, true, true, true][step];

  function finish() {
    const ok = run(() => {
      if (customerId && customerId !== pkg.customerId) svc.matchCustomer(actor, pkg.id, customerId);
      return svc.receivePackage(actor, pkg.id, { ...m, photos, conditionNote: note || undefined, destinationId: dest, service });
    }, (r) => `${pkg.id} received${r.exceptions.length ? ` — ${r.exceptions.length} exception(s) raised` : ""}. Customer notified.`);
    if (ok) onDone();
  }

  return (
    <div className="space-y-5">
      <ol className="flex gap-1 overflow-x-auto pb-1 text-xs font-bold [scrollbar-width:none]" aria-label="Receiving steps">
        {STEPS.map((s, i) => (
          <li key={s} className={`shrink-0 rounded-full px-2.5 py-1 ${i < step ? "bg-sea-100 text-sea-800" : i === step ? "bg-ink text-white" : "bg-[#eef1f4] text-ink-mute"}`}>
            {i < step ? "✓" : i + 1}. {s}
          </li>
        ))}
      </ol>

      <div key={step} className="min-h-56 animate-rise">
        {step === 0 && (
          <div className="flex flex-wrap items-center gap-5">
            <div className="rounded-2xl border-2 border-dashed border-ink/30 bg-[#fffdf5] p-4 font-mono text-sm leading-relaxed">
              <p className="font-bold">SHIP TO:</p>
              <p>{pkg.labelName}</p>
              <p>{pkg.labelSuite ? `Shipping OS #${pkg.labelSuite}` : "(no suite number)"}</p>
              <p>123 Demo Warehouse Way</p>
              <p>Hollywood, FL 33020</p>
              <p className="mt-2 text-xs">{pkg.carrier} · {pkg.inboundTracking}</p>
            </div>
            <div className="text-center">
              <QR value={pkg.id} size={110} />
              <p className="mt-1 text-xs text-ink-mute">Shipping OS label printed</p>
            </div>
            <p className="basis-full text-ink-soft">✓ Scanned. This box is now <strong className="font-mono">{pkg.id}</strong> everywhere in the system.</p>
          </div>
        )}
        {step === 1 && (
          <div className="space-y-3">
            {pkg.customerId ? (
              <p className="rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-900">✓ Auto-matched from label {pkg.labelSuite ? `(suite #${pkg.labelSuite})` : "(name)"}: <strong>{svc.customerName(svc.findCustomer(pkg.customerId))}</strong></p>
            ) : (
              <p className="rounded-xl bg-coral-50 p-3 font-semibold text-coral-700">⚠ Label &ldquo;{pkg.labelName}&rdquo; didn&apos;t match an account. Pick the customer, or leave unmatched (package will be held).</p>
            )}
            <Field label="Customer">
              <Select value={customerId} onChange={(e) => { setCustomerId(e.target.value); const c = svc.findCustomer(e.target.value); if (c) { setDest(c.homeDestination); setService(c.preferredService); } }}>
                <option value="">— Unmatched —</option>
                {svc.listCustomers().map((c) => <option key={c.id} value={c.id}>{svc.customerName(c)} · {c.accountNumber}</option>)}
              </Select>
            </Field>
          </div>
        )}
        {step === 2 && (
          <div className="space-y-3">
            {preview.invoice ? (
              <div className="rounded-xl bg-emerald-50 p-3 text-emerald-900">
                <p className="font-semibold">✓ Receipt found: <strong>{preview.invoice.merchant} {preview.invoice.invoiceNumber}</strong> ({preview.invoice.currency} {preview.invoice.total.toFixed(2)})</p>
                <ul className="mt-1 text-sm">{preview.invoice.items.map((i) => <li key={i.sku}>• {i.quantity} × {i.name}{i.reviewFlag ? ` — ⚠ ${i.reviewFlag}` : ""}</li>)}</ul>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="rounded-xl bg-sun-50 p-3 font-semibold text-sun-700">🧾 No receipt linked yet. If you receive without one, a MISSING_INVOICE exception is created and the customer is asked to upload it.</p>
                {customerId && (
                  <Btn tone="light" onClick={() => { run(() => svc.uploadInvoice(actor, { fileName: `${pkg.merchant.toLowerCase().replace(/\W/g, "")}-order-confirmation.eml`, fileType: "email", customerId, packageId: pkg.id, merchant: pkg.merchant, orderNumber: pkg.orderNumber, itemHint: pkg.itemName, uploadedBy: "merchant_email" }), "Order email found and read (simulated)."); force((x) => x + 1); }}>
                    📧 Pull invoice from order email (simulated)
                  </Btn>
                )}
              </div>
            )}
          </div>
        )}
        {step === 3 && (
          <div className="space-y-3">
            <Field label={`Weight on the scale (lb)${pkg.carrierWeight ? ` — carrier said ${pkg.carrierWeight} lb` : ""}`}>
              <Input autoFocus type="number" inputMode="decimal" min={0} step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} className="!text-2xl !font-black" />
            </Field>
            <Btn tone="light" onClick={() => setWeight(String(pkg.carrierWeight ?? 3))}>⚖ Read scale (simulated)</Btn>
          </div>
        )}
        {step === 4 && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              {(["l", "w", "h"] as const).map((k) => (
                <Field key={k} label={{ l: "Length (in)", w: "Width (in)", h: "Height (in)" }[k]}><Input type="number" min={0} value={dims[k]} onChange={(e) => setDims({ ...dims, [k]: e.target.value })} /></Field>
              ))}
            </div>
            <p className="rounded-xl bg-[#f7f9fa] p-3 font-semibold">
              Billable weight: <strong>{fmtLb(preview.billable.billable)}</strong> ({preview.billable.basis === "dimensional" ? `size-based ${fmtLb(preview.billable.dimensional)} beats actual ${fmtLb(preview.billable.actual)}` : "actual weight"}) · {service}
            </p>
          </div>
        )}
        {step === 5 && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Btn tone="light" onClick={() => setPhotos((n) => n + 1)}>📷 Take photo (simulated)</Btn>
              <label className="flex min-h-11 items-center gap-2 rounded-xl px-3 font-semibold ring-1 ring-[#dfe4ea]"><input type="checkbox" checked={damaged} onChange={(e) => setDamaged(e.target.checked)} className="h-5 w-5" /> Box is damaged</label>
            </div>
            {damaged && <Field label="Damage note"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Corner crushed" /></Field>}
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{Array.from({ length: photos }, (_, i) => <PhotoTile key={i} id={`${pkg.id}:${i}`} damaged={damaged} />)}</div>
          </div>
        )}
        {step === 6 && (
          <div className="space-y-2">
            <p className="font-bold">Automatic checks</p>
            {!preview.checks.length ? (
              <p className="rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-900">✓ No problems found.</p>
            ) : (
              <ul className="space-y-2">
                {preview.checks.map((c) => (
                  <li key={c.type + c.text} className="rounded-xl bg-coral-50 p-3 text-coral-700">
                    <strong>{EXCEPTION_CATALOG[c.type as keyof typeof EXCEPTION_CATALOG]?.icon} {c.type}</strong> — {c.text}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-sm text-ink-mute">These become exceptions for the right team when you mark the package received.</p>
          </div>
        )}
        {step === 7 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Destination">
              <Select value={dest} onChange={(e) => setDest(e.target.value as DestinationId)}>{svc.getDestinations().map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select>
            </Field>
            <Field label="Service">
              <Select value={service} onChange={(e) => setService(e.target.value as ServiceLevel)}><option value="air">✈️ Air</option><option value="ocean">🚢 Ocean</option></Select>
            </Field>
            {cust && <p className="text-sm text-ink-mute sm:col-span-2">Customer default: {svc.getDestination(cust.homeDestination).name}, {cust.preferredService}.</p>}
          </div>
        )}
        {step === 8 && (
          <div className="space-y-2 rounded-2xl bg-[#f7f9fa] p-4">
            <p><strong>{pkg.id}</strong> · {pkg.merchant} → {cust ? svc.customerName(cust) : "UNMATCHED"}</p>
            <p>{fmtLb(m.actualWeight)} actual · {fmtLb(preview.billable.billable)} billable · {photos} photo(s){damaged ? " · damaged" : ""}</p>
            <p>{svc.getDestination(dest).name} by {service} · receipt {preview.invoice ? "✓" : "missing"} · {preview.checks.length} exception(s) will be raised</p>
            <p className="text-sm text-ink-mute">Customer gets “Your package has arrived.” in the app and on WhatsApp (simulated).</p>
          </div>
        )}
      </div>

      <div className="flex justify-between gap-2 border-t border-[#eef1f4] pt-4">
        <Btn tone="light" disabled={step === 0} onClick={() => setStep(step - 1)}>← Back</Btn>
        {step < STEPS.length - 1 ? <Btn tone="dark" disabled={!canNext} onClick={() => setStep(step + 1)}>Next →</Btn> : <Btn tone="sea" onClick={finish}>✓ Mark received</Btn>}
      </div>
    </div>
  );
}
