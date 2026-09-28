"use client";

import Link from "next/link";
import { CustomerView } from "@/components/customer/CustomerView";
import { ShipmentPill } from "@/components/domain/Status";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { fmtDate } from "@/components/ui/Time";
import * as svc from "@/services";

export default function ShipmentsPage() {
  return (
    <CustomerView title="My Shipments">
      {(me) => {
        const list = svc.listShipments({ customerId: me.id });
        return (
          <div className="space-y-6">
            <header>
              <h1 className="text-4xl font-black tracking-tight sm:text-5xl">My Shipments</h1>
              <p className="mt-1 text-xl text-ink-soft">Packages traveling together to The Bahamas.</p>
            </header>
            {!list.length ? (
              <EmptyState icon="🚢" title="No shipments yet" action={<ButtonLink href="/packages/together">Send my packages</ButtonLink>}>When you send packages from our warehouse, they travel as a shipment.</EmptyState>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {list.map((s) => {
                  const pk = svc.shipmentPackages(s);
                  return (
                    <li key={s.id}>
                      <Link href={`/shipments/${s.id}`} className="block rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-sand-200/70 hover:-translate-y-0.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono font-bold">{s.id}</span>
                          <ShipmentPill status={s.status} />
                        </div>
                        <p className="mt-3 text-xl font-extrabold">{pk.map((p) => p.merchant).join(" + ")}</p>
                        <p className="text-ink-soft">{pk.length} package{pk.length > 1 ? "s" : ""} · {s.service === "air" ? "✈️ Air" : "🚢 Ocean"} · {svc.getDestination(s.destinationId).name} · {fmtDate(s.createdAt)}</p>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      }}
    </CustomerView>
  );
}
