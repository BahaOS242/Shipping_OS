/** Neutral initial tile for a store (no third-party logos in the demo). */
const PALETTE = ["bg-sea-100 text-sea-800", "bg-sun-100 text-sun-700", "bg-coral-50 text-coral-700", "bg-sand-200 text-ink", "bg-emerald-50 text-emerald-800"];

export function MerchantMark({ merchant, size = "md" }: { merchant: string; size?: "md" | "lg" }) {
  const idx = [...merchant].reduce((a, c) => a + c.charCodeAt(0), 0) % PALETTE.length;
  const initials = merchant
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      aria-hidden
      className={`grid shrink-0 place-items-center rounded-2xl font-extrabold ${PALETTE[idx]} ${size === "lg" ? "h-16 w-16 text-2xl" : "h-12 w-12 text-lg"}`}
    >
      {initials}
    </span>
  );
}
