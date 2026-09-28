"use client";

import Link from "next/link";
import { useLive } from "@/data/useLive";
import * as svc from "@/services";
import { MerchantMark } from "../domain/MerchantMark";
import { PackagePill } from "../domain/Status";
import { ButtonLink } from "../ui/Button";

/** Personal strip on the public homepage (demo customer). */
export function YourPackagesPeek() {
  const live = useLive();
  if (!live) return <div className="h-64 animate-pulse rounded-[var(--radius-card)] bg-sand-200/50" />;
  const s = svc.getSession();
  const me = svc.findCustomer(s.customerId);
  if (!me) return null;
  const active = svc.listPackages({ customerId: me.id }).filter((p) => p.status !== "delivered");
  const actions = svc.customerActions(me.id);
  return (
    <div className="rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-sand-200/70 sm:p-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-semibold text-sea-700">Hi {me.firstName} 👋</p>
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Your Packages</h2>
          <p className="text-lg text-ink-soft"><strong className="text-ink">{active.length} packages</strong> on the move{actions.length ? <> · <strong className="text-coral-700">{actions.length} to do</strong></> : null}</p>
        </div>
        <span aria-hidden className="text-5xl">📦</span>
      </div>
      <ul className="mt-4 divide-y divide-sand-200">
        {active.slice(0, 4).map((p) => (
          <li key={p.id}>
            <Link href={`/packages/${p.id}`} className="flex min-h-16 items-center gap-4 py-3">
              <MerchantMark merchant={p.merchant} />
              <span className="min-w-0 flex-1"><span className="block text-lg font-bold">{p.merchant}</span><span className="block truncate text-ink-soft">{p.itemName}</span></span>
              <PackagePill status={p.status} />
            </Link>
          </li>
        ))}
      </ul>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ButtonLink href="/packages" full icon="📦">View All Packages</ButtonLink>
        <ButtonLink href="/dashboard" full variant="secondary" icon="🏠">My dashboard</ButtonLink>
      </div>
    </div>
  );
}
