"use client";

import { useState } from "react";
import { DemoBadge } from "../ui/DemoBadge";

type Addr = { name: string; line1: string; line2: string; cityLine: string };

/** The address customers type at Amazon/Walmart checkout. Clearly a DEMO address. */
export function ShoppingAddressCard({ address, compact = false }: { address: Addr; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const text = `${address.name}\n${address.line1}\n${address.line2}\n${address.cityLine}`;
  return (
    <div className="rounded-[var(--radius-card)] bg-sea-800 p-5 text-white sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold uppercase tracking-wider text-sea-100">Your U.S. shipping address</p>
        <DemoBadge>Demo address</DemoBadge>
      </div>
      {!compact && <p className="mt-2 text-sea-100">When you shop online, type this as your shipping address. The store sends it to us.</p>}
      <address className="mt-4 rounded-2xl bg-white/10 p-4 text-lg font-semibold not-italic leading-relaxed ring-1 ring-white/15">
        {address.name}
        <br />
        <span className="text-sun-300">{address.line1}</span>
        <br />
        {address.line2}
        <br />
        {address.cityLine}
      </address>
      <button
        onClick={async () => {
          try { await navigator.clipboard.writeText(text); } catch { /* blocked */ }
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-sun-400 text-lg font-bold text-ink transition hover:bg-sun-300 active:scale-[0.98]"
      >
        <span aria-hidden>{copied ? "✅" : "📋"}</span>
        {copied ? "Copied!" : "Copy my address"}
      </button>
      <p className="mt-3 text-sm text-sea-100/80" aria-live="polite">
        Your number <strong className="text-white">{address.line1.replace("Shipping OS ", "")}</strong> tells us the package is yours.
      </p>
    </div>
  );
}
