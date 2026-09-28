"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CustomerView } from "@/components/customer/CustomerView";
import { ChoiceButton } from "@/components/shipping/ChoiceButton";
import { Button } from "@/components/ui/Button";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { useAction } from "@/components/ui/Toast";
import { CLAIM_REASON } from "@/domain/copy";
import type { ClaimReason } from "@/domain/types";
import * as svc from "@/services";

export default function NewClaimPage() {
  return <Suspense><NewClaim /></Suspense>;
}

function NewClaim() {
  const sp = useSearchParams();
  const router = useRouter();
  const run = useAction();
  const [reason, setReason] = useState<ClaimReason | null>(null);
  const [pkg, setPkg] = useState(sp.get("package") ?? "");
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  return (
    <CustomerView title="Report a problem">
      {(me, actor) => {
        const pkgs = svc.listPackages({ customerId: me.id });
        const bills = svc.listBills({ customerId: me.id }).filter((b) => b.lifecycle === "issued");
        return (
          <form
            className="mx-auto max-w-2xl space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (!reason) return;
              const isBill = reason === "billing";
              const c = run(() => svc.createClaim(actor, { customerId: me.id, reason, description: text, packageId: !isBill && pkg ? pkg : undefined, billId: isBill && pkg ? pkg : undefined, photos }), (x) => `Claim ${x.id} sent. We'll reply within 2 business days.`);
              if (c) router.push(`/claims?open=${c.id}`);
            }}
          >
            <h1 className="text-4xl font-black tracking-tight">What went wrong?</h1>
            <div className="grid gap-3 sm:grid-cols-2">
              {(Object.keys(CLAIM_REASON) as ClaimReason[]).map((r) => (
                <ChoiceButton key={r} icon={CLAIM_REASON[r].icon} label={CLAIM_REASON[r].label} selected={reason === r} onClick={() => setReason(r)} />
              ))}
            </div>
            {reason && (
              <div className="animate-rise space-y-4">
                <Field label={reason === "billing" ? "Which bill?" : "Which package?"}>
                  <Select value={pkg} onChange={(e) => setPkg(e.target.value)}>
                    <option value="">Not sure</option>
                    {reason === "billing" ? bills.map((b) => <option key={b.id} value={b.id}>{b.id} — ${b.total.toFixed(2)}</option>) : pkgs.map((p) => <option key={p.id} value={p.id}>{p.merchant} — {p.itemName} ({p.id})</option>)}
                  </Select>
                </Field>
                <Field label="Tell us what happened"><Textarea rows={4} required value={text} onChange={(e) => setText(e.target.value)} placeholder="A few words is fine." /></Field>
                <div>
                  <p className="mb-1 text-sm font-bold text-ink-soft">Photos (optional)</p>
                  <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sand-200 bg-white font-bold">
                    📷 {photos.length ? `${photos.length} photo${photos.length > 1 ? "s" : ""} added` : "Add photos"}
                    <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => setPhotos([...photos, ...Array.from(e.target.files ?? []).map((f, i) => `claim:${f.name}:${i}`)])} />
                  </label>
                  <p className="mt-1 text-xs text-ink-mute">Demo: photos stay on your device; we show a placeholder.</p>
                </div>
                <Button type="submit" size="xl" full>Send to The Link</Button>
              </div>
            )}
          </form>
        );
      }}
    </CustomerView>
  );
}
