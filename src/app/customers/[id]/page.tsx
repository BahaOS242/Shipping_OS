"use client";

import { useLive } from "@/data/useLive";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState } from "react";
import { Activity } from "@/components/domain/Activity";
import { BillPill, ClaimPill, ExStatusPill, PackagePill, ReceiptPill, ShipmentPill } from "@/components/domain/Status";
import { BillLink, PackageLink, ReceiptLink, ShipmentLink } from "@/components/ops/Links";
import { Btn, OpsPage } from "@/components/ops/OpsPage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { Section, StatTile } from "@/components/ui/Section";
import { fmtDate } from "@/components/ui/Time";
import { useAction } from "@/components/ui/Toast";
import { CLAIM_REASON } from "@/domain/copy";
import { fmtUsd } from "@/domain/rates";
import * as svc from "@/services";

type Tab = "timeline" | "packages" | "money" | "support";

/** Customer 360 — everything about one customer on one screen. */
export default function Customer360({ params }: { params: Promise<{ id: string }> }) {
  useLive();
  const { id } = use(params);
  const run = useAction();
  const router = useRouter();
  const actor = svc.currentActor();
  const [tab, setTab] = useState<Tab>("timeline");
  const [msg, setMsg] = useState(false);
  const [text, setText] = useState("");
  const c = svc.findCustomer(id);
  if (!c) return <EmptyState icon="🔎" title="Customer not found" />;
  const st = svc.customerStats(c.id);
  const pkgs = svc.listPackages({ customerId: c.id });
  const ships = svc.listShipments({ customerId: c.id });
  const bills = svc.listBills({ customerId: c.id });
  const pays = svc.customerBalance(c.id).payments;
  const invs = svc.listPurchaseInvoices({ customerId: c.id });
  const claims = svc.listClaims({ customerId: c.id });
  const tickets = svc.listTickets({ customerId: c.id });
  const issues = svc.listExceptions({ customerId: c.id, status: "active" });
  const convs = (["web", "whatsapp"] as const).map((ch) => svc.getConversation(c.id, ch)).filter(Boolean);

  return (
    <OpsPage
      eyebrow={<Link href="/customers" className="text-sea-700">← Customers</Link>}
      title={svc.customerName(c)}
      sub={`${c.accountNumber} · ${c.type === "business" ? `🏢 Business (${c.firstName} ${c.lastName})` : "Personal"} · ${c.phone} · ${c.email}`}
      actions={<><Btn tone="light" onClick={() => setMsg(true)}>💬 Message on WhatsApp</Btn><Btn tone="light" onClick={() => { svc.switchCustomer(c.id); router.push("/dashboard"); }}>👀 View as customer</Btn></>}
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Customer since" value={fmtDate(c.createdAt, { month: "short", year: "numeric" })} />
        <StatTile label="Packages" value={st.packages} sub={`${st.activePackages} active`} />
        <StatTile label="Shipments" value={st.shipments} />
        <StatTile label="Total spend" value={fmtUsd(st.totalSpend)} sub="paid (demo)" />
        <StatTile label="Avg shipment" value={fmtUsd(st.averageShipment)} />
        <StatTile label="Balance" value={fmtUsd(st.balance)} tone={st.balance ? "alert" : "neutral"} />
        <StatTile label="Prefers" value={st.preferredDestination ? svc.getDestination(st.preferredDestination as never).name : svc.getDestination(c.homeDestination).name} sub={st.preferredService ?? c.preferredService} />
        <StatTile label="Open issues" value={st.openIssues} tone={st.openIssues ? "alert" : "good"} />
      </div>

      {issues.length > 0 && (
        <Section title="⚠ Current issues">
          <ul className="space-y-2">{issues.map((e) => <li key={e.id}><Link href={`/exceptions?open=${e.id}`} className="flex flex-wrap items-center gap-2"><ExStatusPill status={e.status} /> <strong>{e.title}</strong> <span className="text-ink-soft">— {e.detail}</span></Link></li>)}</ul>
        </Section>
      )}

      <nav className="flex flex-wrap gap-1.5">
        {([["timeline", "Customer timeline"], ["packages", `Packages & shipments (${pkgs.length})`], ["money", `Invoices & payments (${bills.length})`], ["support", `Claims & support (${claims.length + tickets.length})`]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} className={`min-h-10 rounded-full px-3.5 text-sm font-bold ring-1 ${tab === k ? "bg-ink text-white ring-ink" : "bg-white ring-[#e3e7ec]"}`}>{l}</button>
        ))}
      </nav>

      {tab === "timeline" && <Section title="Everything that happened (audit + communication)"><Activity events={svc.timeline({ customerId: c.id })} /></Section>}
      {tab === "packages" && (
        <div className="grid gap-5 xl:grid-cols-2">
          <Section title="Packages" pad={false}><ul className="divide-y divide-[#eef1f4]">{pkgs.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm"><span><PackageLink id={p.id} /> · {p.merchant} — {p.itemName}</span><PackagePill status={p.status} staff /></li>)}</ul></Section>
          <Section title="Shipments" pad={false}><ul className="divide-y divide-[#eef1f4]">{ships.map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm"><span><ShipmentLink id={s.id} /> · {s.packageIds.length} pcs · {s.service}</span><ShipmentPill status={s.status} staff /></li>)}{!ships.length && <li className="px-5 py-3 text-ink-mute">None</li>}</ul></Section>
        </div>
      )}
      {tab === "money" && (
        <div className="grid gap-5 xl:grid-cols-3">
          <Section title="Bills" pad={false}><ul className="divide-y divide-[#eef1f4]">{bills.map((b) => <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm"><span><BillLink id={b.id} /> · {fmtUsd(b.total)}</span><BillPill status={b.status} /></li>)}</ul></Section>
          <Section title="Payments" pad={false}><ul className="divide-y divide-[#eef1f4]">{pays.map((p) => <li key={p.id} className="px-5 py-2.5 text-sm"><strong className="font-mono">{p.id}</strong> · {fmtUsd(p.amount)} · {p.method} · {p.billId ?? "unmatched"}</li>)}{!pays.length && <li className="px-5 py-3 text-ink-mute">None</li>}</ul></Section>
          <Section title="Store invoices" pad={false}><ul className="divide-y divide-[#eef1f4]">{invs.map((i) => <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm"><span><ReceiptLink id={i.id} /> · {i.merchant}</span><ReceiptPill status={i.status} /></li>)}</ul></Section>
        </div>
      )}
      {tab === "support" && (
        <div className="grid gap-5 xl:grid-cols-3">
          <Section title="Claims" pad={false}><ul className="divide-y divide-[#eef1f4]">{claims.map((x) => <li key={x.id}><Link href={`/claims?open=${x.id}`} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 text-sm"><span className="font-mono font-bold">{x.id}</span> {CLAIM_REASON[x.reason].label}<ClaimPill status={x.status} /></Link></li>)}{!claims.length && <li className="px-5 py-3 text-ink-mute">None</li>}</ul></Section>
          <Section title="Support tickets" pad={false}><ul className="divide-y divide-[#eef1f4]">{tickets.map((t) => <li key={t.id}><Link href={`/support?open=${t.id}`} className="block px-5 py-2.5 text-sm"><span className="font-mono font-bold">{t.id}</span> {t.subject} <Pill tone={t.status === "resolved" ? "done" : "warn"}>{t.status.replace(/_/g, " ")}</Pill>{t.createdBy === "ai" && <Pill tone="good">🤖 AI</Pill>}</Link></li>)}{!tickets.length && <li className="px-5 py-3 text-ink-mute">None</li>}</ul></Section>
          <Section title="Conversations (AI & WhatsApp)">
            {!convs.length ? <p className="text-ink-mute">None.</p> : convs.map((cv) => (
              <div key={cv!.id} className="mb-3">
                <p className="text-xs font-bold uppercase text-ink-mute">{cv!.channel}{cv!.escalated ? " · escalated to a person" : ""}</p>
                <ol className="mt-1 max-h-48 space-y-1 overflow-y-auto text-sm">{cv!.messages.slice(-8).map((m) => <li key={m.id}><strong>{m.author === "customer" ? "Customer" : m.author === "staff" ? m.staffName : "AI"}:</strong> {m.text}</li>)}</ol>
              </div>
            ))}
          </Section>
        </div>
      )}
      <Modal open={msg} onClose={() => setMsg(false)} title={`Message ${c.firstName} on WhatsApp (simulated)`}>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (run(() => svc.staffMessage(actor, c.id, text), "Sent — it appears in their WhatsApp thread.")) { setText(""); setMsg(false); } }}>
          <Textarea rows={4} required value={text} onChange={(e) => setText(e.target.value)} placeholder={`Hi ${c.firstName}, this is ${actor.name.split(" ")[0]} from The Link…`} aria-label="Message" />
          <Btn type="submit" tone="sea">Send</Btn>
        </form>
      </Modal>
    </OpsPage>
  );
}
