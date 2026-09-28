"use client";

import Link from "next/link";
import { useDemoStore } from "@/lib/demo-store";
import type { Customer, SupportTicket } from "@/lib/types";

type Row = {
  id: string;
  customerName: string;
  channel: string;
  preview: string;
  status: "live" | "needs_person" | "resolved";
  at: string;
  packageId?: string;
};

const ago = (iso: string) => {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

/** Seeded support history + live demo conversations (web + WhatsApp). */
export function ConversationsPanel({ tickets, customers }: { tickets: SupportTicket[]; customers: Customer[] }) {
  const state = useDemoStore();
  const nameOf = (id: string) => {
    const c = customers.find((x) => x.id === id);
    return c ? `${c.firstName} ${c.lastName}` : id;
  };

  const live: Row[] = state.conversations.map((c) => ({
    id: c.id,
    customerName: nameOf(c.customerId),
    channel: c.channel === "whatsapp" ? "WhatsApp" : "Web chat",
    preview: [...c.messages].reverse().find((m) => m.author === "customer")?.text ?? "",
    status: c.escalated ? "needs_person" : "live",
    at: c.updatedAt,
    packageId: c.packageId,
  }));
  const seeded: Row[] = tickets.map((t) => ({
    id: t.id,
    customerName: nameOf(t.customerId),
    channel: t.channel === "whatsapp" ? "WhatsApp" : "Web chat",
    preview: t.messages.filter((m) => m.author === "customer").at(-1)?.text ?? t.subject,
    status: t.status === "resolved" ? "resolved" : "needs_person",
    at: t.createdAt,
    packageId: t.packageId,
  }));
  const rows = [...live, ...seeded];

  return (
    <div className="rounded-2xl bg-white ring-1 ring-[#e3e7ec]">
      <div className="flex items-center justify-between border-b border-[#e3e7ec] px-5 py-4">
        <h2 className="text-lg font-extrabold">Customer conversations</h2>
        {live.length > 0 && (
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-800">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden /> {live.length} live
          </span>
        )}
      </div>
      <ul className="divide-y divide-[#eef1f4]">
        {rows.map((r) => {
          const inner = (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="font-bold">
                  {r.customerName} <span className="font-medium text-ink-mute">· {r.channel}</span>
                </p>
                <Badge status={r.status} />
              </div>
              <p className="mt-1 truncate text-ink-soft">&ldquo;{r.preview}&rdquo;</p>
              <p className="mt-0.5 text-xs text-ink-mute">{ago(r.at)}</p>
            </>
          );
          return (
            <li key={r.id}>
              {r.packageId ? (
                <Link href={`/admin/packages/${r.packageId}`} className="block px-5 py-3.5 hover:bg-[#f7f9fa]">
                  {inner}
                </Link>
              ) : (
                <div className="px-5 py-3.5">{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const BADGE: Record<Row["status"], { cls: string; label: string }> = {
  live: { cls: "bg-emerald-50 text-emerald-800", label: "● Live · AI answering" },
  needs_person: { cls: "bg-coral-50 text-coral-700", label: "⚑ Needs a person" },
  resolved: { cls: "bg-[#eef1f4] text-ink-soft", label: "✓ Resolved" },
};

function Badge({ status }: { status: Row["status"] }) {
  const b = BADGE[status];
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${b.cls}`}>{b.label}</span>;
}
