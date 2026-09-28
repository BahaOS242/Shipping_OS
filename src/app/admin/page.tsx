export const dynamic = "force-dynamic";

import Link from "next/link";
import { ConversationsPanel } from "@/components/admin/ConversationsPanel";
import { StatTile } from "@/components/admin/StatTile";
import { StatusBadge } from "@/components/packages/StatusBadge";
import { staff } from "@/lib/api/link-api";
import { ISLANDS, fmtLbs } from "@/lib/pricing";

export default async function AdminDashboard() {
  const [ops, packages, tickets, customers] = await Promise.all([
    staff.operationsSummary(),
    staff.listPackages(),
    staff.listTickets(),
    staff.listCustomers(),
  ]);
  const attention = packages.filter((p) => p.needsAttention);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-wider text-ink-mute">Good morning, Shanice</p>
        <h1 className="text-3xl font-black tracking-tight">Today&apos;s Operations</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="📥" label="Packages received" value={ops.packagesReceivedToday} />
        <StatTile icon="🏷️" label="Ready for shipment" value={ops.readyForShipment} />
        <StatTile icon="✈️" label="In transit" value={ops.inTransit} />
        <StatTile icon="⚑" label="Needs attention" value={ops.needsAttention} tone="alert" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="min-w-0 space-y-6">
          {/* Needs attention */}
          <section className="rounded-2xl bg-white ring-1 ring-[#e3e7ec]">
            <h2 className="border-b border-[#e3e7ec] px-5 py-4 text-lg font-extrabold">⚑ Needs attention</h2>
            <ul className="divide-y divide-[#eef1f4]">
              {attention.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/packages/${p.id}`} className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-[#f7f9fa]">
                    <span className="min-w-0">
                      <span className="block font-bold">
                        {p.customer.firstName} {p.customer.lastName} · {p.merchant}
                      </span>
                      <span className="block truncate text-coral-700">{p.needsAttention}</span>
                    </span>
                    <span className="shrink-0 font-bold text-sea-700">Open →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* Recent packages */}
          <section className="rounded-2xl bg-white ring-1 ring-[#e3e7ec]">
            <h2 className="border-b border-[#e3e7ec] px-5 py-4 text-lg font-extrabold">Recent Packages</h2>
            {/* Table on desktop */}
            <table className="hidden w-full text-left md:table">
              <thead className="text-sm text-ink-mute">
                <tr>
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-3 py-3 font-semibold">Package</th>
                  <th className="px-3 py-3 font-semibold">Weight</th>
                  <th className="px-3 py-3 font-semibold">To</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#eef1f4]">
                {packages.map((p) => (
                  <tr key={p.id} className="relative hover:bg-[#f7f9fa]">
                    <td className="px-5 py-3 font-bold">
                      <Link href={`/admin/packages/${p.id}`} className="after:absolute after:inset-0">
                        {p.customer.firstName} {p.customer.lastName}
                      </Link>
                      <span className="block text-xs font-medium text-ink-mute">{p.customer.accountNumber}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="font-semibold">{p.merchant}</span>
                      <span className="block text-sm text-ink-soft">{p.itemName}</span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">{fmtLbs(p.weight)}</td>
                    <td className="px-3 py-3">{ISLANDS[p.destination].name}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-2">
                        <StatusBadge status={p.status} />
                        {p.needsAttention && <span title={p.needsAttention} className="text-coral-500">⚑</span>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Cards on mobile */}
            <ul className="divide-y divide-[#eef1f4] md:hidden">
              {packages.map((p) => (
                <li key={p.id}>
                  <Link href={`/admin/packages/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3.5">
                    <span className="min-w-0">
                      <span className="block font-bold">
                        {p.customer.firstName} · {p.merchant}
                      </span>
                      <span className="block truncate text-sm text-ink-soft">
                        {p.itemName} · {fmtLbs(p.weight)} · {ISLANDS[p.destination].name}
                      </span>
                    </span>
                    <StatusBadge status={p.status} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside className="min-w-0 space-y-6">
          <ConversationsPanel tickets={tickets} customers={customers} />
          <div className="rounded-2xl bg-ink p-5 text-white">
            <p className="font-extrabold">How staff fit in</p>
            <p className="mt-2 text-white/80">
              Link Assistant answers the easy questions. When a customer asks for a person — or the AI isn&apos;t sure — the chat lands here
              with the package attached. Staff reply straight into the customer&apos;s WhatsApp.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
