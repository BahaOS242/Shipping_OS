"use client";

import type { Actor, Customer } from "@/domain/types";
import * as svc from "@/services";
import { Live } from "../ui/Live";

/** Customer pages: live data for the signed-in (demo) customer. */
export function CustomerView({ title, children }: { title: string; children: (me: Customer, actor: Actor) => React.ReactNode }) {
  return (
    <>
      <title>{`${title} · Shipping OS`}</title>
      <Live>
        {() => {
          const s = svc.getSession();
          const me = svc.findCustomer(s.customerId);
          if (!me) return <p className="rounded-2xl bg-white p-6 text-ink-soft ring-1 ring-sand-200">{svc.currentOrganization().name} has no customer accounts yet. Add one under Customers, or switch customer in the demo bar.</p>;
          return (
            <>
              {s.role !== "customer" && (
                <p className="mb-5 rounded-2xl bg-sun-50 px-4 py-3 text-sm font-semibold text-sun-700 ring-1 ring-sun-300">
                  👀 Staff preview: you&apos;re seeing {svc.customerName(me)}&apos;s screens. Actions run with your staff permissions.
                </p>
              )}
              {children(me, svc.currentActor())}
            </>
          );
        }}
      </Live>
    </>
  );
}
