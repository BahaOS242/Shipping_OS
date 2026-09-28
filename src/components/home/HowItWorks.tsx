const STEPS = [
  { icon: "🛒", title: "You buy it", text: "Shop at any U.S. store. Use your The Link address." },
  { icon: "📦", title: "We receive it", text: "It arrives at our Florida warehouse. We tell you." },
  { icon: "✈️", title: "We bring it here", text: "We pack it and send it to The Bahamas." },
  { icon: "🙌", title: "You get it", text: "Pick it up, or we bring it to you." },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="hiw" className="scroll-mt-28">
      <h2 id="hiw" className="text-3xl font-extrabold tracking-tight sm:text-4xl">
        How The Link works
      </h2>
      <p className="mt-2 text-lg text-ink-soft">Four steps. That&apos;s it.</p>
      <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="relative rounded-[var(--radius-card)] bg-white p-5 ring-1 ring-sand-200/70">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-sm font-black text-white">{i + 1}</span>
              <span aria-hidden className="text-3xl">
                {s.icon}
              </span>
            </div>
            <p className="mt-3 text-xl font-extrabold">{s.title}</p>
            <p className="mt-1 text-ink-soft">{s.text}</p>
            {i < STEPS.length - 1 && (
              <span aria-hidden className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 text-2xl text-sea-400 lg:block">
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
