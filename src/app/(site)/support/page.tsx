"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CustomerView } from "@/components/customer/CustomerView";
import { Btn, OpsPage } from "@/components/ops/OpsPage";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Live } from "@/components/ui/Live";
import { Pill } from "@/components/ui/Pill";
import { Section, StatTile } from "@/components/ui/Section";
import { Ago, fmtDateTime } from "@/components/ui/Time";
import { useAction } from "@/components/ui/Toast";
import type { SupportTicket } from "@/domain/types";
import * as svc from "@/services";

const STATUS: Record<SupportTicket["status"], { label: string; icon: string; tone: "bad" | "warn" | "good" | "done" }> = {
  open: { label: "Open", icon: "●", tone: "bad" },
  waiting_on_staff: { label: "Waiting on us", icon: "⏳", tone: "bad" },
  waiting_on_customer: { label: "Waiting on customer", icon: "↩", tone: "warn" },
  resolved: { label: "Resolved", icon: "✓", tone: "done" },
};
const PRIORITY = { urgent: "bad", high: "warn", normal: "neutral" } as const;

export default function SupportPage() {
  return (
    <Suspense>
      <Live>{() => (svc.getSession().role === "customer" ? <CustomerSupport /> : <StaffSupport />)}</Live>
    </Suspense>
  );
}

