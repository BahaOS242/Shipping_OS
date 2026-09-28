"use client";

import Link from "next/link";
import { useState } from "react";
import { CustomerView } from "@/components/customer/CustomerView";
import { PackageCard } from "@/components/domain/PackageCard";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PACKAGE_COPY } from "@/domain/copy";
import { PACKAGE_STATUSES } from "@/domain/types";
import * as svc from "@/services";

export default function PackagesPage() {
  const [tab, setTab] = useState<"active" | "delivered">("active");
  return (
    <CustomerView title="My Packages">
      {(me) => {
        const all = svc.listPackages({ customerId: me.id });
        const list = all.filter((p) => (tab === "active" ? p.status !== "delivered" : p.status === "delivered"));
        const candidates = svc.consolidationCandidates(me.id);
        return (
          <div className="space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-4xl font-black tracking-tight sm:text-5xl">My Packages</h1>
                <p className="mt-1 text-xl text-ink-soft">Here&apos;s where your stuff is.</p>
              </div>
              <ButtonLink href="/packages/new" variant="secondary" size="md" icon="➕">Tell us one is coming</ButtonLink>
            </header>
            {candidates.length >= 2 && (
              <Link href="/packages/together" className="flex items-center justify-between gap-4 rounded-[var(--radius-card)] bg-sea-700 p-5 text-white">
                <span>
                  <span className="block text-sm font-bold uppercase tracking-wider text-sun-300">💡 Save money</span>
                  <span className="block text-xl font-extrabold">You have {candidates.length} packages. Put them together?</span>
                </span>
                <span className="shrink-0 rounded-2xl bg-sun-400 px-4 py-3 font-bold text-ink">Put These Together</span>
              </Link>
            )}
            <div role="tablist" className="inline-flex rounded-2xl bg-white p-1 ring-1 ring-sand-200">
              {(["active", "delivered"] as const).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`min-h-11 rounded-xl px-4 font-bold ${tab === t ? "bg-ink text-white" : "text-ink-soft"}`}>
                  {t === "active" ? `On the move (${all.filter((p) => p.status !== "delivered").length})` : `Delivered (${all.filter((p) => p.status === "delivered").length})`}
                </button>
              ))}
            </div>
            {list.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{list.map((p) => <PackageCard key={p.id} pkg={p} />)}</div>
            ) : (
              <EmptyState icon={tab === "active" ? "📭" : "🎉"} title={tab === "active" ? "Nothing on the move" : "No deliveries yet"}>
                {tab === "active" ? "Shop using your The Link address and your packages show up here." : "Delivered packages will appear here."}
              </EmptyState>
            )}
            <details className="group rounded-[var(--radius-card)] bg-white p-5 ring-1 ring-sand-200/70">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-xl font-extrabold">❓ What does my status mean?<span aria-hidden className="text-2xl group-open:rotate-45">+</span></summary>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {PACKAGE_STATUSES.map((s) => (
                  <li key={s} className="flex gap-3 rounded-2xl bg-sand-50 p-4">
                    <span aria-hidden className="text-3xl">{PACKAGE_COPY[s].icon}</span>
                    <span><span className="block text-lg font-extrabold">{PACKAGE_COPY[s].title}</span><span className="text-ink-soft">{PACKAGE_COPY[s].explain}</span></span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        );
      }}
    </CustomerView>
  );
}
