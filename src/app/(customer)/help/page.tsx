import type { Metadata } from "next";
import { ChatAssistant } from "@/components/chat/ChatAssistant";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { getLocation, getPackage } from "@/lib/api/link-api";
import { getSessionCustomerId } from "@/lib/auth";

export const metadata: Metadata = { title: "Get Help" };

const FAQ = [
  { q: "Where is my package?", a: "Open My Packages. Each package shows a big status like “We have it!” and what happens next.", href: "/packages" },
  { q: "What do I do next?", a: "Usually nothing! We message you when your package moves. When it says “Ready for you”, come get it." },
  { q: "How much will it cost?", a: "Use the cost calculator: pick the island, the weight, and plane or boat.", href: "/cost" },
  { q: "How do I get my package?", a: "Pick it up at your pickup center, or ask us to deliver it. We tell you when it’s ready.", href: "/locations" },
  { q: "Who do I talk to if I’m confused?", a: "Ask Link Assistant here, message us on WhatsApp, or tap “Talk to a person”. A real person is always there." },
];

export default async function HelpPage({ searchParams }: { searchParams: Promise<{ package?: string }> }) {
  const sp = await searchParams;
  const customerId = await getSessionCustomerId();
  const pkg = sp.package ? await getPackage(sp.package, { customerId }).catch(() => null) : null;
  const nassau = await getLocation("loc_nassau");

  return (
    <>
      <PageHeader title="How can we help?" sub="Ask Link Assistant anything. A real person is one tap away." />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <ChatAssistant
          key={pkg?.id ?? "help"}
          customerId={customerId}
          autoAsk={pkg ? { actionId: `package:${pkg.id}`, label: `Where is my ${pkg.merchant} package?` } : undefined}
        />

        <div className="space-y-4">
          <Card className="bg-[#e7fbe9] p-6 ring-[#bfeccb]">
            <p className="text-4xl" aria-hidden>🟢</p>
            <h2 className="mt-2 text-2xl font-extrabold">Prefer WhatsApp?</h2>
            <p className="mt-1 text-lg text-ink-soft">Same assistant, same answers — right in WhatsApp.</p>
            <ButtonLink href="/help/whatsapp" variant="whatsapp" size="xl" full className="mt-5" icon="💬">
              Chat on WhatsApp
            </ButtonLink>
          </Card>

          <Card className="p-6">
            <p className="text-4xl" aria-hidden>🙋</p>
            <h2 className="mt-2 text-2xl font-extrabold">Talk to a person</h2>
            <p className="mt-1 text-lg text-ink-soft">
              Call {nassau?.phone} <span className="text-sm">(demo)</span>
              <br />
              {nassau?.hours}
            </p>
          </Card>
        </div>
      </div>

      <section aria-labelledby="faq" className="mt-12">
        <h2 id="faq" className="text-3xl font-extrabold tracking-tight">
          Quick answers
        </h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {FAQ.map((f) => (
            <details key={f.q} className="group rounded-2xl bg-white p-5 ring-1 ring-sand-200/70">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-lg font-extrabold">
                {f.q}
                <span aria-hidden className="text-2xl text-sea-600 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-2 text-lg text-ink-soft">{f.a}</p>
              {f.href && (
                <a href={f.href} className="mt-3 inline-block font-bold text-sea-700 underline">
                  Take me there →
                </a>
              )}
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
