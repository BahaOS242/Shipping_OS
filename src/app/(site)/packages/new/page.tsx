"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CustomerView } from "@/components/customer/CustomerView";
import { Button } from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Field";
import { useAction } from "@/components/ui/Toast";
import type { Package } from "@/domain/types";
import * as svc from "@/services";

const STORES = ["Amazon", "Walmart", "Target", "Best Buy", "Home Depot", "Lowe's", "Shein", "Wayfair", "Apple", "Other"];

/** "Tell us a package is coming" — creates the expected package (and reads the receipt if attached). */
export default function NewPackagePage() {
  const router = useRouter();
  const run = useAction();
  const [store, setStore] = useState("Amazon");
  const [other, setOther] = useState("");
  const [item, setItem] = useState("");
  const [tracking, setTracking] = useState("");
  const [order, setOrder] = useState("");
  const [carrier, setCarrier] = useState<Package["carrier"]>("Amazon");
  const [file, setFile] = useState<File | null>(null);
  return (
    <CustomerView title="Tell us a package is coming">
      {(me, actor) => (
        <form
          className="mx-auto max-w-xl space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const merchant = store === "Other" ? other.trim() : store;
            const p = run(() => {
              const pkg = svc.preAlert(actor, { customerId: me.id, merchant, itemName: item, carrier, inboundTracking: tracking || `PENDING-${Date.now().toString().slice(-6)}`, orderNumber: order || undefined });
              if (file) svc.uploadInvoice(actor, { fileName: file.name, fileType: file.type.includes("pdf") ? "pdf" : "image", customerId: me.id, packageId: pkg.id, merchant, orderNumber: order || undefined, itemHint: item });
              return pkg;
            }, file ? "Got it — and we read your receipt." : "Got it — we'll watch for it.");
            if (p) router.push(`/packages/${p.id}`);
          }}
        >
          <h1 className="text-4xl font-black tracking-tight">Tell us a package is coming</h1>
          <p className="text-lg text-ink-soft">Optional — it helps us match it faster. Everything you ship to your Shipping OS address is matched automatically anyway.</p>
          <Field label="Where did you buy it?">
            <Select value={store} onChange={(e) => { setStore(e.target.value); setCarrier(e.target.value === "Amazon" ? "Amazon" : "UPS"); }}>{STORES.map((s) => <option key={s}>{s}</option>)}</Select>
          </Field>
          {store === "Other" && <Field label="Store name"><Input required value={other} onChange={(e) => setOther(e.target.value)} /></Field>}
          <Field label="What is it?"><Input required value={item} onChange={(e) => setItem(e.target.value)} placeholder="e.g. Kitchen blender" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Delivery company">
              <Select value={carrier} onChange={(e) => setCarrier(e.target.value as Package["carrier"])}>{["Amazon", "UPS", "FedEx", "USPS", "DHL"].map((c) => <option key={c}>{c}</option>)}</Select>
            </Field>
            <Field label="Tracking number (if you have it)"><Input value={tracking} onChange={(e) => setTracking(e.target.value)} /></Field>
          </div>
          <Field label="Order number (optional)"><Input value={order} onChange={(e) => setOrder(e.target.value)} /></Field>
          <Field label="Store receipt (PDF or photo)" hint="Demo: the file stays on your device. We simulate reading it.">
            <input type="file" accept="application/pdf,image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full rounded-xl bg-white p-3 ring-1 ring-[#dfe4ea] file:mr-3 file:rounded-lg file:border-0 file:bg-sea-50 file:px-3 file:py-2 file:font-bold file:text-sea-800" />
          </Field>
          <Button type="submit" size="xl" full>Save</Button>
        </form>
      )}
    </CustomerView>
  );
}
