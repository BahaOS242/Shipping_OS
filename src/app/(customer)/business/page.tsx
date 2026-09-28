import type { Metadata } from "next";
import { BusinessCard } from "@/components/business/BusinessCard";
import { BusinessContact } from "@/components/business/BusinessContact";
import { DemoBadge } from "@/components/ui/DemoBadge";

export const metadata: Metadata = { title: "The Link for Business" };

const SERVICES = [
  { icon: "🏭", title: "Supplier shipments", text: "Your suppliers ship to our Florida warehouse. We check every box in." },
  { icon: "📦", title: "Inventory", text: "We hold, count and combine your stock until you need it." },
  { icon: "🚢", title: "Commercial freight", text: "Pallets, bulk orders and big items by sea — handled end to end." },
  { icon: "🔁", title: "Recurring shipments", text: "Same order every week or month? Set it once, we repeat it." },
  { icon: "🚚", title: "Delivery", text: "From the dock to your shop door, across the islands." },
  { icon: "🧾", title: "One simple bill", text: "See every shipment, cost and invoice in one place." },
];

export default function BusinessPage() {
  return (
    <div className="space-y-12">
      <section className="-mx-4 overflow-hidden bg-ink px-4 py-12 text-white sm:mx-0 sm:rounded-[2rem] sm:px-10 sm:py-16">
        <DemoBadge>The Link for Business</DemoBadge>
        <h1 className="mt-4 max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
          Your logistics team, <span className="text-sun-300">without hiring one.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-xl text-white/80">We can receive, consolidate and move the things your business needs.</p>
        <a
          href="#contact"
          className="mt-8 inline-flex min-h-16 items-center gap-2 rounded-2xl bg-sun-400 px-8 text-xl font-bold text-ink hover:bg-sun-300"
        >
          Talk to Business Logistics <span aria-hidden>→</span>
        </a>
      </section>

      <section aria-labelledby="what">
        <h2 id="what" className="text-3xl font-extrabold tracking-tight">
          What we handle for you
        </h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((s) => (
            <BusinessCard key={s.title} {...s} />
          ))}
        </div>
      </section>

      <section id="contact" className="scroll-mt-28 grid gap-6 rounded-[2rem] bg-sea-700 p-5 text-white sm:p-10 lg:grid-cols-2 lg:items-center">
        <div>
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">Tell us what you move.</h2>
          <p className="mt-3 text-xl text-sea-100">A business logistics specialist will call you back and build a plan with you.</p>
          <ul className="mt-6 space-y-2 text-lg">
            <li>✓ One contact for every shipment</li>
            <li>✓ Business pricing for regular volume</li>
            <li>✓ Help with customs paperwork</li>
          </ul>
        </div>
        <BusinessContact />
      </section>
    </div>
  );
}
