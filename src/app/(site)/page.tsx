import Link from "next/link";
import { ActionCard } from "@/components/home/ActionCard";
import { HowItWorks } from "@/components/home/HowItWorks";
import { YourPackagesPeek } from "@/components/marketing/YourPackagesPeek";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export default function HomePage() {
  return (
    <div className="space-y-16 sm:space-y-20">
      <section aria-labelledby="hero" className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-center">
        <div className="animate-rise">
          <p className="inline-flex items-center gap-2 rounded-full bg-sea-50 px-3 py-1 text-sm font-bold text-sea-800 ring-1 ring-sea-200">🇧🇸 Buy → Ship → Track → Receive</p>
          <h1 id="hero" className="mt-4 text-[2.7rem] font-black leading-[1.02] tracking-tight sm:text-6xl">
            Everything You Buy.
            <br />
            <span className="text-sea-600">Delivered to The Bahamas.</span>
          </h1>
          <p className="mt-4 max-w-xl text-lg text-ink-soft sm:text-xl">Your U.S. shipping address, package receiving, consolidation, freight and local delivery — all connected.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/us-address-bahamas" size="lg" icon="🏠">Get my U.S. address</ButtonLink>
            <ButtonLink href="/shipping-calculator" size="lg" variant="secondary" icon="💰">See prices</ButtonLink>
          </div>
        </div>
        <YourPackagesPeek />
      </section>

      <section aria-labelledby="choose">
        <h2 id="choose" className="text-3xl font-black tracking-tight sm:text-4xl">What are you trying to do?</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ActionCard href="/packages" icon="📦" title="I bought something" quote="Show me where my package is." cta="See My Packages" accent="sea" />
          <ActionCard href="/ship" icon="🚚" title="I want to ship something" quote="I need to send something to The Bahamas." cta="Start Shipping" accent="sun" />
          <ActionCard href="/shipping-calculator" icon="💰" title="I want to know the cost" quote="Tell me how much it will cost." cta="Calculate Cost" accent="ink" />
          <ActionCard href="/help" icon="💬" title="I need help" quote="I'm not sure what to do." cta="Ask The Link" accent="coral" />
        </div>
      </section>

      <HowItWorks />

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { icon: "🧾", t: "We read your receipts", d: "Upload a receipt and we match it to your package automatically — so customs paperwork is ready." },
          { icon: "📦➕📦", t: "Put packages together", d: "Buying from different stores? We combine them into one shipment. It's usually cheaper." },
          { icon: "💬", t: "Updates on WhatsApp", d: "“We have it!”, “On the way”, “Out for delivery” — right where you already chat." },
        ].map((f) => (
          <Card key={f.t} className="p-6">
            <p aria-hidden className="text-3xl">{f.icon}</p>
            <h3 className="mt-3 text-xl font-extrabold">{f.t}</h3>
            <p className="mt-1 text-lg text-ink-soft">{f.d}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <Card className="flex flex-col p-6 sm:p-8">
          <span aria-hidden className="text-4xl">💬</span>
          <h2 className="mt-3 text-2xl font-extrabold">Confused? Just ask.</h2>
          <p className="mt-1 text-lg text-ink-soft">Ask Link Assistant or message us on WhatsApp. A real person is always one tap away.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 md:mt-auto md:pt-6">
            <ButtonLink href="/assistant" icon="🤖">Ask The Link</ButtonLink>
            <ButtonLink href="/whatsapp-demo" variant="whatsapp" icon="💬">WhatsApp</ButtonLink>
          </div>
        </Card>
        <Link href="/business" className="group flex flex-col rounded-[var(--radius-card)] bg-ink p-6 text-white shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 sm:p-8">
          <span aria-hidden className="text-4xl">🏢</span>
          <p className="mt-3 text-sm font-bold uppercase tracking-wider text-sun-300">Are you a business?</p>
          <h2 className="mt-1 text-2xl font-extrabold">Your logistics team, without hiring one.</h2>
          <p className="mt-1 text-lg text-white/75">Supplier shipments, inventory, commercial freight — even buying it for you.</p>
          <span className="mt-6 inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white/10 px-5 text-lg font-bold ring-1 ring-white/20 group-hover:bg-white/15 md:mt-auto">The Link for Business →</span>
        </Link>
      </section>
    </div>
  );
}
