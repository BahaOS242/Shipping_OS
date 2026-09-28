"use client";

import Link from "next/link";
import type { CustomerPackage } from "@/lib/api/link-api";
import { demo, useDemoStore } from "@/lib/demo-store";
import { fmtLbs } from "@/lib/pricing";
import { canConsolidate, STATUS } from "@/lib/status";
import { PACKAGE_STATUSES } from "@/lib/types";
import { ButtonLink } from "../ui/Button";
import { PackageCard } from "./PackageCard";
import { StatusBadge } from "./StatusBadge";

export function PackagesView({ packages }: { packages: CustomerPackage[] }) {
  const state = useDemoStore();
  const active = packages.filter((p) => p.status !== "delivered");
  const past = packages.filter((p) => p.status === "delivered");
  const candidates = active.filter((p) => canConsolidate(p.status));
  const ungrouped = candidates.filter((p) => !demo.groupFor(state, p.id));
  const total = candidates.reduce((s, p) => s + p.weight, 0);

  return (
    <div className="space-y-10">
      {ungrouped.length >= 2 ? (
        <section className="animate-rise overflow-hidden rounded-[var(--radius-card)] bg-sea-700 p-5 text-white sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-sun-300">
                <span aria-hidden>💡</span> Save money
              </p>
              <h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">Put my packages together</h2>
              <p className="mt-1 text-lg text-sea-100">
                You have {ungrouped.length} packages ({fmtLbs(total)}). We can combine them into one shipment.
              </p>
            </div>
            <ButtonLink href="/packages/together" variant="gold" size="lg" icon="📦" className="shrink-0">
              Put Them Together
            </ButtonLink>
          </div>
        </section>
      ) : candidates.length >= 2 ? (
        <section className="animate-rise flex items-center gap-4 rounded-[var(--radius-card)] bg-emerald-50 p-5 ring-1 ring-emerald-200">
          <span aria-hidden className="text-3xl">🔗</span>
          <div>
            <p className="text-lg font-extrabold text-emerald-900">Your packages will travel together.</p>
            <p className="text-emerald-800">We&apos;ll send them as one shipment when they&apos;re all here.</p>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="active">
        <h2 id="active" className="sr-only">
          Packages on the move
        </h2>
        <p className="mb-4 text-lg font-bold text-ink-soft">
          <span className="text-3xl font-black text-ink">{active.length}</span> packages on the move
        </p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((p) => (
            <PackageCard key={p.id} pkg={p} together={!!demo.groupFor(state, p.id)} />
          ))}
        </div>
      </section>

      {past.length > 0 && (
        <section aria-labelledby="past">
          <h2 id="past" className="text-2xl font-extrabold">
            Already delivered
          </h2>
          <ul className="mt-4 divide-y divide-sand-200 rounded-[var(--radius-card)] bg-white ring-1 ring-sand-200/70">
            {past.map((p) => (
              <li key={p.id}>
                <Link href={`/packages/${p.id}`} className="flex min-h-16 items-center justify-between gap-4 px-5 py-3 hover:bg-sand-50">
                  <span>
                    <span className="block font-bold">{p.merchant}</span>
                    <span className="text-ink-soft">{p.itemName}</span>
                  </span>
                  <StatusBadge status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <details className="group rounded-[var(--radius-card)] bg-white p-5 ring-1 ring-sand-200/70 sm:p-6">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-xl font-extrabold">
          <span>
            <span aria-hidden>❓</span> What does my status mean?
          </span>
          <span aria-hidden className="text-2xl transition-transform group-open:rotate-45">
            +
          </span>
        </summary>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {PACKAGE_STATUSES.map((s) => (
            <li key={s} className="flex gap-3 rounded-2xl bg-sand-50 p-4">
              <span aria-hidden className="text-3xl">
                {STATUS[s].icon}
              </span>
              <span>
                <span className="block text-lg font-extrabold">{STATUS[s].title}</span>
                <span className="text-ink-soft">{STATUS[s].explain}</span>
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
