import Link from "next/link";
import { ShoppingAddressCard } from "@/components/account/ShoppingAddressCard";
import { ActionCard } from "@/components/home/ActionCard";
import { HowItWorks } from "@/components/home/HowItWorks";
import { MerchantMark } from "@/components/packages/MerchantMark";
import { StatusBadge } from "@/components/packages/StatusBadge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getCustomer, getPackages, getShoppingAddress } from "@/lib/api/link-api";
import { getSessionCustomerId } from "@/lib/auth";

export default async function HomePage() {
  const customerId = await getSessionCustomerId();
  const [customer, packages, address] = await Promise.all([
    getCustomer(customerId),
    getPackages(customerId),
    getShoppingAddress(customerId),
  ]);
  const active = packages.filter((p) => p.status !== "delivered");

  return (
    <div className="space-y-14 sm:space-y-20">
      {/* Hero */}
      <section aria-labelledby="hero">
        <div className="animate-rise">
          <p className="text-lg font-semibold text-sea-700">Hi {customer.firstName} 👋</p>
          <h1 id="hero" className="mt-1 text-[2.6rem] font-black leading-[1.05] tracking-tight text-ink sm:text-6xl">
            What are you trying to do?
          </h1>
          <p className="mt-3 max-w-2xl text-lg text-ink-soft sm:text-xl">
            Pick one. We&apos;ll show you exactly what to do next.
          </p>
        </div>

        <div className="mt-7 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
          <ActionCard href="/packages" icon="📦" title="I bought something" quote="Show me where my package is." cta="See My Packages" accent="sea" />
          <ActionCard href="/ship" icon="🚚" title="I want to ship something" quote="I need to send something to The Bahamas." cta="Start Shipping" accent="sun" />
          <ActionCard href="/cost" icon="💰" title="I want to know the cost" quote="Tell me how much it will cost." cta="Calculate Cost" accent="ink" />
          <ActionCard href="/help" icon="💬" title="I need help" quote="I'm not sure what to do." cta="Ask The Link" accent="coral" />
        </div>
      </section>

      {/* Your packages */}
      <section aria-labelledby="your-packages" className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
        <Card className="p-5 sm:p-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2 id="your-packages" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
                Your Packages
              </h2>
              <p className="mt-1 text-lg text-ink-soft">
                <strong className="text-ink">{active.length} packages</strong> on the move
              </p>
            </div>
            <span aria-hidden className="text-5xl">📦</span>
          </div>
          <ul className="mt-5 divide-y divide-sand-200">
            {active.map((p) => (
              <li key={p.id}>
                <Link href={`/packages/${p.id}`} className="flex min-h-16 items-center gap-4 py-3 hover:bg-sand-50">
                  <MerchantMark merchant={p.merchant} />
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold">{p.merchant}</p>
                    <p className="truncate text-ink-soft">{p.itemName}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </Link>
              </li>
            ))}
          </ul>
          <ButtonLink href="/packages" full className="mt-5" icon="📦">
            View All Packages
          </ButtonLink>
        </Card>
        <ShoppingAddressCard address={address} />
      </section>

      <HowItWorks />

      {/* Help + business */}
      <section className="grid gap-5 md:grid-cols-2">
        <Card className="flex flex-col p-6 sm:p-8">
          <span aria-hidden className="text-4xl">💬</span>
          <h2 className="mt-3 text-2xl font-extrabold">Confused? Just ask.</h2>
          <p className="mt-1 text-lg text-ink-soft">Ask Link Assistant, or message us on WhatsApp. A real person is always one tap away.</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 md:mt-auto md:grid-cols-1 md:pt-6 xl:grid-cols-2">
            <ButtonLink href="/help" icon="🤖" variant="primary">
              Ask The Link
            </ButtonLink>
            <ButtonLink href="/help/whatsapp" icon="💬" variant="whatsapp">
              Chat on WhatsApp
            </ButtonLink>
          </div>
        </Card>
        <Link
          href="/business"
          className="group flex flex-col rounded-[var(--radius-card)] bg-ink p-6 text-white shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 sm:p-8"
        >
          <span aria-hidden className="text-4xl">🏢</span>
          <p className="mt-3 text-sm font-bold uppercase tracking-wider text-sun-300">Are you a business?</p>
          <h2 className="mt-1 text-2xl font-extrabold">Your logistics team, without hiring one.</h2>
          <p className="mt-1 text-lg text-white/75">Supplier shipments, inventory and commercial freight — handled.</p>
          <span className="mt-6 inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-white/10 px-5 text-lg font-bold ring-1 ring-white/20 transition group-hover:bg-white/15 md:mt-auto">
            The Link for Business <span aria-hidden>→</span>
          </span>
        </Link>
      </section>
    </div>
  );
}
