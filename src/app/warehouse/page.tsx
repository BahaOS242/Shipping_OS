"use client";

import { useLive } from "@/data/useLive";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MerchantMark } from "@/components/domain/MerchantMark";
import { PackagePill } from "@/components/domain/Status";
import { CustomerLink, ShipmentLink } from "@/components/ops/Links";
import { Btn, OpsPage } from "@/components/ops/OpsPage";
import { Pill } from "@/components/ui/Pill";
import { Section, StatTile } from "@/components/ui/Section";
import { Ago } from "@/components/ui/Time";
import { useAction } from "@/components/ui/Toast";
import { EXCEPTION_CATALOG } from "@/domain/copy";
import { fmtLb } from "@/domain/rates";
import type { Package } from "@/domain/types";
import * as svc from "@/services";

type Tab = "dock" | "warehouse" | "attention" | "send" | "storage";

export default function WarehousePage() {
  useLive();
  const run = useAction();
  const router = useRouter();
  const actor = svc.currentActor();
  const q = svc.warehouseQueues();
  const ops = svc.operationsSnapshot();
  const storage = svc.storageQueue().filter((x) => x.storage.daysOver > 0);
  const [tab, setTab] = useState<Tab>("dock");
  const tabs: [Tab, string, number][] = [
    ["dock", "At the dock", q.atDock.length],
    ["warehouse", "On the shelves", q.atWarehouse.length],
    ["attention", "Needs attention", q.needsAttention.length],
    ["send", "Ready to send", q.readyToSend.length],
    ["storage", "Storage overdue", storage.length],
  ];
  const rows: Package[] = tab === "dock" ? [...q.atDock, ...q.arriving] : tab === "warehouse" ? q.atWarehouse : tab === "attention" ? q.needsAttention : [];

  return (
    <OpsPage
      title="Warehouse"
      sub={`${q.atDock.length + q.needsAttention.length + q.readyToSend.length} packages need action · Florida Warehouse`}
      actions={
        <>
          <Btn tone="gold" onClick={() => { const p = run(() => svc.simulateTruckArrival(actor), (x) => `Truck dropped ${x.merchant} box → ${x.id}`); if (p) setTab("dock"); }}>🚚 Simulate truck arrival</Btn>
          <Btn tone="dark" onClick={() => router.push("/warehouse/scan")}>📷 Scan a package</Btn>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="🚚" label="Packages arriving" value={ops.arriving} sub={`${ops.docked} at the dock now`} />
        <StatTile icon="📥" label="Received today" value={ops.receivedToday} />
        <StatTile icon="⚠" label="Needs attention" value={q.needsAttention.length} tone={q.needsAttention.length ? "alert" : "neutral"} />
        <StatTile icon="🛫" label="Ready to ship" value={q.readyToSend.length} sub={`${q.packing.length} packages being packed`} />
      </div>
      <nav className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0" aria-label="Queues">
        {tabs.map(([k, l, n]) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} className={`min-h-10 shrink-0 rounded-full px-3.5 text-sm font-bold ring-1 ${tab === k ? "bg-ink text-white ring-ink" : "bg-white ring-[#e3e7ec]"}`}>
            {l} <span className={`ml-1 rounded-full px-1.5 text-xs ${tab === k ? "bg-white/20" : "bg-[#eef1f4]"}`}>{n}</span>
          </button>
        ))}
      </nav>

      {tab === "send" ? (
        <Section title="Cleared by customs — ready to send" pad={false}>
          {!q.readyToSend.length ? <p className="p-5 text-ink-mute">Nothing cleared yet. Shipments appear here after customs approval.</p> : (
            <ul className="divide-y divide-[#eef1f4]">
              {q.readyToSend.map((s) => {
                const v = svc.nextVoyage(s.destinationId, s.service);
                return (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                    <span><ShipmentLink id={s.id} /> · <CustomerLink id={s.customerId} /> · {s.packageIds.length} pcs · {svc.getDestination(s.destinationId).name} {s.service === "air" ? "✈️" : "🚢"}<span className="block text-sm text-ink-mute">Next: {v?.label ?? "no scheduled trip"}</span></span>
                    <Btn tone="sea" onClick={() => run(() => svc.departShipment(actor, s.id), `${s.id} departed — customer notified.`)}>Send ✈️</Btn>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      ) : tab === "storage" ? (
        <Section title="Past free storage" pad={false}>
          <ul className="divide-y divide-[#eef1f4]">
            {storage.map(({ package: p, storage: st }) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <span><Link href={`/warehouse/packages/${p.id}`} className="font-mono font-bold text-sea-700">{p.id}</Link> · {p.merchant} · <CustomerLink id={p.customerId} /><span className="block text-sm text-coral-700">Waiting {st.daysWaiting} days · {st.daysOver} over · ${st.feeUncharged.toFixed(2)} not charged{st.state === "at_risk" ? " · at risk of abandonment" : ""}</span></span>
                <span className="flex flex-wrap gap-2">
                  <Btn tone="light" onClick={() => run(() => svc.notifyStorage(actor, p.id), "Reminder sent (simulated WhatsApp/email).")}>🔔 Notify</Btn>
                  <Btn tone="light" onClick={() => run(() => svc.applyStorageFee(actor, p.id), "Storage fee added to the customer's bill.")}>$ Apply fee</Btn>
                  <Btn tone="light" onClick={() => run(() => svc.placeStorageHold(actor, p.id, "Storage review"), "Placed on hold.")}>✋ Hold</Btn>
                  <Btn tone="light" onClick={() => run(() => svc.markCollected(actor, p.id, "Collected in Florida"), "Marked collected.")}>✓ Collected</Btn>
                  <Btn tone="danger" onClick={() => run(() => svc.escalateStorage(actor, p.id), "Escalated to management.")}>⚑ Escalate</Btn>
                </span>
              </li>
            ))}
            {!storage.length && <li className="p-5 text-ink-mute">No packages past free storage.</li>}
          </ul>
        </Section>
      ) : (
        <Section pad={false}>
          {!rows.length ? <p className="p-5 text-ink-mute">Nothing here right now. 🎉</p> : (
            <>
              <table className="hidden w-full text-left md:table">
                <thead className="text-sm text-ink-mute"><tr><th className="px-5 py-3">Package</th><th className="px-3 py-3">Customer</th><th className="px-3 py-3">Merchant</th><th className="px-3 py-3">Destination</th><th className="px-3 py-3">Weight</th><th className="px-3 py-3">Invoice</th><th className="px-3 py-3">Status</th><th className="px-5 py-3">Exception</th></tr></thead>
                <tbody className="divide-y divide-[#eef1f4]">
                  {rows.map((p) => {
                    const ex = q.withEx(p);
                    return (
                      <tr key={p.id} className="relative hover:bg-[#f7f9fa]">
                        <td className="px-5 py-3"><Link href={`/warehouse/packages/${p.id}`} className="font-mono font-bold after:absolute after:inset-0">{p.id}</Link><span className="block text-xs text-ink-mute">{p.dockedAt ? <>docked <Ago iso={p.dockedAt} /></> : p.status === "incoming" ? "expected" : p.bin}</span></td>
                        <td className="relative z-10 px-3 py-3"><CustomerLink id={p.customerId} /></td>
                        <td className="px-3 py-3">{p.merchant}<span className="block text-xs text-ink-mute">{p.itemName}</span></td>
                        <td className="px-3 py-3">{svc.getDestination(p.destinationId).name} {p.service === "air" ? "✈️" : "🚢"}</td>
                        <td className="px-3 py-3 tabular-nums">{fmtLb(p.actualWeight)}</td>
                        <td className="px-3 py-3">{p.purchaseInvoiceId ? <Pill tone="done" icon="✓">Linked</Pill> : <Pill tone="warn" icon="🧾">Missing</Pill>}</td>
                        <td className="px-3 py-3"><PackagePill status={p.status} staff /></td>
                        <td className="px-5 py-3">{ex.length ? <span className="text-sm font-bold text-coral-700">{ex.map((e) => `${EXCEPTION_CATALOG[e.type].icon} ${EXCEPTION_CATALOG[e.type].label}`).join(", ")}</span> : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <ul className="divide-y divide-[#eef1f4] md:hidden">
                {rows.map((p) => (
                  <li key={p.id}>
                    <Link href={`/warehouse/packages/${p.id}`} className="flex items-center gap-3 px-4 py-3">
                      <MerchantMark merchant={p.merchant} size="sm" />
                      <span className="min-w-0 flex-1"><span className="block font-mono text-sm font-bold">{p.id}</span><span className="block truncate text-sm text-ink-soft">{p.merchant} · {svc.customerName(svc.findCustomer(p.customerId))} · {fmtLb(p.actualWeight)}</span>{q.withEx(p).length > 0 && <span className="text-xs font-bold text-coral-700">⚠ {q.withEx(p).length} exception(s)</span>}</span>
                      <PackagePill status={p.status} staff />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      )}
    </OpsPage>
  );
}
