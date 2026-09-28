import Link from "next/link";
import { LogoMark } from "../ui/Logo";

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-sand-200 bg-sand-100/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark className="h-8 w-8" />
            <span className="text-lg font-extrabold">THE LINK</span>
          </div>
          <p className="mt-3 max-w-sm text-ink-soft">From checkout to your doorstep. We handle the rest.</p>
          <p className="mt-4 text-sm text-ink-mute">
            This is a product demonstration with fictional data. Addresses, prices and tracking shown here are not real.
          </p>
        </div>
        <div>
          <h2 className="font-bold">Customers</h2>
          <ul className="mt-3 space-y-2 text-ink-soft">
            <li><Link className="hover:text-sea-700" href="/packages">Where&apos;s my stuff?</Link></li>
            <li><Link className="hover:text-sea-700" href="/cost">How much will it cost?</Link></li>
            <li><Link className="hover:text-sea-700" href="/locations">Pickup locations</Link></li>
            <li><Link className="hover:text-sea-700" href="/help">Get help</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="font-bold">More</h2>
          <ul className="mt-3 space-y-2 text-ink-soft">
            <li><Link className="hover:text-sea-700" href="/business">The Link for Business</Link></li>
            <li><Link className="hover:text-sea-700" href="/help/whatsapp">Chat on WhatsApp (demo)</Link></li>
            <li><Link className="hover:text-sea-700" href="/admin">Staff view (demo)</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
