"use client";

import Link from "next/link";
import { PACKAGE_COPY } from "@/domain/copy";
import type { Package } from "@/domain/types";
import * as svc from "@/services";
import { Pill } from "../ui/Pill";
import { Journey } from "./Journey";
import { MerchantMark } from "./MerchantMark";
import { PackagePill } from "./Status";

/** Customer package card: merchant, item, ID, status, location, next action. */
export function PackageCard({ pkg }: { pkg: Package }) {
  const c = PACKAGE_COPY[pkg.status];
  const sh = svc.findShipment(pkg.shipmentId);
  const delivery = svc.deliveryForShipment(pkg.shipmentId);
  const needsReceipt = !pkg.purchaseInvoiceId && pkg.status !== "delivered";
  const storage = svc.packageStorage(pkg.id);
  const where = pkg.status === "in_transit" && sh ? svc.getVoyage(sh.voyageId)?.label ?? "On the way" : pkg.status === "received" || pkg.status === "preparing" ? "Florida Warehouse" : pkg.status === "incoming" ? "With the carrier" : pkg.status === "delivered" ? "With you" : "The Bahamas";
  return (
    <Link href={`/packages/${pkg.id}`} className="group block rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-sand-200/70 transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] sm:p-6">
      <div className="flex items-start gap-4">
        <MerchantMark merchant={pkg.merchant} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold uppercase tracking-wide text-ink-mute">{pkg.merchant}</p>
          <p className="truncate text-xl font-extrabold">{pkg.itemName}</p>
          <p className="font-mono text-xs text-ink-mute">{pkg.id}</p>
        </div>
        <span aria-hidden className="mt-1 text-2xl text-ink-mute transition-transform group-hover:translate-x-1">›</span>
      </div>
      <p className="mt-4 flex items-center gap-2 text-2xl font-black tracking-tight sm:text-[1.7rem]">
        <span aria-hidden>{c.icon}</span> {delivery?.status === "out_for_delivery" ? "Out for delivery 🚚" : c.title}
      </p>
      <p className="mt-1 text-ink-soft">📍 {where}</p>
      <div className="mt-4"><Journey status={pkg.status} compact /></div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <PackagePill status={pkg.status} />
        {sh && pkg.status !== "delivered" && <Pill tone="good" icon="🔗">{sh.packageIds.length > 1 ? "Traveling together" : sh.id}</Pill>}
        {needsReceipt && <Pill tone="warn" icon="🧾">Receipt needed</Pill>}
        {pkg.storage.holdStatus !== "none" && <Pill tone="warn" icon="✋">On hold</Pill>}
        {storage.state === "overdue" && <Pill tone="bad" icon="⏰">Waiting {storage.daysWaiting} days</Pill>}
      </div>
      <p className="mt-3 font-semibold text-sea-700">👉 {needsReceipt ? "Upload your store receipt" : c.next}</p>
    </Link>
  );
}
