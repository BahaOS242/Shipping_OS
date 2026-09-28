"use client";

import { useLive } from "@/data/useLive";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Activity } from "@/components/domain/Activity";
import { SeverityPill } from "@/components/domain/Status";
import { ColumnChart } from "@/components/ops/Charts";
import { OpsPage } from "@/components/ops/OpsPage";
import { Input } from "@/components/ui/Field";
import { Section, StatTile } from "@/components/ui/Section";
import { Ago } from "@/components/ui/Time";
import { EXCEPTION_CATALOG, TEAM_LABEL } from "@/domain/copy";
import { fmtUsd } from "@/domain/rates";
import * as svc from "@/services";

/** Management dashboard — everything that needs attention, from the same records every team uses. */
export default function AdminPage() {
  useLive();
  const router = useRouter();
  const [q, setQ] = useState("");
  const ops = svc.operationsSnapshot();
  const queues = svc.workQueues();
  const a = svc.analytics();
  const top = svc.listExceptions({ status: "active" }).slice(0, 6);
  const QUEUES = [
    { k: "warehouse", label: "Warehouse queue", href: "/warehouse", icon: "🏭", note: "packages need action" },
    { k: "customs", label: "Customs queue", href: "/customs", icon: "📋", note: "shipments need review" },
    { k: "accounting", label: "Accounting queue", href: "/accounting", icon: "🧮", note: "invoices/payments don't match" },
    { k: "support", label: "Support queue", href: "/support", icon: "🎧", note: "customers waiting" },
    { k: "delivery", label: "Delivery queue", href: "/delivery", icon: "🚚", note: "deliveries to handle" },
    { k: "management", label: "Management", href: "/exceptions?team=management", icon: "📊", note: "escalations & critical" },
  ] as const;
  return (
    <OpsPage title="Operations overview" sub="Everything that needs attention — derived live from packages, shipments, bills and tickets." eyebrow={`Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}, ${svc.currentActor().name.split(" ")[0]}`}>
      <form role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/admin/search?q=${encodeURIComponent(q.trim())}`); }} className="flex max-w-2xl gap-2">
        <label htmlFor="admin-q" className="sr-only">Search</label>
        <Input id="admin-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer, TL-PKG-10474, TL-SHP-…, invoice, order or tracking number" className="!min-h-14 !text-base" />
        <button className="min-h-14 rounded-xl bg-ink px-5 font-bold text-white">Search</button>
      </form>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
        <StatTile icon="📥" label="Received today" value={ops.receivedToday} href="/warehouse" />
        <StatTile icon="🛫" label="Ready for shipment" value={ops.readyForShipment} href="/warehouse" />
        <StatTile icon="✈️" label="In transit" value={ops.inTransit} sub={`${ops.inTransitPackages} packages`} href="/customs" />
        <StatTile icon="⚠" label="Needs attention" value={ops.openExceptions} sub={`${ops.criticalExceptions} high/critical`} tone="alert" href="/exceptions" />
        <StatTile icon="💵" label="Revenue (30d)" value={fmtUsd(ops.revenue30)} sub="collected, demo" href="/analytics" />
        <StatTile icon="⚑" label="Open exceptions" value={ops.openExceptions} href="/exceptions" />
        <StatTile icon="🛟" label="Open claims" value={ops.openClaims} href="/claims" />
        <StatTile icon="🧾" label="Pending payments" value={fmtUsd(ops.pendingPayments)} href="/accounting?tab=bills" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {QUEUES.map((x) => (
          <Link key={x.k} href={x.href} className="rounded-2xl bg-white p-4 ring-1 ring-[#e3e7ec] transition hover:-translate-y-0.5 hover:ring-sea-400">
            <p className="text-sm font-bold text-ink-soft">{x.icon} {x.label}</p>
            <p className="text-3xl font-black">{queues[x.k]}</p>
            <p className="text-xs text-ink-mute">{x.note}</p>
          </Link>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.3fr_1fr]">
        <Section title="Top of the exception list" action={<Link href="/exceptions" className="text-sm font-bold text-sea-700">Exception Center →</Link>} pad={false}>
          <ul className="divide-y divide-[#eef1f4]">
            {top.map((e) => (
              <li key={e.id}><Link href={`/exceptions?open=${e.id}`} className="flex flex-wrap items-center gap-2 px-5 py-3 hover:bg-[#f7f9fa]"><SeverityPill severity={e.severity} /><span className="font-bold">{EXCEPTION_CATALOG[e.type].icon} {e.title}</span><span className="text-sm text-ink-soft">· {TEAM_LABEL[e.team]} · {svc.customerName(svc.findCustomer(e.customerId))} · <Ago iso={e.createdAt} /></span></Link></li>
            ))}
          </ul>
        </Section>
        <Section title="Packages received per day (last 14 days)" action={<Link href="/analytics" className="text-sm font-bold text-sea-700">Analytics →</Link>}>
          <ColumnChart title={`${a.packages.avgPerDay} per day on average`} data={a.packages.perDay.map((d) => ({ label: d.label, value: d.count }))} />
        </Section>
      </div>
      <Section title="Live activity across the company"><Activity events={svc.recentEvents(14).reverse()} /></Section>
    </OpsPage>
  );
}
