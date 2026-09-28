import type { Metadata } from "next";
import { HowItWorks } from "@/components/home/HowItWorks";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export const metadata: Metadata = { title: "How it works", description: "From checkout to your doorstep: how Shipping OS receives, prepares, ships and delivers your packages to The Bahamas." };

const BEHIND = [
  ["📦", "Scanned", "Every box gets a Shipping OS package ID (a QR code) the moment it arrives."],
  ["⚖️", "Weighed & measured", "We record real weight and size. Big, light boxes are priced by size."],
  ["📷", "Photographed", "So you can see it arrived safely — and we can prove condition."],
  ["🧾", "Receipt matched", "Upload your store receipt and we read it and link it to the box."],
  ["⚠️", "Checked for problems", "Wrong weight, damage, restricted items — a person looks at anything unusual."],
  ["📋", "Paperwork prepared", "We build the customs packet from your receipts. A person reviews it."],
  ["✈️", "Sent", "On the next flight or sailing to your island."],
  ["🚚", "Delivered", "Pickup or delivery — with proof of delivery."],
];

export default function HowItWorksPage() {
  return (
    <div className="space-y-14">
      <header className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-wider text-sea-700">How it works</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-6xl">You buy it. We handle the rest.</h1>
        <p className="mt-4 text-xl text-ink-soft">Think of Shipping OS like this: <strong>You buy it → We receive it → We bring it here → You get it.</strong> That&apos;s it.</p>
      </header>
      <HowItWorks heading={false} />
      <section>
        <h2 className="text-3xl font-extrabold tracking-tight">What we do behind the scenes</h2>
        <p className="mt-2 text-lg text-ink-soft">You don&apos;t need to know any of this — but here&apos;s everything that happens to your package.</p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BEHIND.map(([i, t, d]) => (
            <li key={t}><Card className="h-full p-5"><p aria-hidden className="text-3xl">{i}</p><p className="mt-2 text-lg font-extrabold">{t}</p><p className="text-ink-soft">{d}</p></Card></li>
          ))}
        </ul>
      </section>
      <section className="flex flex-col items-start gap-4 rounded-[var(--radius-card)] bg-ink p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-10">
        <div><h2 className="text-3xl font-black">Ready?</h2><p className="text-lg text-white/75">Get your U.S. address and start shopping.</p></div>
        <div className="flex flex-wrap gap-3"><ButtonLink href="/us-address-bahamas" variant="gold">Get my address</ButtonLink><ButtonLink href="/shipping-calculator" variant="secondary">See prices</ButtonLink></div>
      </section>
    </div>
  );
}
