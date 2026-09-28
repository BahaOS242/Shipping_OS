import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { HowItWorks } from "@/components/home/HowItWorks";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { SEO_PAGES, seoBySlug } from "@/content/seo";
import { destinationById } from "@/data/reference";
import { DISCLAIMERS, calculateShipping, fmtLb, fmtUsd } from "@/domain/rates";

export const dynamicParams = false;
export const generateStaticParams = () => SEO_PAGES.map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = seoBySlug((await params).slug);
  return p ? { title: p.title, description: p.description, alternates: { canonical: `/${p.slug}` } } : {};
}

export default async function SeoLanding({ params }: { params: Promise<{ slug: string }> }) {
  const p = seoBySlug((await params).slug);
  if (!p) notFound();
  const examples = p.examples.map((e) => ({ ...e, est: calculateShipping({ actualWeight: e.weight, length: e.dims?.[0], width: e.dims?.[1], height: e.dims?.[2] }, destinationById(e.destinationId)!, e.service) }));
  const faqLd = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: p.faq.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) };
  return (
    <article className="space-y-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
      <header className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-wider text-sea-700">{p.eyebrow}</p>
        <h1 className="mt-2 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">{p.h1}</h1>
        <p className="mt-4 text-xl text-ink-soft">{p.problem}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={p.cta.href} size="lg">{p.cta.label} →</ButtonLink>
          <ButtonLink href="/assistant" size="lg" variant="secondary" icon="💬">Ask a question</ButtonLink>
        </div>
      </header>

      <section aria-labelledby="who" className="grid gap-5 md:grid-cols-[1fr_1.4fr]">
        <div>
          <h2 id="who" className="text-3xl font-extrabold tracking-tight">Who it&apos;s for</h2>
          <ul className="mt-4 space-y-2 text-lg">{p.who.map((w) => <li key={w} className="flex gap-2"><span aria-hidden className="text-sea-600">✓</span>{w}</li>)}</ul>
        </div>
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight">How it works</h2>
          <ol className="mt-4 space-y-3">
            {p.how.map(([t, d], i) => (
              <li key={t} className="flex gap-4 rounded-2xl bg-white p-4 ring-1 ring-sand-200">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-black text-white">{i + 1}</span>
                <span><span className="block text-lg font-extrabold">{t}</span><span className="text-ink-soft">{d}</span></span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="cost">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="cost" className="text-3xl font-extrabold tracking-tight">What does it cost?</h2>
          <DemoBadge>Demo estimates</DemoBadge>
        </div>
        <p className="mt-2 max-w-2xl text-lg text-ink-soft">{p.costNote}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {examples.map((e) => (
            <Card key={e.label} className="p-5">
              <p className="font-bold text-ink-soft">{e.label}</p>
              <p className="mt-1 text-4xl font-black">{fmtUsd(e.est.total)}</p>
              <p className="text-sm text-ink-mute">{e.service === "air" ? "✈️ Air" : "🚢 Ocean"} · billed on {fmtLb(e.est.billableWeight)}{e.est.basis === "dimensional" ? " (by size)" : ""} · {e.est.transit}</p>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-mute">{DISCLAIMERS.join(" ")}</p>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <Card className="p-6 sm:p-8">
          <h2 className="text-2xl font-extrabold">What happens next</h2>
          <ol className="mt-4 space-y-2 text-lg">{p.next.map((n, i) => <li key={n}><strong>{i + 1}.</strong> {n}</li>)}</ol>
          <ButtonLink href={p.cta.href} className="mt-6">{p.cta.label} →</ButtonLink>
        </Card>
        <div>
          <h2 className="text-2xl font-extrabold">Questions</h2>
          <div className="mt-3 space-y-2">
            {p.faq.map(([q, a]) => (
              <details key={q} className="group rounded-2xl bg-white p-4 ring-1 ring-sand-200">
                <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-extrabold">{q}<span aria-hidden className="text-xl text-sea-600 group-open:rotate-45">+</span></summary>
                <p className="mt-1 text-ink-soft">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <HowItWorks id="journey" />

      <nav aria-label="Related" className="rounded-[var(--radius-card)] bg-sand-100 p-6">
        <p className="font-bold">Related</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {p.related.map((r) => {
            const x = seoBySlug(r);
            return x ? <li key={r}><Link href={`/${r}`} className="inline-flex min-h-11 items-center rounded-full bg-white px-4 font-semibold ring-1 ring-sand-200 hover:ring-sea-400">{x.eyebrow} →</Link></li> : null;
          })}
          <li><Link href="/how-it-works" className="inline-flex min-h-11 items-center rounded-full bg-white px-4 font-semibold ring-1 ring-sand-200">How it works →</Link></li>
        </ul>
      </nav>
    </article>
  );
}
