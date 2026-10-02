import type { Metadata } from "next";
import Link from "next/link";
import { BusinessCard } from "@/components/business/BusinessCard";
import { BusinessContact, OpenBusinessDemo } from "@/components/marketing/BusinessActions";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Shipping OS for Business", description: "Supplier shipments, inventory, commercial freight, procurement, recurring shipments, delivery and reporting for Bahamian businesses." };

const SERVICES = [
  { icon: "🏭", title: "Supplier shipments", text: "Your suppliers ship to our Florida warehouse. Every box checked in and matched to its invoice." },
  { icon: "📦", title: "Inventory", text: "We hold, count and combine your stock until you need it." },
  { icon: "🚢", title: "Commercial freight", text: "Pallets, bulk and big equipment by sea — or air when it's urgent." },
  { icon: "🛒", title: "Procurement", text: "Tell us what you need. We find it, buy it, ship it and show the full landed cost." },
  { icon: "🔁", title: "Recurring shipments", text: "Same restock every week or month? Set it once." },
  { icon: "🚚", title: "Delivery", text: "Truck delivery to your door in Nassau; partners on the islands." },
  { icon: "📊", title: "Reporting", text: "Spend, shipments and statements in one dashboard." },
];

export default function BusinessPage() {
  return (
    <div className="space-y-12">
      <section className="-mx-4 bg-ink px-4 py-12 text-white sm:mx-0 sm:rounded-[2rem] sm:px-10 sm:py-16">
        <p className="text-sm font-bold uppercase tracking-wider text-sun-300">Shipping OS for Business</p>
        <h1 className="mt-3 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">Your logistics team, <span className="text-sun-300">without hiring one.</span></h1>
        <p className="mt-4 max-w-2xl text-xl text-white/80">We can receive, consolidate and move the things your business needs — and buy them for you.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="#contact" variant="gold" size="lg">Talk to Business Logistics →</ButtonLink>
          <OpenBusinessDemo />
        </div>
      </section>
      <section aria-labelledby="svc">
        <h2 id="svc" className="text-3xl font-extrabold tracking-tight">What we handle for you</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{SERVICES.map((s) => <BusinessCard key={s.title} {...s} />)}</div>
      </section>
      <section className="grid gap-5 md:grid-cols-3">
        {[
          ["1", "Connect suppliers", "Give suppliers your business Shipping OS address. Invoices are read and matched automatically."],
          ["2", "We run the chain", "Receiving, consolidation, customs packets, freight and delivery — with exceptions handled by people."],
          ["3", "You see everything", "Open shipments, cargo in transit, balance and statements in one place."],
        ].map(([n, t, d]) => (
          <div key={n} className="rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-sand-200"><span className="grid h-10 w-10 place-items-center rounded-full bg-sea-600 font-black text-white">{n}</span><p className="mt-3 text-xl font-extrabold">{t}</p><p className="text-ink-soft">{d}</p></div>
        ))}
      </section>
      <section id="contact" className="scroll-mt-28 grid gap-6 rounded-[2rem] bg-sea-700 p-5 text-white sm:p-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Tell us what you move.</h2>
          <p className="mt-3 text-xl text-sea-100">A business logistics specialist will call you back and build a plan with you.</p>
          <ul className="mt-6 space-y-2 text-lg"><li>✓ One contact for every shipment</li><li>✓ 30-day terms and volume pricing (demo)</li><li>✓ Help with customs paperwork</li></ul>
          <p className="mt-6"><Link href="/business-logistics-bahamas" className="font-bold text-sun-300 underline">Read more about business logistics →</Link></p>
        </div>
        <BusinessContact />
      </section>
    </div>
  );
}
