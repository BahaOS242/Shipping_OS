import Link from "next/link";

type Accent = "sea" | "sun" | "coral" | "ink";

const ACCENT: Record<Accent, { tile: string; cta: string }> = {
  sea: { tile: "bg-sea-50", cta: "bg-sea-600 text-white group-hover:bg-sea-700" },
  sun: { tile: "bg-sun-50", cta: "bg-sun-400 text-ink group-hover:bg-sun-300" },
  coral: { tile: "bg-coral-50", cta: "bg-ink text-white group-hover:bg-ink-soft" },
  ink: { tile: "bg-sand-100", cta: "bg-white text-ink ring-2 ring-inset ring-ink/10 group-hover:ring-sea-400" },
};

/** One giant, obvious choice. The whole card is the button. */
export function ActionCard({
  href,
  icon,
  title,
  quote,
  cta,
  accent = "sea",
}: {
  href: string;
  icon: string;
  title: string;
  quote: string;
  cta: string;
  accent?: Accent;
}) {
  const a = ACCENT[accent];
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-[var(--radius-card)] bg-white p-5 shadow-[var(--shadow-card)] ring-1 ring-sand-200/70 transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-lift)] sm:p-7"
    >
      <div className="flex items-center gap-4 sm:mb-6 sm:block">
        <span aria-hidden className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-4xl sm:h-20 sm:w-20 sm:text-5xl ${a.tile}`}>
          {icon}
        </span>
        <div className="sm:mt-5">
          <h2 className="text-xl font-black uppercase leading-tight tracking-tight text-ink sm:text-2xl">{title}</h2>
          <p className="mt-1 text-base text-ink-soft sm:mt-2 sm:text-lg">&ldquo;{quote}&rdquo;</p>
        </div>
      </div>
      <span className={`mt-5 flex min-h-14 items-center justify-center gap-2 whitespace-nowrap rounded-2xl px-4 text-lg font-bold lg:text-[17px] transition-colors sm:mt-auto ${a.cta}`}>
        {cta} <span aria-hidden>→</span>
      </span>
    </Link>
  );
}
