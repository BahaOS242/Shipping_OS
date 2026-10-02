"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLive } from "@/data/useLive";
import { MODULES, type ModuleId } from "@/platform/modules";
import { CUSTOMER_NAV, customerPathMissing } from "@/platform/navigation";
import * as svc from "@/services";
import { Logo, LogoMark } from "../ui/Logo";
import { DemoBar } from "./DemoBar";

const BOTTOM: { href: string; label: string; icon: string; primary?: boolean; requires: ModuleId[] }[] = [
  { href: "/", label: "Home", icon: "🏠", requires: [] },
  { href: "/packages", label: "Packages", icon: "📦", requires: ["customer_portal", "shipments"] },
  { href: "/ship", label: "Ship", icon: "➕", primary: true, requires: ["customer_portal", "warehouse"] },
  { href: "/book", label: "Book", icon: "🎟️", primary: true, requires: ["customer_portal", "booking"] },
  { href: "/help", label: "Help", icon: "💬", requires: [] },
];

export const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

export function CustomerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const live = useLive();
  const session = live ? svc.getSession() : undefined;
  const me = session?.role === "customer" ? svc.findCustomer(session.customerId) : undefined;
  const unread = me ? svc.listNotifications({ customerId: me.id }).filter((n) => !n.read).length : 0;
  // Customer portal is configured by the organization's modules (public pages stay public).
  const modules = live ? svc.enabledModules() : undefined;
  const has = (req: ModuleId[]) => !modules || req.every((m) => modules.includes(m));
  const NAV = CUSTOMER_NAV.filter((n) => has(n.requires));
  const bottom = BOTTOM.filter((b) => has(b.requires)).slice(0, 4);
  const missing = modules ? customerPathMissing(pathname, modules) : [];
  const brand = live ? svc.currentOrganization().branding : undefined;

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[70] focus:rounded-xl focus:bg-white focus:p-3">Skip to content</a>
      <DemoBar />
      <header className="sticky top-0 z-30 border-b border-sand-200/70 bg-sand-50/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:h-[72px] sm:px-6">
          <Logo text={brand?.logoText} color={brand?.primaryColor} />
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
              {me ? "My Shipping" : "Staff"}
            </Link>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 sm:pt-10 lg:pb-14">
        {missing.length ? (
          <div className="mx-auto max-w-lg rounded-3xl bg-white p-8 text-center ring-1 ring-sand-200">
            <p className="text-5xl" aria-hidden>🧩</p>
            <h1 className="mt-3 text-2xl font-black">Not available here</h1>
            <p className="mt-2 text-ink-soft">{svc.currentOrganization().name} doesn&apos;t offer {missing.map((m) => MODULES[m].label).join(" or ")} online.</p>
            <Link href="/" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-ink px-4 font-bold text-white">Back to home</Link>
          </div>
        ) : (
          children
        )}
      </main>
      <footer className="border-t border-sand-200 bg-sand-100/60 pb-24 lg:pb-0">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-4">
          <div className="md:col-span-1">
            <div className="flex items-center gap-2.5"><LogoMark className="h-8 w-8" color={brand?.primaryColor} /><span className="text-lg font-extrabold">{(brand?.logoText ?? "Shipping OS").toUpperCase()}</span></div>
            <p className="mt-3 text-ink-soft">{brand?.tagline ?? "From checkout to your doorstep."} We handle the rest.</p>
            <p className="mt-3 text-sm text-ink-mute">Product demo with fictional data. Prices, tracking and addresses are simulated.</p>
          </div>
          {[
            { h: "Ship with us", l: [["How it works", "/how-it-works"], ["Your U.S. address", "/us-address-bahamas"], ["Shipping to The Bahamas", "/shipping-to-bahamas"], ["Put packages together", "/package-consolidation-bahamas"], ["Shipping calculator", "/shipping-calculator"]] },
            { h: "Services", l: [["Air freight", "/air-freight-bahamas"], ["Ocean freight", "/ocean-freight-bahamas"], ["Amazon to The Bahamas", "/amazon-bahamas"], ["Family Islands", "/shipping-to-family-islands"], ["Business logistics", "/business"]] },
            { h: "Help & demo", l: [["Locations", "/locations"], ["Help", "/help"], ["Shipping OS Assistant", "/assistant"], ["WhatsApp demo", "/whatsapp-demo"], ["Staff operations (demo)", "/admin"], ["Shipping OS for logistics companies", "/demo"]] },
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
          {bottom.map((i) => {
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
