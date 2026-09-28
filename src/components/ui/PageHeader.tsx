import Link from "next/link";

export function PageHeader({
  title,
  sub,
  back,
  eyebrow,
  children,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  back?: { href: string; label: string };
  eyebrow?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="mb-6 animate-rise sm:mb-8">
      {back && (
        <Link href={back.href} className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-xl text-base font-semibold text-sea-700 hover:underline">
          <span aria-hidden>←</span> {back.label}
        </Link>
      )}
      {eyebrow && <div className="mb-2">{eyebrow}</div>}
      <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-5xl">{title}</h1>
      {sub && <p className="mt-2 text-lg text-ink-soft sm:text-xl">{sub}</p>}
      {children}
    </header>
  );
}
