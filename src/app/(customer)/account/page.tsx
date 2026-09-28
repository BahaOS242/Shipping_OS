import type { Metadata } from "next";
import { ShoppingAddressCard } from "@/components/account/ShoppingAddressCard";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCustomer, getInvoices, getLocation, getNotifications, getQuotes, getShoppingAddress } from "@/lib/api/link-api";
import { getSessionCustomerId } from "@/lib/auth";
import { ISLANDS, fmtLbs, fmtMoney } from "@/lib/pricing";

export const metadata: Metadata = { title: "My Link" };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export default async function AccountPage() {
  const id = await getSessionCustomerId();
  const [c, address, notifications, quotes, invoices] = await Promise.all([
    getCustomer(id),
    getShoppingAddress(id),
    getNotifications(id),
    getQuotes(id),
    getInvoices(id),
  ]);
  const pickup = await getLocation(c.preferredPickupLocationId);

  return (
    <>
      <PageHeader title={`Hi, ${c.firstName}!`} sub={`Account ${c.accountNumber} · ${ISLANDS[c.homeIsland].name}`} eyebrow={<DemoBadge>Demo account</DemoBadge>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <ShoppingAddressCard address={address} />

        <div className="space-y-5">
          <Card className="p-6">
            <h2 className="text-xl font-extrabold">How you get your packages</h2>
            <p className="mt-3 flex items-start gap-3 text-lg">
              <span aria-hidden className="text-2xl">📍</span>
              <span>
                <strong>Pick up at {pickup?.name}</strong>
                <br />
                <span className="text-ink-soft">{pickup?.hours}</span>
              </span>
            </p>
            <p className="mt-3 flex items-center gap-3 text-lg">
              <span aria-hidden className="text-2xl">🔔</span>
              <span>
                Updates by <strong>WhatsApp</strong> to {c.phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")}
              </span>
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-extrabold">Recent messages</h2>
            <ul className="mt-3 divide-y divide-sand-200">
              {notifications.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-4 py-3">
                  <span className="text-lg">{n.text}</span>
                  <span className="shrink-0 text-sm text-ink-mute">
                    {n.channel === "whatsapp" ? "WhatsApp" : "Email"} · {day(n.at)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="p-6">
          <h2 className="text-xl font-extrabold">Saved prices</h2>
          <ul className="mt-3 divide-y divide-sand-200">
            {quotes.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-4 py-3 text-lg">
                <span>
                  {fmtLbs(q.weight)} to {ISLANDS[q.destination].name} · {q.mode === "air" ? "✈️" : "🚢"}
                </span>
                <strong>{fmtMoney(q.total)}</strong>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-ink-mute">Demo estimates, not official prices.</p>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-extrabold">Bills</h2>
          <ul className="mt-3 divide-y divide-sand-200">
            {invoices.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-4 py-3 text-lg">
                <span>
                  {inv.id.toUpperCase()} · {day(inv.issuedAt)}
                </span>
                <span className="flex items-center gap-3">
                  <strong>{fmtMoney(inv.total)}</strong>
                  <span className={`rounded-full px-3 py-0.5 text-sm font-bold ${inv.status === "paid" ? "bg-emerald-50 text-emerald-800" : "bg-sun-50 text-sun-700"}`}>
                    {inv.status === "paid" ? "✓ Paid" : "To pay"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-ink-mute">Payments are not processed in this demo.</p>
        </Card>
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        <ButtonLink href="/packages" icon="📦">My Packages</ButtonLink>
        <ButtonLink href="/help" variant="secondary" icon="💬">Get Help</ButtonLink>
      </div>
    </>
  );
}
