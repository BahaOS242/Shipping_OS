import Link from "next/link";
import type { CustomerPackage } from "@/lib/api/link-api";
import { STATUS } from "@/lib/status";
import { MerchantMark } from "./MerchantMark";
import { PackageTimeline } from "./PackageTimeline";
import { StatusBadge } from "./StatusBadge";

export function PackageCard({ pkg, together }: { pkg: CustomerPackage; together?: boolean }) {
  const s = STATUS[pkg.status];
  return (
    <Link
      href={`/packages/${pkg.id}`}
      className="group block rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-sand-200/70 transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)] hover:ring-sea-200 sm:p-6"
    >
      <div className="flex items-start gap-4">
        <MerchantMark merchant={pkg.merchant} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold uppercase tracking-wide text-ink-mute">{pkg.merchant}</p>
          <p className="truncate text-xl font-extrabold text-ink">{pkg.itemName}</p>
        </div>
        <span aria-hidden className="mt-1 text-2xl text-ink-mute transition-transform group-hover:translate-x-1">
          ›
        </span>
      </div>

      <div className="mt-5">
        <p className="text-sm font-semibold text-ink-mute">Status</p>
        <p className="mt-0.5 flex items-center gap-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          <span aria-hidden>{s.icon}</span> {s.title}
        </p>
        <p className="mt-1 text-ink-soft">{s.explain}</p>
      </div>

      <div className="mt-5">
        <PackageTimeline status={pkg.status} compact />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={pkg.status} />
          {together && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sea-600 px-3 py-1 text-sm font-bold text-white">
              <span aria-hidden>🔗</span> Traveling together
            </span>
          )}
        </div>
        <span className="font-bold text-sea-700">See details →</span>
      </div>
    </Link>
  );
}
