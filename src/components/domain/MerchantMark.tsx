const PALETTE = ["bg-sea-100 text-sea-800", "bg-sun-100 text-sun-700", "bg-coral-50 text-coral-700", "bg-sand-200 text-ink", "bg-emerald-50 text-emerald-800"];

/** Neutral initials tile (no third-party logos). */
export function MerchantMark({ merchant, size = "md" }: { merchant: string; size?: "sm" | "md" | "lg" }) {
  const idx = [...merchant].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length;
  const initials = merchant.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const sz = { sm: "h-9 w-9 text-sm rounded-xl", md: "h-12 w-12 text-lg rounded-2xl", lg: "h-16 w-16 text-2xl rounded-2xl" }[size];
  return <span aria-hidden className={`grid shrink-0 place-items-center font-extrabold ${PALETTE[idx]} ${sz}`}>{initials}</span>;
}
