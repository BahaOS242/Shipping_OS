"use client";

import { useLive } from "@/data/useLive";
import Link from "next/link";
import { useState } from "react";
import { CustomsPill } from "@/components/domain/Status";
import { CustomerLink } from "@/components/ops/Links";
import { OpsPage } from "@/components/ops/OpsPage";
import { Section } from "@/components/ui/Section";
import { Ago } from "@/components/ui/Time";
import { CUSTOMS_COPY } from "@/domain/copy";
import { fmtUsd } from "@/domain/rates";
import type { CustomsStatus } from "@/domain/types";
import * as svc from "@/services";

const QUEUES: { key: CustomsStatus; label: string }[] = [
  { key: "ready_for_review", label: "Ready for Review" },
  { key: "needs_attention", label: "Needs Attention" },
  { key: "missing_documents", label: "Missing Documents" },
  { key: "approved", label: "Approved" },
];

export default function CustomsPage() {
  useLive();
  const all = svc.customsQueue();
  const [q, setQ] = useState<CustomsStatus>(all.some((s) => s.customs.status === "ready_for_review") ? "ready_for_review" : "needs_attention");
  const list = all.filter((s) => s.customs.status === q);
  const recent = svc.listShipments().filter((s) => ["departed", "arrived", "completed", "ready_for_pickup", "out_for_delivery"].includes(s.status)).slice(0, 5);
  return (
    <OpsPage title="Customs" sub={`${all.filter((s) => s.customs.status !== "approved").length} shipments need review · Demo customs workflow — final clearance decisions remain with authorized personnel.`}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {QUEUES.map((x) => {
          const n = all.filter((s) => s.customs.status === x.key).length;
          return (
            <button key={x.key} onClick={() => setQ(x.key)} aria-pressed={q === x.key} className={`rounded-2xl p-4 text-left ring-1 transition ${q === x.key ? "bg-ink text-white ring-ink" : "bg-white ring-[#e3e7ec] hover:ring-sea-400"}`}>
              <p className="text-sm font-bold opacity-80">{CUSTOMS_COPY[x.key].icon} {x.label}</p>
              <p className="text-3xl font-black">{n}</p>
            </button>
          );
        })}
      </div>
      <Section title={QUEUES.find((x) => x.key === q)!.label} pad={false}>
        {!list.length ? <p className="p-5 text-ink-mute">Queue is empty. 🎉</p> : (
          <ul className="divide-y divide-[#eef1f4]">
            {list.map((s) => {
              const pk = svc.customsPacket(s.id);
              return (
                <li key={s.id}>
                  <Link href={`/customs/${s.id}`} className="grid gap-2 px-5 py-4 hover:bg-[#f7f9fa] md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center">
                    <span><span className="font-mono font-bold">{s.id}</span><span className="block text-sm text-ink-soft"><CustomerLink id={s.customerId} /> · {svc.getDestination(s.destinationId).name} · {s.service}</span></span>
                    <span className="text-sm">{pk.totals.packages} pkg · {pk.lines.reduce((a, l) => a + l.items.length, 0)} items · <strong>{fmtUsd(pk.totals.declaredValueUsd)}</strong> declared</span>
                    <span className="text-sm">{pk.missing.length ? <span className="font-bold text-coral-700">📄 {pk.missing.length} missing</span> : "📄 Documents complete"}{pk.flags.length > 0 && <span className="block font-bold text-coral-700">⚑ {pk.flags.length} flag(s)</span>}</span>
                    <span className="flex items-center gap-2"><CustomsPill status={s.customs.status} /><span className="text-xs text-ink-mute"><Ago iso={s.createdAt} /></span></span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
      <Section title="Recently cleared and moving" pad={false}>
        <ul className="divide-y divide-[#eef1f4]">{recent.map((s) => <li key={s.id}><Link href={`/customs/${s.id}`} className="flex justify-between gap-3 px-5 py-3 text-sm hover:bg-[#f7f9fa]"><span className="font-mono font-bold">{s.id}</span><span>{s.customs.reviewedBy ? `Reviewed by ${s.customs.reviewedBy}` : ""} · {s.status}</span></Link></li>)}</ul>
      </Section>
    </OpsPage>
  );
}
