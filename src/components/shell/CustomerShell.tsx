"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLive } from "@/data/useLive";
import * as svc from "@/services";
import { Logo, LogoMark } from "../ui/Logo";
import { DemoBar } from "./DemoBar";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/packages", label: "My Packages" },
  { href: "/ship", label: "Ship Something" },
  { href: "/shipping-calculator", label: "Shipping Cost" },
  { href: "/locations", label: "Locations" },
  { href: "/help", label: "Help" },
];

const BOTTOM = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/packages", label: "Packages", icon: "📦" },
  { href: "/ship", label: "Ship", icon: "➕", primary: true },
  { href: "/help", label: "Help", icon: "💬" },
];

export const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

export function CustomerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const live = useLive();
  const session = live ? svc.getSession() : undefined;
  const me = session?.role === "customer" ? svc.findCustomer(session.customerId) : undefined;
  const unread = me ? svc.listNotifications({ customerId: me.id }).filter((n) => !n.read).length : 0;

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:bg-white focus:p-3">Skip to content</a>
      <DemoBar />
      <header className="sticky top-0 z-30 border-b border-sand-200/70 bg-sand-50/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:h-[72px] sm:px-6">
          <Logo />
          <nav aria-label="Main" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {NAV.map((n) => {
                const a = isActive(pathname, n.href);
                return (
                  <li key={n.href}>
                    <Link href={n.href} aria-current={a ? "page" : undefined} className={`rounded-xl px-3 py-2.5 text-[15px] font-semibold ${a ? "bg-sea-50 text-sea-700" : "text-ink-soft hover:bg-sand-100 hover:text-ink"}`}>
                      {n.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="flex items-center gap-2">
            {me && (
              <Link href="/notifications" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative grid h-11 w-11 place-items-center rounded-full bg-white text-lg ring-1 ring-sand-200 hover:ring-sea-400">
                🔔
                {unread > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-coral-500 px-1 text-[11px] font-black text-white">{unread}</span>}
              </Link>
            )}
            <Link href={me ? "/dashboard" : "/admin"} className="flex min-h-11 items-center gap-2 rounded-full bg-white py-1.5 pl-1.5 pr-4 font-bold ring-1 ring-sand-200 hover:ring-sea-400">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-sun-400 text-sm font-extrabold" aria-hidden>{me ? me.firstName[0] : "★"}</span>
              {me ? "My Link" : "Staff"}
            </Link>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pt-10 lg:pb-14">{children}</main>
      <footer className="border-t border-sand-200 bg-sand-100/60 pb-24 lg:pb-0">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5"><LogoMark className="h-8 w-8" /><span className="text-lg font-extrabold">THE LINK</span></div>
            <p className="mt-3 text-ink-soft">From checkout to your doorstep. We handle the rest.</p>
            <p className="mt-3 text-sm text-ink-mute">Product demo with fictional data. Prices, tracking and addresses are simulated.</p>
          </div>
          {[
            { h: "Ship with us", l: [["How it works", "/how-it-works"], ["Your U.S. address", "/us-address-bahamas"], ["Shipping to The Bahamas", "/shipping-to-bahamas"], ["Put packages together", "/package-consolidation-bahamas"], ["Shipping calculator", "/shipping-calculator"]] },
            { h: "Services", l: [["Air freight", "/air-freight-bahamas"], ["Ocean freight", "/ocean-freight-bahamas"], ["Amazon to The Bahamas", "/amazon-bahamas"], ["Family Islands", "/shipping-to-family-islands"], ["Business logistics", "/business"]] },
            { h: "Help & demo", l: [["Locations", "/locations"], ["Help", "/help"], ["Link Assistant", "/assistant"], ["WhatsApp demo", "/whatsapp-demo"], ["Staff operations (demo)", "/admin"]] },
          ].map((c) => (
            <div key={c.h}>
              <h2 className="font-bold">{c.h}</h2>
              <ul className="mt-3 space-y-2 text-ink-soft">
                {c.l.map(([t, h]) => (
                  <li key={h}><Link className="hover:text-sea-700" href={h}>{t}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </footer>
      <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-sand-200 bg-white/95 backdrop-blur lg:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {BOTTOM.map((i) => {
            const a = isActive(pathname, i.href);
            return (
              <li key={i.href}>
                <Link href={i.href} aria-current={a ? "page" : undefined} className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-[13px] font-bold ${a ? "text-sea-700" : "text-ink-mute"}`}>
                  <span aria-hidden className={`grid h-8 w-12 place-items-center rounded-full text-xl ${i.primary ? "bg-sun-400" : a ? "bg-sea-50" : ""}`}>{i.icon}</span>
                  {i.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
