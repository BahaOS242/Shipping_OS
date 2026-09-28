import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { destinations, locations } from "@/data/reference";
import { fmtUsd } from "@/domain/rates";

export const metadata: Metadata = { title: "Locations", description: "Where Shipping OS receives your packages in Florida and where you pick them up across The Bahamas." };

const PAGES = [
  { slug: "nassau", label: "Nassau", icon: "🏙️" },
  { slug: "abaco", label: "Abaco", icon: "⛵" },
  { slug: "exuma", label: "Exuma", icon: "🏝️" },
  { slug: "family-islands", label: "Family Islands", icon: "🌴" },
];

export default function LocationsPage() {
  const wh = locations.find((l) => l.kind === "us_warehouse")!;
  return (
    <div className="space-y-10">
      <header>
        <DemoBadge>Demo locations</DemoBadge>
        <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Locations</h1>
        <p className="mt-1 text-xl text-ink-soft">Where we get your packages, and where you get them.</p>
      </header>
      <ol className="grid items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr]" aria-label="How your package moves">
        {[["🏭", "Florida Warehouse", "Stores deliver here. We receive, weigh and prepare."], ["✈️🚢", "Air or ocean", "Flights several times a week; weekly sailings."], ["🇧🇸", "Your island", "Pickup point, partner agent or home delivery."]].map(([i, t, d], n) => (
          <li key={t} className="contents">
            <Card className="p-5 text-center"><p className="text-3xl" aria-hidden>{i}</p><p className="mt-1 text-lg font-extrabold">{t}</p><p className="text-ink-soft">{d}</p></Card>
            {n < 2 && <span aria-hidden className="self-center text-center text-2xl text-sea-500"><span className="md:hidden">↓</span><span className="hidden md:inline">→</span></span>}
          </li>
        ))}
      </ol>
      <Card className="flex flex-col gap-4 bg-sea-800 p-6 text-white ring-0 sm:flex-row sm:items-center">
        <span aria-hidden className="text-5xl">🏭</span>
        <div className="flex-1"><p className="text-2xl font-extrabold">{wh.name}</p><p className="text-sea-100">{wh.purpose}</p><p className="mt-1 font-semibold">{wh.addressLines.join(", ")} · {wh.hours}</p></div>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PAGES.map((p) => (
          <Link key={p.slug} href={`/locations/${p.slug}`} className="rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-sand-200 transition hover:-translate-y-0.5 hover:ring-sea-400">
            <p className="text-4xl" aria-hidden>{p.icon}</p><p className="mt-2 text-2xl font-extrabold">{p.label}</p><p className="font-bold text-sea-700">Services & pickup →</p>
          </Link>
        ))}
      </div>
      <section>
        <h2 className="text-2xl font-extrabold">Every island we serve</h2>
        <div className="mt-4 overflow-x-auto rounded-2xl bg-white ring-1 ring-sand-200">
          <table className="w-full min-w-[640px] text-left">
            <thead className="text-sm text-ink-mute"><tr><th className="px-4 py-3">Island</th><th className="px-4 py-3">Air</th><th className="px-4 py-3">Ocean</th><th className="px-4 py-3">Get it</th></tr></thead>
            <tbody className="divide-y divide-sand-200">
              {destinations.map((d) => (
                <tr key={d.id}><td className="px-4 py-3 font-bold">{d.name}</td><td className="px-4 py-3">{d.schedule.air}</td><td className="px-4 py-3">{d.schedule.ocean}</td><td className="px-4 py-3">{d.homeDelivery ? `Pickup or delivery (${fmtUsd(d.homeDeliveryFee)})` : "Pickup"}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