function Thread({ t }: { t: SupportTicket }) {
  return (
    <ol className="max-h-80 space-y-2 overflow-y-auto">
      {t.messages.map((m) => (
        <li key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 ${m.author === "customer" ? "bg-[#eef1f4]" : m.author === "staff" ? "ml-auto bg-sea-50" : "ml-auto bg-sun-50"}`}>
          <p className="text-xs font-bold text-ink-mute">{m.author === "customer" ? "Customer" : m.author === "staff" ? m.staffName ?? "The Link team" : "Link Assistant (AI)"} · {fmtDateTime(m.at)}</p>
          <p className="whitespace-pre-line">{m.text}</p>
        </li>
      ))}
    </ol>
  );
}

function CustomerSupport() {
  const run = useAction();
  const [open, setOpen] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [msg, setMsg] = useState("");
  return (
    <CustomerView title="Get help">
      {(me, actor) => {
        const list = svc.listTickets({ customerId: me.id });
        const t = list.find((x) => x.id === open) ?? list[0];
        return (
          <div className="space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div><h1 className="text-4xl font-black tracking-tight sm:text-5xl">Help requests</h1><p className="mt-1 text-xl text-ink-soft">Talk to a real person at The Link.</p></div>
              <div className="flex gap-2"><ButtonLink href="/assistant" variant="secondary" size="md" icon="🤖">Ask Link Assistant</ButtonLink><ButtonLink href="/whatsapp-demo" variant="whatsapp" size="md" icon="💬">WhatsApp</ButtonLink></div>
            </header>
            <div className="grid gap-5 lg:grid-cols-[1fr_1.3fr]">
              <div className="space-y-4">
                <form className="space-y-3 rounded-2xl bg-white p-5 ring-1 ring-sand-200" onSubmit={(e) => { e.preventDefault(); const r = run(() => svc.createTicket(actor, { customerId: me.id, channel: "web", subject, message: msg }), (x) => `Sent — request ${x.id}. We usually reply within 15 minutes during opening hours.`); if (r) { setSubject(""); setMsg(""); setOpen(r.id); } }}>
                  <p className="text-lg font-extrabold">New request</p>
                  <Field label="What's it about?"><Input required value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. My package hasn't moved" /></Field>
                  <Field label="Message"><Textarea required rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} /></Field>
                  <button className="min-h-12 w-full rounded-xl bg-sea-600 font-bold text-white">Send to a person</button>
                </form>
                <ul className="space-y-2">
                  {list.map((x) => (
                    <li key={x.id}><button onClick={() => setOpen(x.id)} className={`flex w-full items-center justify-between gap-2 rounded-2xl bg-white p-4 text-left ring-1 ${t?.id === x.id ? "ring-sea-500" : "ring-sand-200"}`}><span><span className="block font-bold">{x.subject}</span><span className="text-sm text-ink-mute">{x.id} · <Ago iso={x.createdAt} /></span></span><Pill tone={STATUS[x.status].tone} icon={STATUS[x.status].icon}>{x.status === "waiting_on_staff" ? "We're on it" : x.status === "waiting_on_customer" ? "Reply needed" : STATUS[x.status].label}</Pill></button></li>
                  ))}
                </ul>
              </div>
              {t ? (
                <Section title={`${t.subject} · ${t.id}`}>
                  <Thread t={t} />
                  {t.status !== "resolved" && (
                    <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (run(() => svc.replyTicket(actor, t.id, text), "Sent.")) setText(""); }}>
                      <label htmlFor="rep" className="sr-only">Reply</label>
                      <Input id="rep" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write a reply…" required />
                      <Btn type="submit" tone="sea">Send</Btn>
                    </form>
                  )}
                </Section>
              ) : <EmptyState icon="🎧" title="No requests yet">Ask Link Assistant first — it can answer most questions instantly.</EmptyState>}
            </div>
          </div>
        );
      }}
    </CustomerView>
  );
}

function StaffSupport() {
  const sp = useSearchParams();
  const run = useAction();
  const actor = svc.currentActor();
  const [filter, setFilter] = useState<"open" | "mine" | "ai" | "resolved">("open");
  const [open, setOpen] = useState<string | null>(sp.get("open"));
  const [text, setText] = useState("");
  const all = svc.listTickets();
  const list = all.filter((t) => (filter === "open" ? t.status !== "resolved" : filter === "resolved" ? t.status === "resolved" : filter === "mine" ? t.assignee === actor.name && t.status !== "resolved" : t.createdBy === "ai"));
  const t = all.find((x) => x.id === open) ?? list[0];
  const convs = svc.analytics().support;
  const agents = svc.listStaffNames();
  return (
    <OpsPage title="Support" sub="Every customer conversation — web, WhatsApp and phone — in one queue.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon="⏳" label="Customers waiting" value={all.filter((x) => x.status === "waiting_on_staff").length} tone="alert" />
        <StatTile icon="🤖" label="Opened by AI" value={all.filter((x) => x.createdBy === "ai").length} />
        <StatTile icon="✓" label="AI resolution rate" value={`${convs.aiResolutionRate}%`} sub={`${convs.conversations} conversations`} />
        <StatTile icon="⏱" label="Avg resolution" value={`${convs.avgResolutionHours}h`} />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(["open", "mine", "ai", "resolved"] as const).map((f) => <button key={f} onClick={() => setFilter(f)} aria-pressed={filter === f} className={`min-h-10 rounded-full px-3.5 text-sm font-bold ring-1 ${filter === f ? "bg-ink text-white ring-ink" : "bg-white ring-[#e3e7ec]"}`}>{{ open: "Open", mine: "Assigned to me", ai: "Created by AI", resolved: "Resolved" }[f]}</button>)}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
        <Section title={`${list.length} tickets`} pad={false}>
          <ul className="divide-y divide-[#eef1f4]">
            {list.map((x) => (
              <li key={x.id}>
                <button onClick={() => setOpen(x.id)} className={`w-full px-5 py-3 text-left hover:bg-[#f7f9fa] ${t?.id === x.id ? "bg-sea-50/60" : ""}`}>
                  <span className="flex flex-wrap items-center justify-between gap-2"><span className="font-bold">{x.subject}</span><Pill tone={STATUS[x.status].tone} icon={STATUS[x.status].icon}>{STATUS[x.status].label}</Pill></span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-ink-soft">{svc.customerName(svc.findCustomer(x.customerId))} · {x.channel} · <Ago iso={x.createdAt} /> <Pill tone={PRIORITY[x.priority]}>{x.priority}</Pill>{x.createdBy === "ai" && <Pill tone="good" icon="🤖">AI</Pill>}{x.assignee && <span>· {x.assignee}</span>}</span>
                </button>
              </li>
            ))}
            {!list.length && <li className="p-5 text-ink-mute">Nothing in this view. 🎉</li>}
          </ul>
        </Section>
        {t && (
          <Section title={<span>{t.subject} <span className="font-mono text-sm text-ink-mute">{t.id}</span></span>} action={<Link href={`/customers/${t.customerId}`} className="text-sm font-bold text-sea-700">Customer 360 →</Link>}>
            <div className="mb-3 flex flex-wrap gap-2 text-sm">
              <Pill tone={PRIORITY[t.priority]}>{t.priority}</Pill>
              {t.packageId && <Link href={`/warehouse/packages/${t.packageId}`} className="font-bold text-sea-700 underline">{t.packageId}</Link>}
              {t.shipmentId && <Link href={`/customs/${t.shipmentId}`} className="font-bold text-sea-700 underline">{t.shipmentId}</Link>}
              {t.billId && <Link href={`/accounting/bills/${t.billId}`} className="font-bold text-sea-700 underline">{t.billId}</Link>}
            </div>
            <Thread t={t} />
            {(() => {
              const conv = svc.getConversation(t.customerId, t.channel === "whatsapp" ? "whatsapp" : "web");
              return conv ? (
                <details className="mt-3 rounded-xl bg-[#f7f9fa] p-3 text-sm">
                  <summary className="cursor-pointer font-bold">🤖 Assistant conversation before hand-off ({conv.messages.length})</summary>
                  <ol className="mt-2 space-y-1">{conv.messages.slice(-8).map((m) => <li key={m.id}><strong>{m.author === "customer" ? "Customer" : m.author === "staff" ? m.staffName : "AI"}:</strong> {m.text}</li>)}</ol>
                </details>
              ) : null;
            })()}
            {t.status !== "resolved" && (
              <>
                <form className="mt-4 space-y-2" onSubmit={(e) => { e.preventDefault(); if (run(() => svc.replyTicket(actor, t.id, text), `Reply sent${t.channel === "whatsapp" ? " to WhatsApp (demo)" : ""}.`)) setText(""); }}>
                  <label htmlFor="reply" className="sr-only">Reply</label>
                  <Textarea id="reply" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder={`Reply to ${svc.findCustomer(t.customerId)?.firstName}…`} required />
                  <div className="flex flex-wrap gap-2">
                    <Btn type="submit" tone="sea">Reply</Btn>
                    <Select aria-label="Assign" className="!min-h-11 !w-auto" value={t.assignee ?? ""} onChange={(e) => e.target.value && run(() => svc.assignTicket(actor, t.id, e.target.value), `Assigned to ${e.target.value}`)}>
                      <option value="">Assign…</option>
                      {agents.map((a) => <option key={a}>{a}</option>)}
                    </Select>
                    <Btn tone="light" onClick={() => run(() => svc.escalateTicket(actor, t.id), "Escalated to urgent.")}>⚑ Escalate</Btn>
                    <Btn tone="light" onClick={() => run(() => svc.resolveTicket(actor, t.id), "Resolved.")}>✓ Resolve</Btn>
                  </div>
                </form>
              </>
            )}
          </Section>
        )}
      </div>
    </OpsPage>
  );
}
