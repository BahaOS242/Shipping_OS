"use client";

import { useLive } from "@/data/useLive";
import { BarList, ColumnChart } from "@/components/ops/Charts";
import { OpsPage } from "@/components/ops/OpsPage";
import { Section, StatTile } from "@/components/ui/Section";
import { fmtLb, fmtUsd } from "@/domain/rates";
import * as svc from "@/services";

const INTENT: Record<string, string> = { find_package: "Where's my package?", quote: "How much will it cost?", balance: "What do I owe?", billing: "Billing problem", billing_problem: "Billing problem", human: "Talk to a person", how_it_works: "How does it work?", address: "My U.S. address", delivery: "Delivery", greet: "Hello", fallback: "Not understood" };

/** Analytics — every metric derived from the same records (no typed-in numbers). */
export default function AnalyticsPage() {
  useLive();
  const a = svc.analytics();
  return (
    <OpsPage title="Analytics" sub="Derived live from the demo dataset. Numbers change as you use the demo.">
      <Section title="👥 Customers">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <StatTile label="Total" value={a.customers.total} />
          <StatTile label="New (30 days)" value={a.customers.new30} />
          <StatTile label="Active (30 days)" value={a.customers.active30} />
          <StatTile label="Repeat (2+ shipments)" value={a.customers.repeat} />
          <StatTile label="Inactive (60 days)" value={a.customers.inactive60} />
          <StatTile label="Business accounts" value={a.customers.business} />
        </div>
      </Section>
      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <Section title="📦 Packages">
          <ColumnChart title="Packages received per day (last 14 days)" data={a.packages.perDay.map((d) => ({ label: d.label, value: d.count }))} />
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="Packages / day" value={a.packages.avgPerDay} />
            <StatTile label="Avg per customer" value={a.packages.avgPerCustomer} />
            <StatTile label="Avg weight" value={fmtLb(a.packages.avgWeight)} />
            <StatTile label="Avg shipment value" value={fmtUsd(a.packages.avgShipmentValue)} sub="declared" />
          </div>
        </Section>
        <Section title="💵 Revenue (billed, excl. government duty)">
          <BarList
            title="By service line"
            data={[
              { label: "Shipping", value: a.revenue.shipping, display: fmtUsd(a.revenue.shipping) },
              { label: "Delivery", value: a.revenue.delivery, display: fmtUsd(a.revenue.delivery) },
              { label: "Storage", value: a.revenue.storage, display: fmtUsd(a.revenue.storage) },
              { label: "Procurement", value: a.revenue.procurement, display: fmtUsd(a.revenue.procurement) },
              { label: "Business accounts", value: a.revenue.business, display: fmtUsd(a.revenue.business) },
            ]}
          />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatTile label="Collected (all time)" value={fmtUsd(a.revenue.collected)} sub="DEMO payments" />
            <StatTile label="Outstanding" value={fmtUsd(a.revenue.outstanding)} tone="alert" />
          </div>
          <p className="mt-2 text-xs text-ink-mute">Business accounts overlaps the service lines (it&apos;s the share billed to business customers).</p>
        </Section>
      </div>
      <Section title="⚙️ Operations">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          <StatTile label="Receiving time" value={`${a.operations.receivingHours}h`} sub="dock → received" />
          <StatTile label="Warehouse backlog" value={a.operations.backlog} sub="at dock or on shelves" />
          <StatTile label="Customs processing" value={`${a.operations.customsHours}h`} sub="created → approved" />
          <StatTile label="Delivery time" value={`${a.operations.deliveryHours}h`} sub="arrived → delivered" />
          <StatTile label="Exception rate" value={`${a.operations.exceptionRate}%`} sub="of received packages" tone={a.operations.exceptionRate > 25 ? "alert" : "neutral"} />
          <StatTile label="Storage overdue" value={a.operations.storageOverdue} />
          <StatTile label="Open exceptions" value={a.operations.openExceptions} tone="alert" />
        </div>
      </Section>
      <div className="grid gap-5 xl:grid-cols-2">
        <Section title="🤖 Support & AI">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label="AI resolution rate" value={`${a.support.aiResolutionRate}%`} sub={`${a.support.conversations} conversations`} tone="good" />
            <StatTile label="Human escalation" value={`${a.support.escalationRate}%`} />
            <StatTile label="Avg resolution" value={`${a.support.avgResolutionHours}h`} />
            <StatTile label="Open tickets" value={a.support.openTickets} />
          </div>
        </Section>
        <Section title="Most common questions">
          <BarList title="What customers ask the assistant (web + WhatsApp)" data={a.support.commonQuestions.map(([k, n]) => ({ label: INTENT[k] ?? k, value: n }))} />
        </Section>
      </div>
    </OpsPage>
  );
}
