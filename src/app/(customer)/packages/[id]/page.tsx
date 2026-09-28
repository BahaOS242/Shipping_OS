import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MerchantMark } from "@/components/packages/MerchantMark";
import { PackageTimeline } from "@/components/packages/PackageTimeline";
import { StatusBadge, TONE } from "@/components/packages/StatusBadge";
import { TogetherNote } from "@/components/packages/TogetherNote";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getLocation, getPackage, getShipment } from "@/lib/api/link-api";
import { getSessionCustomerId } from "@/lib/auth";
import { ISLANDS, fmtLbs } from "@/lib/pricing";
import { STATUS, canConsolidate } from "@/lib/status";

export const metadata: Metadata = { title: "Your package" };

const NEXT_STEP: Record<string, string> = {
  incoming: "Arriving at our warehouse",
  received: "Shipment preparation",
  preparing: "Leaving on the next trip",
  in_transit: "Landing in The Bahamas",
  arrived: "Customs check, then ready for you",
  ready: "Pick it up",
  delivered: "All done",
};

function fmtDate(iso?: string) {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export default async function PackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customerId = await getSessionCustomerId();
  const pkg = await getPackage(id, { customerId }).catch(() => null);
  if (!pkg) notFound();

  const s = STATUS[pkg.status];
  const [shipment, location] = await Promise.all([
    pkg.shipmentId ? getShipment(pkg.shipmentId) : undefined,
    pkg.currentLocationId ? getLocation(pkg.currentLocationId) : undefined,
  ]);
  const where = pkg.status === "in_transit" && shipment ? `On ${shipment.label}` : (location?.name ?? s.where);

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/packages" className="mb-4 inline-flex min-h-11 items-center gap-2 text-base font-semibold text-sea-700 hover:underline">
        <span aria-hidden>←</span> My Packages
      </Link>
      <p className="text-lg font-semibold text-ink-mute">Your package</p>
      <div className="mt-2 flex items-center gap-4">
        <MerchantMark merchant={pkg.merchant} size="lg" />
        <div>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">{pkg.merchant}</h1>
          <p className="text-xl text-ink-soft">{pkg.itemName}</p>
        </div>
      </div>

      {/* Big status */}
      <section className={`mt-6 animate-rise rounded-[var(--radius-card)] p-6 ring-1 sm:p-8 ${TONE[s.tone]}`} aria-live="polite">
        <p className="text-sm font-bold uppercase tracking-wider opacity-80">Status</p>
        <p className="mt-1 flex items-center gap-3 text-4xl font-black tracking-tight sm:text-5xl">
          <span aria-hidden>{s.icon}</span>
          {s.title}
        </p>
        <p className="mt-2 text-lg font-medium">{s.explain}</p>
      </section>

      {/* Three plain answers */}
      <section className="mt-5 grid gap-4 sm:grid-cols-3">
        {[
          { q: "Where is it?", a: where, icon: "📍" },
          { q: "What's next?", a: s.next, icon: "👉" },
          { q: "Estimated next step", a: NEXT_STEP[pkg.status], icon: "🗓️" },
        ].map((b) => (
          <Card key={b.q} className="p-5">
            <p className="flex items-center gap-2 font-bold text-ink-mute">
              <span aria-hidden>{b.icon}</span> {b.q}
            </p>
            <p className="mt-1 text-xl font-extrabold leading-snug">{b.a}</p>
          </Card>
        ))}
      </section>

      <div className="mt-5">
        <TogetherNote packageId={pkg.id} eligible={canConsolidate(pkg.status)} />
      </div>

      <Card className="mt-5 p-6 sm:p-8">
        <h2 className="mb-6 text-2xl font-extrabold">The journey</h2>
        <PackageTimeline status={pkg.status} />
      </Card>

      <Card className="mt-5 p-6">
        <h2 className="text-xl font-extrabold">Package details</h2>
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4 text-lg sm:grid-cols-4">
          <div>
            <dt className="text-sm font-semibold text-ink-mute">Weight</dt>
            <dd className="font-bold">{fmtLbs(pkg.weight)}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink-mute">Going to</dt>
            <dd className="font-bold">{ISLANDS[pkg.destination].name}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink-mute">Traveling by</dt>
            <dd className="font-bold">{pkg.mode === "air" ? "✈️ Plane" : "🚢 Boat"}</dd>
          </div>
          <div>
            <dt className="text-sm font-semibold text-ink-mute">{pkg.receivedAt ? "We got it" : "Expected"}</dt>
            <dd className="font-bold">{fmtDate(pkg.receivedAt ?? pkg.expectedAt) ?? "Soon"}</dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-ink-mute">
          <StatusBadge status={pkg.status} />
          <span>Package ID {pkg.id.toUpperCase()}</span>
          {pkg.inboundTracking && <span>· Store tracking {pkg.inboundTracking}</span>}
        </div>
      </Card>

      {/* Next actions — sticky on mobile */}
      <div className="sticky bottom-20 z-20 mt-6 grid gap-3 rounded-3xl bg-sand-50/95 py-2 backdrop-blur sm:grid-cols-2 lg:static lg:bg-transparent">
        <ButtonLink href={`/help?package=${pkg.id}`} icon="💬" size="xl" full>
          Ask About This Package
        </ButtonLink>
        <ButtonLink href="/packages" variant="secondary" icon="📦" size="xl" full>
          See My Other Packages
        </ButtonLink>
      </div>
    </div>
  );
}
