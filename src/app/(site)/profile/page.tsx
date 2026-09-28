"use client";

import Link from "next/link";
import { ShoppingAddressCard } from "@/components/account/ShoppingAddressCard";
import { CustomerView } from "@/components/customer/CustomerView";
import { Card } from "@/components/ui/Card";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { fmtDate } from "@/components/ui/Time";
import * as svc from "@/services";

export default function ProfilePage() {
  return (
    <CustomerView title="My profile">
      {(me) => {
        const loc = svc.getLocation(me.preferredPickupLocationId);
        const dest = svc.getDestination(me.homeDestination);
        return (
          <div className="space-y-6">
            <header>
              <DemoBadge>Demo account</DemoBadge>
              <h1 className="mt-2 text-4xl font-black tracking-tight">{svc.customerName(me)}</h1>
              <p className="text-lg text-ink-soft">Account {me.accountNumber} · {me.type === "business" ? "Business" : "Personal"} · member since {fmtDate(me.createdAt, { month: "long", year: "numeric" })}</p>
            </header>
            <div className="grid gap-5 lg:grid-cols-2">
              <ShoppingAddressCard address={svc.shoppingAddress(me)} />
              <div className="space-y-5">
                <Card className="p-6">
                  <h2 className="text-xl font-extrabold">How you get your packages</h2>
                  <dl className="mt-3 space-y-3 text-lg">
                    <div><dt className="text-sm font-bold text-ink-mute">Island</dt><dd className="font-semibold">🇧🇸 {dest.name}</dd></div>
                    <div><dt className="text-sm font-bold text-ink-mute">Usually</dt><dd className="font-semibold">{me.deliveryPreference === "pickup" ? `📍 Pick up at ${loc?.name}` : `🚚 Home delivery to ${me.deliveryAddress}`}</dd></div>
                    <div><dt className="text-sm font-bold text-ink-mute">Usually ships by</dt><dd className="font-semibold">{me.preferredService === "air" ? "✈️ Air (faster)" : "🚢 Ocean (bigger / slower)"}</dd></div>
                  </dl>
                </Card>
                <Card className="p-6">
                  <h2 className="text-xl font-extrabold">Contact</h2>
                  <p className="mt-2 text-lg">📱 {me.phone.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, "($1) $2-$3")} (WhatsApp updates)</p>
                  <p className="text-lg">✉️ {me.email}</p>
                  <p className="mt-2 text-sm text-ink-mute">Demo: profile editing is disabled. Production verifies your WhatsApp number with a one-time code.</p>
                </Card>
                <div className="grid grid-cols-2 gap-3">
                  {[["/payments", "💳 Payments"], ["/invoices", "🧾 Receipts"], ["/claims", "🛟 Claims"], ["/support", "🎧 Help requests"]].map(([h, l]) => <Link key={h} href={h} className="rounded-2xl bg-white p-4 text-center font-bold ring-1 ring-sand-200 hover:ring-sea-400">{l}</Link>)}
                </div>
              </div>
            </div>
          </div>
        );
      }}
    </CustomerView>
  );
}
