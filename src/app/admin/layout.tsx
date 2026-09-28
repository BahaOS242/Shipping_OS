import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

export const metadata: Metadata = { title: { default: "Staff", template: "%s · The Link Staff" } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[#f4f6f8]">
      <div className="bg-coral-500 px-4 py-1.5 text-center text-[13px] font-semibold text-white">
        Staff view · DEMO — fictional customers and packages. Nothing here changes real systems.
      </div>
      <header className="border-b border-[#e3e7ec] bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo href="/admin" suffix="Staff" />
          <nav className="flex items-center gap-1 text-[15px] font-semibold">
            <Link href="/admin" className="hidden rounded-xl px-3 py-2 text-ink-soft hover:bg-sand-100 sm:block">
              Dashboard
            </Link>
            <Link href="/" className="whitespace-nowrap rounded-xl px-3 py-2 text-sea-700 hover:bg-sea-50">
              Customer site ↗
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
