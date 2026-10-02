"use client";

/**
 * Operations overview widgets. The page renders whatever `dashboardFor(org)`
 * returns, so a mailboat operator, a forwarder and a courier each get their own
 * emphasis from configuration — there are no business-type branches here.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Activity } from "@/components/domain/Activity";
import { DeliveryPill, SeverityPill } from "@/components/domain/Status";
import { ColumnChart } from "@/components/ops/Charts";
import { Input } from "@/components/ui/Field";
import { Section, StatTile } from "@/components/ui/Section";
import { Ago, fmtDateTime } from "@/components/ui/Time";
import { EXCEPTION_CATALOG, TEAM_LABEL } from "@/domain/copy";
import { fmtUsd } from "@/domain/rates";
import type { WidgetId } from "@/platform/dashboard";
import type { ModuleId } from "@/platform/modules";
import * as svc from "@/services";
import { CapacityBar, TripLine } from "./Network";

const on = (m: ModuleId) => svc.isModuleEnabled(m);

function SearchWidget() {
  const router = useRouter();
  const [q, setQ] = useState("");
  return (
    <form role="search" onSubmit={(e) => { e.preventDefault(); if (q.trim()) router.push(`/admin/search?q=${encodeURIComponent(q.trim())}`); }} className="flex max-w-2xl gap-2">
      <label htmlFor="admin-q" className="sr-only">Search</label>
      <Input id="admin-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer, package, shipment, invoice, order or tracking number" className="!min-h-14 !text-base" />
      <button className="min-h-14 rounded-xl bg-ink px-5 font-bold text-white">Search</button>
    </form>
  );
}

function OperationsStats() {
  const ops = svc.operationsSnapshot();
  const tiles = [
    on("warehouse") && <StatTile key="r" icon="📥" label="Received today" value={ops.receivedToday} href="/warehouse" />,
    <StatTile key="ready" icon="🛫" label="Ready to go" value={ops.readyForShipment} href={on("warehouse") ? "/warehouse" : "/manifest"} />,
    <StatTile key="t" icon="🚢" label="In transit" value={ops.inTransit} sub={`${ops.inTransitPackages} packages`} />,
    <StatTile key="x" icon="⚠" label="Needs attention" value={ops.openExceptions} sub={`${ops.criticalExceptions} high/critical`} tone="alert" href="/exceptions" />,
    on("customs") && <StatTile key="c" icon="📋" label="Awaiting customs" value={ops.awaitingCustoms} href="/customs" />,
    on("support") && <StatTile key="cl" icon="🛟" label="Open claims" value={ops.openClaims} href="/claims" />,
  ].filter(Boolean);
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">{tiles}</div>;
}

function WorkQueues() {
  const queues = svc.workQueues();
  const QUEUES = [
    { k: "warehouse", label: "Warehouse queue", href: "/warehouse", icon: "🏭", note: "packages need action", module: "warehouse" },
    { k: "customs", label: "Customs queue", href: "/customs", icon: "📋", note: "shipments need review", module: "customs" },
    { k: "accounting", label: "Accounting queue", href: "/accounting", icon: "🧮", note: "invoices/payments don't match", module: "billing" },
    { k: "support", label: "Support queue", href: "/support", icon: "🎧", note: "customers waiting", module: "support" },
    { k: "delivery", label: "Delivery queue", href: "/delivery", icon: "🚚", note: "deliveries to handle", module: "delivery" },
    { k: "management", label: "Management", href: "/exceptions?team=management", icon: "📊", note: "escalations & critical", module: null },
  ] as const;
  const shown = QUEUES.filter((x) => !x.module || on(x.module));
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      {shown.map((x) => (
        <Link key={x.k} href={x.href} className="rounded-2xl bg-white p-4 ring-1 ring-[#e3e7ec] transition hover:-translate-y-0.5 hover:ring-sea-400">
          <p className="text-sm font-bold text-ink-soft">{x.icon} {x.label}</p>
          <p className="text-3xl font-black">{queues[x.k]}</p>
          <p className="text-xs text-ink-mute">{x.note}</p>
        </Link>
      ))}
    </div>
  );
}

function TodaysTrips() {
  const trips = svc.todaysTrips();
  return (
    <Section title={`Today's trips (${trips.length})`} action={<Link href="/trips" className="text-sm font-bold text-sea-700">All trips →</Link>} pad={false}>
      {trips.length === 0 ? <p className="px-5 py-6 text-ink-mute">No sailings today.</p> : (
        <ul className="divide-y divide-[#eef1f4]">
          {trips.map((t) => {
            const d = svc.tripDetails(t);
            return (
              <li key={t.id} className="grid gap-2 px-5 py-3 md:grid-cols-[1.4fr_1fr]">
                <TripLine trip={t} route={d.route?.name} sub={<p className="text-xs text-ink-mute">{d.shipments.length} shipment{d.shipments.length === 1 ? "" : "s"} · {d.bookings.filter((b) => b.status !== "checked_in").length} bookings waiting · manifest {d.manifestClosed ? "closed" : "open"}</p>} />
                <CapacityBar c={d.capacity} />
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

function CapacityWidget() {
  const trips = svc.listTrips({ fromDaysAgo: 0, days: 7, status: "scheduled", routed: true }).slice(0, 6);
  return (
    <Section title="Capacity — next 7 days" action={<Link href="/capacity" className="text-sm font-bold text-sea-700">Capacity →</Link>}>
      <ul className="space-y-3">
        {trips.map((t) => (
          <li key={t.id}>
            <p className="text-sm font-bold">{t.label} <span className="font-normal text-ink-mute">· {fmtDateTime(t.departsAt)}</span></p>
            <CapacityBar c={svc.tripCapacity(t)} />
          </li>
        ))}
        {!trips.length && <li className="text-ink-mute">No upcoming trips. Generate them from a schedule.</li>}
      </ul>
    </Section>
  );
}

function BookingsWidget() {
  const waiting = svc.listBookings({ status: "requested" });
  const confirmed = svc.listBookings({ status: "confirmed" });
  return (
    <Section title="Bookings" action={<Link href="/bookings" className="text-sm font-bold text-sea-700">Bookings →</Link>}>
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon="📨" label="Waiting to confirm" value={waiting.length} tone={waiting.length ? "alert" : "neutral"} href="/bookings?status=requested" />
        <StatTile icon="🎟️" label="Confirmed, not checked in" value={confirmed.length} href="/bookings?status=confirmed" />
      </div>
    </Section>
  );
}

function ManifestsWidget() {
  const open = svc.listManifests().filter((m) => m.status === "open" && m.trip.status === "scheduled").slice(0, 5);
  return (
    <Section title="Open manifests" action={<Link href="/manifest" className="text-sm font-bold text-sea-700">Manifests →</Link>} pad={false}>
      <ul className="divide-y divide-[#eef1f4]">
        {open.map((m) => (
          <li key={m.trip.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
            <Link href={`/manifest?trip=${m.trip.id}`} className="font-bold hover:underline">{m.trip.label}</Link>
            <span className="text-ink-soft">{m.totals.shipments} shipments · {m.totals.weightLb.toLocaleString()} lb · departs {fmtDateTime(m.trip.departsAt)}</span>
          </li>
        ))}
        {!open.length && <li className="px-5 py-6 text-ink-mute">Nothing loading right now.</li>}
      </ul>
    </Section>
  );
}

function TodaysDeliveries() {
  const today = new Date().toDateString();
  const list = svc.listDeliveries().filter((d) => d.method === "home_delivery" && (d.status === "out_for_delivery" || (d.window && new Date(d.window.date).toDateString() === today)));
  return (
    <Section title={`Today's deliveries (${list.length})`} action={<Link href="/delivery" className="text-sm font-bold text-sea-700">Dispatch →</Link>} pad={false}>
      <ul className="divide-y divide-[#eef1f4]">
        {list.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
            <span><span className="font-mono font-bold">{d.id}</span> · {svc.customerName(svc.findCustomer(d.customerId))} · {d.address}</span>
            <span className="flex items-center gap-2">{d.driver && <span className="text-ink-soft">🚚 {d.driver}</span>}<DeliveryPill status={d.status} staff size="xs" />{d.proof && <span title="Proof of delivery">✍️</span>}</span>
          </li>
        ))}
        {!list.length && <li className="px-5 py-6 text-ink-mute">No deliveries planned for today.</li>}
      </ul>
    </Section>
  );
}

function Drivers() {
  const all = svc.listDeliveries();
  return (
    <Section title="Drivers" action={on("driver_portal") ? <Link href="/driver" className="text-sm font-bold text-sea-700">Driver runs →</Link> : undefined}>
      <ul className="grid gap-3 sm:grid-cols-2">
        {svc.listDrivers().map((name) => {
          const mine = all.filter((d) => d.driver === name);
          const road = mine.filter((d) => d.status === "out_for_delivery").length;
          const planned = mine.filter((d) => ["scheduled", "rescheduled"].includes(d.status)).length;
          return (
            <li key={name} className="rounded-xl bg-[#f7f9fa] p-3">
              <p className="font-bold">🚚 {name}</p>
              <p className="text-sm text-ink-soft">{road} on the road · {planned} planned · {mine.filter((d) => d.status === "delivered").length} delivered</p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

function ReceivingChart() {
  const a = svc.analytics();
  return (
    <Section title="Packages received per day (last 14 days)" action={on("analytics") ? <Link href="/analytics" className="text-sm font-bold text-sea-700">Analytics →</Link> : undefined}>
      <ColumnChart title={`${a.packages.avgPerDay} per day on average`} data={a.packages.perDay.map((d) => ({ label: d.label, value: d.count }))} />
    </Section>
  );
}

function Exceptions() {
  const top = svc.listExceptions({ status: "active" }).slice(0, 6);
  return (
    <Section title="Top of the exception list" action={<Link href="/exceptions" className="text-sm font-bold text-sea-700">Exception Center →</Link>} pad={false}>
      <ul className="divide-y divide-[#eef1f4]">
        {top.map((e) => (
          <li key={e.id}><Link href={`/exceptions?open=${e.id}`} className="flex flex-wrap items-center gap-2 px-5 py-3 hover:bg-[#f7f9fa]"><SeverityPill severity={e.severity} /><span className="font-bold">{EXCEPTION_CATALOG[e.type].icon} {e.title}</span><span className="text-sm text-ink-soft">· {TEAM_LABEL[e.team]} · {svc.customerName(svc.findCustomer(e.customerId))} · <Ago iso={e.createdAt} /></span></Link></li>
        ))}
        {!top.length && <li className="px-5 py-6 text-ink-mute">Nothing needs attention. 🎉</li>}
      </ul>
    </Section>
  );
}

function Billing() {
  const ops = svc.operationsSnapshot();
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatTile icon="💵" label="Collected (30d)" value={fmtUsd(ops.revenue30)} sub="demo payments" href={on("analytics") ? "/analytics" : "/accounting"} />
      <StatTile icon="🧾" label="Waiting to be paid" value={fmtUsd(ops.pendingPayments)} href="/accounting?tab=bills" />
    </div>
  );
}

const ActivityWidget = () => <Section title="Live activity"><Activity events={svc.recentEvents(14).reverse()} /></Section>;

export const WIDGET_COMPONENTS: Record<WidgetId, () => React.ReactNode> = {
  search: SearchWidget,
  operations_stats: OperationsStats,
  work_queues: WorkQueues,
  todays_trips: TodaysTrips,
  capacity: CapacityWidget,
  bookings: BookingsWidget,
  manifests: ManifestsWidget,
  todays_deliveries: TodaysDeliveries,
  drivers: Drivers,
  receiving_chart: ReceivingChart,
  exceptions: Exceptions,
  billing: Billing,
  activity: ActivityWidget,
};
