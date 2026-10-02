"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useLive } from "@/data/useLive";
import { ROLE_INFO } from "@/domain/roles";
import type { Role } from "@/domain/types";
import { BUSINESS_TYPES } from "@/platform/businessTypes";
import * as svc from "@/services";

const STAFF_ROLES: Role[] = ["owner", "admin", "manager", "dispatcher", "warehouse", "customs", "accounting", "support", "driver"];
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
  const org = live ? svc.currentOrganization() : undefined;
  // Personas and roles come from the signed-in organization's own customers and members.
  const customers = live ? svc.listCustomers() : [];
  const personas = (customers.some((c) => PERSONAS.includes(c.id)) ? PERSONAS.map((id) => customers.find((c) => c.id === id)!).filter(Boolean) : customers.slice(0, 4));
  const roles = live ? STAFF_ROLES.filter((r) => svc.listMembers().some((u) => u.role === r && u.status !== "invited")) : [];
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
            Viewing as: <span className="text-white">{session ? ROLE_INFO[session.role].icon : ""} {who}</span>{org && <span className="hidden text-white/70 sm:inline"> @ {org.name}</span>} ▾
          </button>
          {open && session && (
            <div role="menu" className="absolute right-0 top-full mt-1 max-h-[80dvh] w-80 overflow-y-auto rounded-2xl bg-white text-ink shadow-[var(--shadow-lift)] ring-1 ring-[#e3e7ec]">
              <p className="px-4 pt-3 text-[11px] font-bold uppercase tracking-wider text-ink-mute">Organization</p>
              {svc.listOrganizations().map((o) => (
                <button key={o.id} role="menuitem" onClick={() => { svc.switchOrganization(o.id); setOpen(false); router.push(ROLE_INFO[svc.getSession().role].home); }} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-sand-100">
                  <span className="flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: o.branding.primaryColor }} />{o.name} <span className="text-ink-mute">· {BUSINESS_TYPES[o.businessType].label}</span></span>
                  {session.organizationId === o.id && <span aria-label="current">✓</span>}
                </button>
              ))}
              <button role="menuitem" onClick={() => { setOpen(false); router.push("/onboarding"); }} className="w-full px-4 py-2 text-left text-sm font-semibold text-sea-700 hover:bg-sand-100">＋ Set up a new organization</button>
              <p className="border-t border-[#eef1f4] px-4 pt-3 text-[11px] font-bold uppercase tracking-wider text-ink-mute">Customers</p>
              {personas.map((c) => (
                <button key={c.id} role="menuitem" onClick={() => { svc.switchCustomer(c.id); setOpen(false); router.push("/dashboard"); }} className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-sand-100">
                  <span>{c.type === "business" ? "🏢" : "🙂"} {svc.customerName(c)}</span>
                  {session.role === "customer" && session.customerId === c.id && <span aria-label="current">✓</span>}
                </button>
              ))}
              <p className="border-t border-[#eef1f4] px-4 pt-3 text-[11px] font-bold uppercase tracking-wider text-ink-mute">Staff (mock sign-in)</p>
              {roles.map((r) => (
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
