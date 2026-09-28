"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "../ui/Logo";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/packages", label: "My Packages" },
  { href: "/ship", label: "Ship Something" },
  { href: "/cost", label: "Shipping Cost" },
  { href: "/locations", label: "Locations" },
  { href: "/help", label: "Help" },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-sand-200/70 bg-sand-50/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:h-20 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map((n) => {
              const active = isActive(pathname, n.href);
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-xl px-3.5 py-2.5 text-[15px] font-semibold transition-colors ${
                      active ? "bg-sea-50 text-sea-700" : "text-ink-soft hover:bg-sand-100 hover:text-ink"
                    }`}
                  >
                    {n.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <Link
          href="/account"
          className="flex min-h-11 items-center gap-2.5 rounded-full bg-white py-1.5 pl-1.5 pr-4 font-bold text-ink ring-1 ring-sand-200 hover:ring-sea-400"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-sun-400 text-sm font-extrabold text-ink" aria-hidden>
            T
          </span>
          My Link
        </Link>
      </div>
    </header>
  );
}
