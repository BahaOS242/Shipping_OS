"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLive } from "@/data/useLive";
import { OPS_NAV, ROLE_INFO, canSeeOpsPath } from "@/domain/roles";
import type { Role, Team } from "@/domain/types";
import * as svc from "@/services";
import { Ago } from "../ui/Time";
import { Logo } from "../ui/Logo";
import { DemoBar } from "./DemoBar";

const QUEUE_FOR: Record<string, keyof ReturnType<typeof svc.workQueues>> = {
  "/warehouse": "warehouse",
  "/customs": "customs",
  "/accounting": "accounting",
  "/support": "support",
  "/delivery": "delivery",
};

const TEAM_OF: Partial<Record<Role, Team | "all">> = { warehouse: "warehouse", customs: "customs", accounting: "accounting", support: "support", manager: "all", admin: "all" };

export function OpsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const live = useLive();
  const [menu, setMenu] = useState(false);
  const [bell, setBell] = useState(false);
  const [q, setQ] = useState("");
  const bellRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => bellRef.current && !bellRef.current.contains(e.target as Node) && setBell(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const role = live ? svc.getSession().role : undefined;
  const queues = live ? svc.workQueues() : undefined;
  const nav = role ? OPS_NAV.filter((n) => n.roles.includes(role)) : [];
  const team = role ? TEAM_OF[role] : undefined;
  const notes = live && team ? svc.listNotifications({ team, limit: 12 }) : [];
  const unread = notes.filter((n) => !n.read).length;

  const nav_ = (
    <ul className="space-y-0.5">
      {nav.map((n) => {
        const a = pathname === n.href || pathname.startsWith(n.href + "/");
        const count = queues && QUEUE_FOR[n.href] ? queues[QUEUE_FOR[n.href]] : n.href === "/exceptions" ? svc.listExceptions({ status: "active" }).length : undefined;
        return (
          <li key={n.href}>
            <Link href={n.href} onClick={() => setMenu(false)} aria-current={a ? "page" : undefined} className={`flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 text-[15px] font-semibold ${a ? "bg-ink text-white" : "text-ink-soft hover:bg-white"}`}>
              <span><span aria-hidden className="mr-2">{n.icon}</span>{n.label}</span>
              {!!count && <span className={`rounded-full px-2 text-xs font-black ${a ? "bg-white/20" : "bg-coral-50 text-coral-700"}`}>{count}</span>}
            </Link>
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="min-h-dvh bg-[#f4f6f8]">
      <DemoBar />
      <header className="sticky top-0 z-30 border-b border-[#e3e7ec] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6">
          <button className="grid h-11 w-11 place-items-center rounded-xl text-xl ring-1 ring-[#e3e7ec] lg:hidden" onClick={() => setMenu((m) => !m)} aria-label="Menu" aria-expanded={menu}>☰</button>
          <div className="hidden sm:block"><Logo href={role ? ROLE_INFO[role].home : "/admin"} suffix="Operations" /></div>
          <form
            role="search"
            className="ml-auto flex max-w-md flex-1 items-center"
            onSubmit={(e) => {
              e.preventDefault();
              if (q.trim()) router.push(`/admin/search?q=${encodeURIComponent(q.trim())}`);
            }}
          >
            <label htmlFor="global-search" className="sr-only">Search everything</label>
            <input id="global-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customer, TL-PKG-…, TL-SHP-…, invoice, order, tracking" className="min-h-11 w-full rounded-xl bg-[#f4f6f8] px-3 text-sm ring-1 ring-[#e3e7ec] focus:outline-none focus:ring-2 focus:ring-sea-500" />
          </form>
          <div ref={bellRef} className="relative">
            <button onClick={() => setBell((b) => !b)} aria-label={`Team notifications${unread ? `, ${unread} unread` : ""}`} className="relative grid h-11 w-11 place-items-center rounded-xl text-lg ring-1 ring-[#e3e7ec]">
              🔔{unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-coral-500 px-1 text-[11px] font-black text-white">{unread}</span>}
            </button>
            {bell && (
              <div className="absolute right-0 top-full mt-2 w-80 overflow-hidden rounded-2xl bg-white shadow-[var(--shadow-lift)] ring-1 ring-[#e3e7ec]">
                <div className="flex items-center justify-between border-b border-[#eef1f4] px-4 py-2.5">
                  <p className="font-extrabold">Team alerts</p>
                  <button className="text-sm font-semibold text-sea-700" onClick={() => svc.markRead(notes.map((n) => n.id))}>Mark all read</button>
                </div>
                <ul className="max-h-96 divide-y divide-[#eef1f4] overflow-y-auto">
                  {notes.length === 0 && <li className="px-4 py-6 text-center text-ink-mute">Nothing new.</li>}
                  {notes.map((n) => (
                    <li key={n.id}>
                      <Link href={n.href ?? "/exceptions"} onClick={() => { svc.markRead([n.id]); setBell(false); }} className={`block px-4 py-2.5 text-sm hover:bg-[#f7f9fa] ${n.read ? "" : "bg-sea-50/50"}`}>
                        <p className="font-bold">{n.icon} {n.title}</p>
                        <p className="line-clamp-2 text-ink-soft">{n.body}</p>
                        <p className="text-xs text-ink-mute"><Ago iso={n.at} /></p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-16 hidden h-[calc(100dvh-4rem)] w-60 shrink-0 overflow-y-auto border-r border-[#e3e7ec] px-3 py-5 lg:block">
          {role && <p className="mb-3 px-3 text-xs font-bold uppercase tracking-wider text-ink-mute">{ROLE_INFO[role].icon} {ROLE_INFO[role].label}</p>}
          {nav_}
          <Link href="/" className="mt-6 block rounded-xl px-3 py-2 text-sm font-semibold text-sea-700 hover:bg-white">↗ Customer website</Link>
        </aside>
        {menu && (
          <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setMenu(false)}>
            <div className="absolute inset-0 bg-ink/40" />
            <nav aria-label="Operations" className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-[#f4f6f8] p-4" onClick={(e) => e.stopPropagation()}>
              <Logo href={role ? ROLE_INFO[role].home : "/admin"} suffix="Ops" />
              <div className="mt-5">{nav_}</div>
              <Link href="/" className="mt-6 block px-3 text-sm font-semibold text-sea-700">↗ Customer website</Link>
            </nav>
          </div>
        )}
        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {!live ? null : role === "customer" ? (
            <AccessNote title="This is Shipping OS's staff area" body="In the demo, switch to a staff role to see how the team works." roles={["manager", "warehouse", "customs", "accounting", "support"]} />
          ) : role && !canSeeOpsPath(role, pathname) ? (
            <AccessNote title={`${ROLE_INFO[role].label} can't open this area`} body="Each team gets its own work queue. Switch role to see this screen." roles={OPS_NAV.find((n) => pathname.startsWith(n.href))?.roles.filter((r) => r !== "admin") ?? ["manager"]} />
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

function AccessNote({ title, body, roles }: { title: string; body: string; roles: Role[] }) {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <div className="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center ring-1 ring-[#e3e7ec]">
      <p className="text-5xl" aria-hidden>🔒</p>
      <h1 className="mt-3 text-2xl font-black">{title}</h1>
      <p className="mt-2 text-ink-soft">{body}</p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {roles.map((r) => (
          <button key={r} onClick={() => { svc.switchRole(r); router.replace(pathname); }} className="min-h-11 rounded-xl bg-ink px-4 font-bold text-white">
            View as {ROLE_INFO[r].label}
          </button>
        ))}
      </div>
    </div>
  );
}
