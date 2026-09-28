"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActive } from "./SiteHeader";

const ITEMS = [
  { href: "/", label: "Home", icon: "🏠" },
  { href: "/packages", label: "Packages", icon: "📦" },
  { href: "/ship", label: "Ship", icon: "➕", primary: true },
  { href: "/help", label: "Help", icon: "💬" },
];

/** Mobile-only: four big, obvious destinations. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-sand-200 bg-white/95 backdrop-blur lg:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-4">
        {ITEMS.map((i) => {
          const active = isActive(pathname, i.href);
          return (
            <li key={i.href}>
              <Link
                href={i.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-[13px] font-bold ${
                  active ? "text-sea-700" : "text-ink-mute"
                }`}
              >
                <span
                  aria-hidden
                  className={`grid h-8 w-12 place-items-center rounded-full text-xl transition-colors ${
                    i.primary ? "bg-sun-400" : active ? "bg-sea-50" : ""
                  }`}
                >
                  {i.icon}
                </span>
                {i.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
