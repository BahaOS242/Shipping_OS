const STEPS = [
  { icon: "🛒", title: "Buy", text: "Shop at any U.S. store — Amazon, Walmart, anywhere." },
  { icon: "📮", title: "Ship to The Link", text: "Use your personal The Link U.S. address at checkout." },
  { icon: "📦", title: "We receive it", text: "We scan, weigh and photograph it, and tell you it's here." },
  { icon: "✈️", title: "We send it", text: "Alone or put together with your other packages — by air or ocean." },
  { icon: "🙌", title: "You get it", text: "Pick it up, or we bring it to your door." },
];

/** The five-step customer journey, shown vertically on phones. */
export function HowItWorks({ id = "how-it-works", heading = true }: { id?: string; heading?: boolean }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-28">
      {heading && (
        <>
          <h2 id={`${id}-h`} className="text-3xl font-extrabold tracking-tight sm:text-4xl">How The Link works</h2>
          <p className="mt-2 text-lg text-ink-soft">Five steps. We handle the hard parts.</p>
        </>
      )}
      <ol className="mt-6 grid gap-2 lg:grid-cols-5 lg:gap-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative">
            <div className="flex h-full items-start gap-4 rounded-[var(--radius-card)] bg-white p-5 ring-1 ring-sand-200/70 lg:flex-col lg:gap-3">
              <span className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-sm font-black text-white">{i + 1}</span>
                <span aria-hidden className="text-3xl">{s.icon}</span>
              </span>
              <span>
                <span className="block text-lg font-black uppercase tracking-tight">{s.title}</span>
                <span className="mt-0.5 block text-ink-soft">{s.text}</span>
              </span>
            </div>
            {i < STEPS.length - 1 && <span aria-hidden className="mx-auto block w-fit py-0.5 text-xl text-sea-400 lg:absolute lg:-right-3 lg:top-1/2 lg:z-10 lg:-translate-y-1/2 lg:py-0">{"↓"}</span>}
          </li>
        ))}
      </ol>
    </section>
  );
}
