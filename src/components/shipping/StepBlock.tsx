export function StepBlock({ n, title, children, done }: { n: number; title: string; children: React.ReactNode; done?: boolean }) {
  return (
    <section aria-labelledby={`step-${n}`} className="rounded-[var(--radius-card)] bg-white p-5 ring-1 ring-sand-200/70 sm:p-6">
      <h2 id={`step-${n}`} className="mb-4 flex items-center gap-3 text-2xl font-extrabold tracking-tight">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-base font-black ${done ? "bg-sea-600 text-white" : "bg-ink text-white"}`}
        >
          {done ? "✓" : n}
        </span>
        <span>
          <span className="sr-only">Step {n}: </span>
          {title}
        </span>
      </h2>
      {children}
    </section>
  );
}
