"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLive } from "@/data/useLive";
import { ROLE_INFO } from "@/domain/roles";
import type { Role } from "@/domain/types";
import * as svc from "@/services";

const STAFF_ROLES: Role[] = ["warehouse", "customs", "accounting", "support", "manager", "admin"];
const PERSONAS = ["cus_trevor", "cus_kendrick", "cus_alicia", "cus_sarah"];

/** DEMO MODE bar + mock-auth role switcher. */
export function DemoBar() {
  const live = useLive();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const session = live ? svc.getSession() : undefined;
  const who = !session
    ? "…"
    : session.role === "customer"
      ? svc.customerName(svc.findCustomer(session.customerId))
      : `${ROLE_INFO[session.role].label} · ${svc.currentActor().name}`;

  return (
    <div className="relative z-50 bg-ink text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1.5 text-[13px] sm:px-6">
        <p className="min-w-0">
          <span className="mr-1.5 rounded bg-sun-400 px-1.5 py-0.5 text-[11px] font-black tracking-wider text-ink">DEMO MODE</span>
          <span className="text-white/80">Simulated data — no real packages, payments, messages or customs decisions.</span>
        </p>
        <div ref={ref} className="relative">
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className="flex min-h-8 items-center gap-1.5 rounded-lg px-2 font-semibold text-sun-300 hover:bg-white/10">
            Viewing as: <span className="text-white">{session ? ROLE_INFO[session.role].icon : ""} {who}</span> ▾
          </button>
          {open && session && (
            <div role="menu" className="absolute right-0 top-full mt-1 w-72 overflow-hidden rounded-2xl bg-white text-ink shadow-[var(--shadow-lift)] ring-1 ring-[#e3e7ec]">
              <p className="px-4 pt-3 text-[11px] font-bold uppercase tracking-wider text-ink-mute">Customers</p>
              {PERSONAS.map((id) => {
                const c = svc.findCustomer(id)!;
                return (
                  <button key={id} role="menuitem" onClick={() => { svc.switchCustomer(id); setOpen(false); router.push("/dashboard"); }} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-sand-100">
                    <span>{c.type === "business" ? "🏢" : "🙂"} {svc.customerName(c)}</span>
                    {session.role === "customer" && session.customerId === id && <span aria-label="current">✓</span>}
                  </button>
                );
              })}
              <p className="border-t border-[#eef1f4] px-4 pt-3 text-[11px] font-bold uppercase tracking-wider text-ink-mute">Staff (mock sign-in)</p>
              {STAFF_ROLES.map((r) => (
                <button key={r} role="menuitem" onClick={() => { svc.switchRole(r); setOpen(false); router.push(ROLE_INFO[r].home); }} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-sand-100">
                  <span>{ROLE_INFO[r].icon} {ROLE_INFO[r].label} <span className="text-ink-mute">· {ROLE_INFO[r].blurb}</span></span>
                  {session.role === r && <span aria-label="current">✓</span>}
                </button>
              ))}
              <button
                role="menuitem"
                onClick={() => { if (confirm("Reset all demo data back to the start?")) { svc.resetDemoData(); setOpen(false); router.refresh(); } }}
                className="w-full border-t border-[#eef1f4] px-4 py-2.5 text-left text-sm font-semibold text-coral-700 hover:bg-coral-50"
              >
                ↺ Reset demo data
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
