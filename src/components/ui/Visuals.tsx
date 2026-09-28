"use client";

import QRCode from "qrcode";
import { useMemo } from "react";

/** QR code for a Shipping OS ID (rendered locally as SVG). */
export function QR({ value, size = 128, label = true }: { value: string; size?: number; label?: boolean }) {
  const path = useMemo(() => {
    const q = QRCode.create(value, { errorCorrectionLevel: "M" });
    const n = q.modules.size;
    let d = "";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (q.modules.get(x, y)) d += `M${x},${y}h1v1h-1z`;
    return { d, n };
  }, [value]);
  return (
    <figure className="inline-flex flex-col items-center gap-1">
      <svg viewBox={`-2 -2 ${path.n + 4} ${path.n + 4}`} width={size} height={size} role="img" aria-label={`QR code for ${value}`} className="rounded-lg bg-white">
        <path d={path.d} fill="#0f1d2b" shapeRendering="crispEdges" />
      </svg>
      {label && <figcaption className="font-mono text-xs font-bold tracking-wider">{value}</figcaption>}
    </figure>
  );
}

/** Simulated photo — clearly a placeholder, never a real image. */
export function PhotoTile({ id, damaged }: { id: string; damaged?: boolean }) {
  const n = [...id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const hue = damaged ? 12 : 30 + (n % 20);
  return (
    <figure className="overflow-hidden rounded-xl ring-1 ring-[#e3e7ec]">
      <svg viewBox="0 0 120 90" className="block h-auto w-full" role="img" aria-label={`Simulated photo ${id}`}>
        <rect width="120" height="90" fill={`hsl(${hue} 35% 88%)`} />
        <path d={`M30 ${34 + (n % 6)} L60 22 L92 ${34 - (n % 5)} L92 66 L60 78 L30 66 Z`} fill={`hsl(${hue} 45% 62%)`} />
        <path d="M30 34 L60 46 L92 34 M60 46 L60 78" stroke="rgba(0,0,0,.25)" fill="none" />
        <rect x="46" y="52" width="22" height="10" fill="#fff" opacity=".85" />
        {damaged && <path d="M72 30 l6 8 -5 4 7 9" stroke="#a3321f" strokeWidth="2.5" fill="none" />}
      </svg>
      <figcaption className="bg-white px-2 py-1 text-[10px] font-semibold text-ink-mute">{damaged ? "⚠ " : "📷 "}Simulated photo</figcaption>
    </figure>
  );
}

export function Signature({ path, name }: { path: string; name: string }) {
  return (
    <figure className="rounded-xl bg-white p-2 ring-1 ring-[#e3e7ec]">
      <svg viewBox="0 0 220 50" className="h-12 w-full" role="img" aria-label={`Simulated signature of ${name}`}>
        <path d={path} fill="none" stroke="#0a3a40" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <figcaption className="text-[10px] font-semibold text-ink-mute">✍ Simulated signature — {name}</figcaption>
    </figure>
  );
}
