"use client";

import Link from "next/link";
import { CustomerView } from "@/components/customer/CustomerView";
import { EmptyState } from "@/components/ui/EmptyState";
import { Ago } from "@/components/ui/Time";
import * as svc from "@/services";

const CH = { in_app: "App", whatsapp: "WhatsApp", email: "Email" } as const;

export default function NotificationsPage() {
  return (
    <CustomerView title="Notifications">
      {(me) => {
        const list = svc.listNotifications({ customerId: me.id });
        const unread = list.filter((n) => !n.read);
        return (
          <div className="mx-auto max-w-3xl space-y-5">
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div><h1 className="text-4xl font-black tracking-tight">Notifications</h1><p className="text-lg text-ink-soft">{unread.length ? `${unread.length} new` : "You're all caught up."}</p></div>
              {unread.length > 0 && <button onClick={() => svc.markRead(unread.map((n) => n.id))} className="min-h-11 rounded-xl px-4 font-bold ring-1 ring-sand-200">Mark all read</button>}
            </header>
            {!list.length ? <EmptyState icon="🔔" title="No notifications yet" /> : (
              <ul className="space-y-2">
                {list.map((n) => (
                  <li key={n.id}>
                    <Link href={n.href ?? "/dashboard"} onClick={() => svc.markRead([n.id])} className={`flex gap-4 rounded-2xl p-4 ring-1 ${n.read ? "bg-white ring-sand-200" : "bg-sea-50 ring-sea-200"}`}>
                      <span aria-hidden className="text-3xl">{n.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-extrabold">{n.title}{!n.read && <span className="ml-2 rounded-full bg-coral-500 px-2 text-xs text-white">New</span>}</span>
                        <span className="block text-ink-soft">{n.body}</span>
                        <span className="mt-1 block text-xs text-ink-mute"><Ago iso={n.at} /> · sent by {n.channels.map((c) => CH[c]).join(", ")} (simulated)</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      }}
    </CustomerView>
  );
}
