import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { getLocations } from "@/lib/api/link-api";
import { ISLANDS } from "@/lib/pricing";

export const metadata: Metadata = { title: "Locations" };

export default async function LocationsPage() {
  const locations = await getLocations();
  const warehouse = locations.find((l) => l.kind === "us_warehouse")!;
  const pickups = locations.filter((l) => l.kind !== "us_warehouse");

  return (
    <>
      <PageHeader title="Locations" sub="Where we get your packages, and where you pick them up." eyebrow={<DemoBadge>Demo locations</DemoBadge>} />

      <section aria-labelledby="send" className="mb-10">
        <h2 id="send" className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-mute">
          1 · Stores send your packages here
        </h2>
        <Card className="flex flex-col gap-5 bg-sea-800 p-6 text-white ring-0 sm:flex-row sm:items-center sm:p-8">
          <span aria-hidden className="text-6xl">🏭</span>
          <div className="flex-1">
            <p className="text-2xl font-extrabold">{warehouse.name}</p>
            <p className="mt-1 text-lg text-sea-100">{warehouse.purpose}</p>
            <p className="mt-2 font-semibold">{warehouse.addressLines.join(", ")}</p>
            <p className="text-sea-100">🕘 {warehouse.hours}</p>
          </div>
          <ButtonLink href="/account" variant="gold" icon="📋">
            Get my address
          </ButtonLink>
        </Card>
      </section>

      <section aria-labelledby="pickup">
        <h2 id="pickup" className="mb-3 text-sm font-bold uppercase tracking-wider text-ink-mute">
          2 · You pick them up here
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pickups.map((l) => (
            <Card key={l.id} className="p-6">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-sea-50 px-3 py-1 text-sm font-bold text-sea-800">
                🇧🇸 {l.island ? ISLANDS[l.island].name : ""}
              </p>
              <p className="mt-3 text-xl font-extrabold">{l.name}</p>
              <p className="mt-1 text-ink-soft">{l.purpose}</p>
              <dl className="mt-4 space-y-1.5 text-[17px]">
                <div className="flex gap-2">
                  <dt aria-label="Address">📍</dt>
                  <dd>{l.addressLines.join(", ")}</dd>
                </div>
                <div className="flex gap-2">
                  <dt aria-label="Hours">🕘</dt>
                  <dd>{l.hours}</dd>
                </div>
                {l.phone && (
                  <div className="flex gap-2">
                    <dt aria-label="Phone">📞</dt>
                    <dd>{l.phone}</dd>
                  </div>
                )}
              </dl>
            </Card>
          ))}
        </div>
      </section>

      <Card className="mt-10 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xl font-extrabold">Can&apos;t come in? 🚚</p>
          <p className="text-lg text-ink-soft">We can bring it to your door in Nassau. Just ask.</p>
        </div>
        <ButtonLink href="/help" icon="💬">Ask The Link</ButtonLink>
      </Card>
    </>
  );
}
