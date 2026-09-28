import Link from "next/link";

/** SHIPPING OS wordmark with two interlocking rings (Florida ↔ Bahamas). */
export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="12" fill="var(--color-sea-600)" />
      <circle cx="16" cy="20" r="7.5" fill="none" stroke="var(--color-sun-400)" strokeWidth="3.5" />
      <circle cx="24" cy="20" r="7.5" fill="none" stroke="#fff" strokeWidth="3.5" />
      <path d="M16 12.5a7.5 7.5 0 0 1 7.2 5.4" fill="none" stroke="var(--color-sun-400)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/", suffix }: { href?: string; suffix?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label="Shipping OS — home">
      <LogoMark />
      <span className="whitespace-nowrap text-xl font-extrabold tracking-tight text-ink">
        SHIPPING OS{suffix && <span className="ml-2 hidden text-sm font-semibold text-ink-mute sm:inline">{suffix}</span>}
      </span>
    </Link>
  );
}
