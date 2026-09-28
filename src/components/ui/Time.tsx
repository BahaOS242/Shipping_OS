"use client";

export function fmtDate(iso?: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return iso ? new Date(iso).toLocaleDateString("en-US", opts) : "—";
}

export function fmtDateTime(iso?: string) {
  return iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
}

export function ago(iso?: string) {
  if (!iso) return "—";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 0) {
    const f = -m;
    return f < 60 ? `in ${f} min` : f < 1440 ? `in ${Math.round(f / 60)}h` : `in ${Math.round(f / 1440)}d`;
  }
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
}

export function Ago({ iso }: { iso?: string }) {
  return <time dateTime={iso} title={fmtDateTime(iso)}>{ago(iso)}</time>;
}
