"use client";

import Link from "next/link";
import { ChatAssistant } from "@/components/chat/ChatAssistant";
import { CustomerView } from "@/components/customer/CustomerView";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import * as svc from "@/services";

const FAQ = [
  { q: "Where is my package?", a: "Open My Packages. Each package shows a big status like “We have it!” and what happens next.", href: "/packages" },
  { q: "What do I do next?", a: "Your dashboard lists anything you need to do — like uploading a receipt or paying a bill. Otherwise, nothing! We message you when things move.", href: "/dashboard" },
  { q: "How much will it cost?", a: "Use the calculator: pick the island, the weight (and size if you know it), and air or ocean.", href: "/shipping-calculator" },
  { q: "How do I get my package?", a: "Pick it up at your pickup point, or ask for home delivery where available. We tell you when it's ready.", href: "/locations" },
  { q: "Who do I talk to if I'm confused?", a: "Ask Shipping OS Assistant here, message us on WhatsApp, or open a help request — a real person replies.", href: "/support" },
  { q: "Something arrived damaged", a: "Report a problem with a photo. Our team reviews every claim.", href: "/claims/new" },
];

export default function HelpPage() {
  return (
    <CustomerView title="Help">
      {(me) => {
        const loc = svc.getLocation(me.preferredPickupLocationId);
        return (
          <div className="space-y-12">
            <header><h1 className="text-4xl font-black tracking-tight sm:text-5xl">How can we help?</h1><p className="mt-2 text-xl text-ink-soft">Ask Shipping OS Assistant anything. A real person is one tap away.</p></header>
            <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
              <ChatAssistant customerId={me.id} />
              <div className="space-y-4">
                <Card className="bg-[#e7fbe9] p-6 ring-[#bfeccb]">
                  <p className="text-4xl" aria-hidden>🟢</p>
                  <h2 className="mt-2 text-2xl font-extrabold">Prefer WhatsApp?</h2>
                  <p className="mt-1 text-lg text-ink-soft">Same assistant, same answers — right in WhatsApp.</p>
                  <ButtonLink href="/whatsapp-demo" variant="whatsapp" size="xl" full className="mt-5" icon="💬">Chat on WhatsApp</ButtonLink>
                </Card>
                <Card className="p-6">
                  <p className="text-4xl" aria-hidden>🙋</p>
                  <h2 className="mt-2 text-2xl font-extrabold">Talk to a person</h2>
                  <p className="mt-1 text-lg text-ink-soft">{loc?.phone} (demo) · {loc?.hours}</p>
                  <ButtonLink href="/support" variant="secondary" full className="mt-4" icon="🎧">Open a help request</ButtonLink>
                </Card>
              </div>
            </div>
            <section aria-labelledby="faq">
              <h2 id="faq" className="text-3xl font-extrabold tracking-tight">Quick answers</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {FAQ.map((f) => (
                  <details key={f.q} className="group rounded-2xl bg-white p-5 ring-1 ring-sand-200/70">
                    <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-lg font-extrabold">{f.q}<span aria-hidden className="text-2xl text-sea-600 group-open:rotate-45">+</span></summary>
                    <p className="mt-2 text-lg text-ink-soft">{f.a}</p>
                    <Link href={f.href} className="mt-3 inline-block font-bold text-sea-700 underline">Take me there →</Link>
                  </details>
                ))}
              </div>
            </section>
          </div>
        );
      }}
    </CustomerView>
  );
}
