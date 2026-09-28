"use client";

import { useLive } from "@/data/useLive";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Btn, OpsPage } from "@/components/ops/OpsPage";
import { Input } from "@/components/ui/Field";
import { Section } from "@/components/ui/Section";
import { useAction } from "@/components/ui/Toast";
import { QR } from "@/components/ui/Visuals";
import * as svc from "@/services";

/** Scanner simulation: type/scan a The Link ID, a carrier tracking number, or tap a label. */
export default function ScanPage() {
  useLive();
  const router = useRouter();
  const run = useAction();
  const actor = svc.currentActor();
  const [code, setCode] = useState("");
  const q = svc.warehouseQueues();

  function scan(raw: string) {
    const c = raw.trim();
    if (!c) return;
    const byId = svc.findPackage(c);
    if (byId) return router.push(`/warehouse/packages/${byId.id}`);
    const byTracking = svc.listPackages().find((p) => p.inboundTracking.toLowerCase() === c.toLowerCase());
    if (byTracking) {
      if (byTracking.status === "incoming") run(() => svc.dockScan(actor, { inboundTracking: byTracking.inboundTracking, carrier: byTracking.carrier, labelName: byTracking.labelName, labelSuite: byTracking.labelSuite, merchant: byTracking.merchant }));
      return router.push(`/warehouse/packages/${byTracking.id}?receive=1`);
    }
    const sh = svc.findShipment(c);
    if (sh) return router.push(`/customs/${sh.id}`);
    run(() => { throw new Error(`Nothing found for “${c}”. Try a TL-PKG ID or tracking number.`); });
  }

  return (
    <OpsPage title="Scan a package" sub="Point the scanner at a The Link QR label or a carrier barcode. (Simulated — type or tap below.)">
      <form onSubmit={(e) => { e.preventDefault(); scan(code); }} className="flex max-w-xl gap-2">
        <label htmlFor="scan" className="sr-only">Code</label>
        <Input id="scan" autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="TL-PKG-10482 or tracking number" className="!min-h-14 !text-lg font-mono" />
        <Btn type="submit" tone="dark">Scan</Btn>
      </form>
      <Section title="Boxes on the dock — tap a label to scan it">
        {!q.atDock.length && !q.arriving.length ? <p className="text-ink-mute">The dock is empty. Use “Simulate truck arrival” on the Warehouse page.</p> : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[...q.atDock, ...q.arriving].map((p) => (
              <li key={p.id}>
                <button onClick={() => scan(p.id)} className="flex w-full items-center gap-4 rounded-2xl bg-[#fffdf5] p-4 text-left ring-1 ring-[#e3e7ec] hover:ring-sea-400">
                  <QR value={p.id} size={72} label={false} />
                  <span className="min-w-0 font-mono text-sm">
                    <span className="block font-bold">{p.id}</span>
                    <span className="block truncate">{p.labelName}{p.labelSuite ? ` #${p.labelSuite}` : ""}</span>
                    <span className="block truncate text-ink-mute">{p.carrier} {p.inboundTracking}</span>
                    <span className="block text-xs font-sans font-bold text-sea-700">{p.dockedAt ? "At the dock" : "Expected"}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <p className="text-sm text-ink-mute">Tip: the same ID works everywhere — try it in the global search, or ask Link Assistant about it. <Link href="/warehouse" className="font-bold text-sea-700">Back to warehouse</Link></p>
    </OpsPage>
  );
}
