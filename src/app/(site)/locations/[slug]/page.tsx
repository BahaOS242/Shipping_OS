import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { destinations, locations } from "@/data/reference";
import { calculateShipping, fmtUsd } from "@/domain/rates";
import type { Destination } from "@/domain/types";

const GROUPS: Record<string, { name: string; blurb: string; group: Destination["group"]; seo?: string }> = {
  nassau: { name: "Nassau", blurb: "Our main hub. Most flights and every sailing land here first.", group: "nassau", seo: "shipping-to-bahamas" },
  abaco: { name: "Abaco", blurb: "Served through our Marsh Harbour partner.", group: "abaco", seo: "shipping-to-abaco" },
  exuma: { name: "Exuma", blurb: "George Town pickup, plus delivery by partner courier.", group: "exuma", seo: "shipping-to-exuma" },
  "family-islands": { name: "Family Islands", blurb: "Eleuthera, Grand Bahama, Andros, Long Island, Bimini, Cat Island and more.", group: "family_islands", seo: "shipping-to-family-islands" },
};

export const dynamicParams = false;
export const generateStaticParams = () => Object.keys(GROUPS).map((slug) => ({ slug }));
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const g = GROUPS[(await params).slug];
  return g ? { title: `${g.name} — services & pickup`, description: `${g.blurb} Air and ocean schedules, pickup points and delivery options.` } : {};
}

export default async function LocationPage({ params }: { params: Promise<{ slug: string }> }) {
  const g = GROUPS[(await params).slug];
  if (!g) notFound();
  const dests = destinations.filter((d) => d.group === g.group);
  return (
    <div className="space-y-8">
      <Link href="/locations" className="inline-flex min-h-11 items-center gap-2 font-semibold text-sea-700 hover:underline">← Locations</Link>
      <header><DemoBadge>Demo location data</DemoBadge><h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">{g.name}</h1><p className="mt-1 text-xl text-ink-soft">{g.blurb}</p></header>
      <div className="grid gap-4 md:grid-cols-2">
        {dests.map((d) => {
          const est = calculateShipping({ actualWeight: 5 }, d, "air");
          return (
            <Card key={d.id} className="p-6">
              <h2 className="text-2xl font-extrabold">🇧🇸 {d.name}</h2>
              <dl className="mt-3 space-y-2">
                <div><dt className="text-sm font-bold text-ink-mute">✈️ Air</dt><dd className="font-semibold">{d.schedule.air}</dd></div>
                <div><dt className="text-sm font-bold text-ink-mute">🚢 Ocean</dt><dd className="font-semibold">{d.schedule.ocean}</dd></div>
                <div><dt className="text-sm font-bold text-ink-mute">🚚 Delivery</dt><dd className="font-semibold">{d.homeDelivery ? `Available — ${fmtUsd(d.homeDeliveryFee)}` : "Pickup only"}</dd></div>
                <div><dt className="text-sm font-bold text-ink-mute">💰 5 lb box by air</dt><dd className="font-semibold">{fmtUsd(est.total)} (demo estimate)</dd></div>
              </dl>
              {d.pickupLocationIds.map((id) => {
                const l = locations.find((x) => x.id === id)!;
                return <div key={id} className="mt-4 rounded-2xl bg-sand-50 p-4"><p className="font-extrabold">📍 {l.name}</p><p>{l.addressLines.join(", ")}</p><p className="text-ink-soft">🕘 {l.hours}{l.phone ? ` · 📞 ${l.phone}` : ""}</p></div>;
              })}
            </Card>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href={`/shipping-calculator?to=${dests[0].id}`} icon="💰">Prices to {g.name}</ButtonLink>
        {g.seo && <ButtonLink href={`/${g.seo}`} variant="secondary">Shipping to {g.name} →</ButtonLink>}
      </div>
    </div>
  );
}
