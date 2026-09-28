"use client";

import type { Actor, Customer } from "@/domain/types";
import * as svc from "@/services";
import { Live } from "../ui/Live";

/** Customer pages: live data for the signed-in (demo) customer. */
export function CustomerView({ title, children }: { title: string; children: (me: Customer, actor: Actor) => React.ReactNode }) {
  return (
    <>
      <title>{`${title} · The Link`}</title>
      <Live>
        {() => {
          const s = svc.getSession();
          const me = svc.getCustomer(s.customerId);
          return (
            <>
              {s.role !== "customer" && (
                <p className="mb-5 rounded-2xl bg-sun-50 px-4 py-3 text-sm font-semibold text-sun-700 ring-1 ring-sun-300">
                  👀 Staff preview: you're seeing {svc.customerName(me)}&apos;s screens. Actions run with your staff permissions.
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
