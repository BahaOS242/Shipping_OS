"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { CustomerView } from "@/components/customer/CustomerView";
import { ClaimPill } from "@/components/domain/Status";
import { OpsPage } from "@/components/ops/OpsPage";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Select, Textarea } from "@/components/ui/Field";
import { Live } from "@/components/ui/Live";
import { Modal } from "@/components/ui/Modal";
import { Section, StatTile } from "@/components/ui/Section";
import { Ago, fmtDate, fmtDateTime } from "@/components/ui/Time";
import { useAction } from "@/components/ui/Toast";
import { PhotoTile } from "@/components/ui/Visuals";
import { CLAIM_COPY, CLAIM_REASON, TEAM_LABEL } from "@/domain/copy";
import type { ClaimStatus } from "@/domain/types";
import * as svc from "@/services";

export default function ClaimsPage() {
  return (
    <Suspense>
      <Live>{() => (svc.getSession().role === "customer" ? <CustomerClaims /> : <StaffClaims />)}</Live>
    </Suspense>
  );
}

function CustomerClaims() {
  const sp = useSearchParams();
  const run = useAction();
  const [open, setOpen] = useState<string | null>(sp.get("open"));
  const [reply, setReply] = useState("");
  return (
    <CustomerView title="My Claims">
      {(me, actor) => {
        const list = svc.listClaims({ customerId: me.id });
        const c = open ? list.find((x) => x.id === open) : undefined;
        return (
          <div className="space-y-6">
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Problems &amp; claims</h1>
                <p className="mt-1 text-xl text-ink-soft">Something wrong? Tell us and we&apos;ll make it right.</p>
              </div>
              <ButtonLink href="/claims/new" icon="🛟">Report a problem</ButtonLink>
            </header>
            {!list.length ? <EmptyState icon="🛟" title="No claims" action={<ButtonLink href="/claims/new">Report a problem</ButtonLink>}>We hope it stays that way!</EmptyState> : (
              <ul className="space-y-3">
                {list.map((x) => (
                  <li key={x.id}>
                    <button onClick={() => setOpen(x.id)} className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 text-left ring-1 ring-sand-200 hover:ring-sea-400">
                      <span><span className="block text-lg font-extrabold">{CLAIM_REASON[x.reason].icon} {CLAIM_REASON[x.reason].label}</span><span className="text-ink-soft">{x.id} · {fmtDate(x.createdAt)}{x.packageId ? ` · ${x.packageId}` : ""}</span></span>
                      <ClaimPill status={x.status} size="md" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <Modal open={!!c} onClose={() => setOpen(null)} title={c ? `Claim ${c.id}` : ""}>
              {c && (
                <div className="space-y-4">
                  <ClaimPill status={c.status} size="md" />
                  <p className="text-lg">&ldquo;{c.description}&rdquo;</p>
                  {c.photos.length > 0 && <div className="grid grid-cols-3 gap-2">{c.photos.map((p) => <PhotoTile key={p} id={p} damaged />)}</div>}
                  <ol className="space-y-2">
                    {c.updates.map((u, i) => <li key={i} className="rounded-xl bg-sand-50 p-3"><p className="text-sm font-bold">{u.by} · {fmtDateTime(u.at)}</p><p>{u.text}</p></li>)}
                  </ol>
                  {!["resolved", "rejected"].includes(c.status) && (
                    <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (run(() => svc.customerClaimReply(actor, c.id, reply), "Sent.")) setReply(""); }}>
                      <Field label="Add a message"><Textarea rows={3} value={reply} onChange={(e) => setReply(e.target.value)} required /></Field>
                      <button className="min-h-12 w-full rounded-xl bg-sea-600 font-bold text-white">Send</button>
                    </form>
                  )}
                </div>
              )}
            </Modal>
          </div>
        );
      }}
    </CustomerView>
  );
}

const STATUSES: ClaimStatus[] = ["submitted", "under_review", "waiting_for_customer", "resolved", "rejected"];

function StaffClaims() {
  const sp = useSearchParams();
  const run = useAction();
  const [status, setStatus] = useState<ClaimStatus | "open" | "all">("open");
  const [open, setOpen] = useState<string | null>(sp.get("open"));
  const [next, setNext] = useState<ClaimStatus>("under_review");
  const [msg, setMsg] = useState("");
  const actor = svc.currentActor();
  const all = svc.listClaims();
  const list = svc.listClaims({ status: status === "all" ? undefined : status });
  const c = open ? all.find((x) => x.id === open) : undefined;
  return (
    <OpsPage title="Claims" sub="Damaged, missing, billing and delivery problems.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {STATUSES.slice(0, 4).map((s) => <StatTile key={s} icon={CLAIM_COPY[s].icon} label={CLAIM_COPY[s].label} value={all.filter((x) => x.status === s).length} />)}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(["open", ...STATUSES, "all"] as const).map((s) => (
          <button key={s} onClick={() => setStatus(s)} aria-pressed={status === s} className={`min-h-10 rounded-full px-3.5 text-sm font-bold ring-1 ${status === s ? "bg-ink text-white ring-ink" : "bg-white ring-[#e3e7ec]"}`}>{s === "open" ? "Open" : s === "all" ? "All" : CLAIM_COPY[s].label}</button>
        ))}
      </div>
      <Section title={`${list.length} claims`} pad={false}>
        {!list.length ? <p className="p-5 text-ink-mute">Nothing here.</p> : (
          <ul className="divide-y divide-[#eef1f4]">
            {list.map((x) => (
              <li key={x.id}>
                <button onClick={() => { setOpen(x.id); setNext(x.status === "submitted" ? "under_review" : x.status); }} className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-3 text-left hover:bg-[#f7f9fa]">
                  <span className="min-w-0">
                    <span className="block font-bold">{x.id} · {CLAIM_REASON[x.reason].label}</span>
                    <span className="block truncate text-sm text-ink-soft">{svc.customerName(svc.findCustomer(x.customerId))} · {x.packageId ?? x.shipmentId ?? x.billId ?? "—"} · team {TEAM_LABEL[x.team]} · <Ago iso={x.createdAt} /></span>
                  </span>
                  <ClaimPill status={x.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Modal open={!!c} onClose={() => setOpen(null)} title={c ? `Claim ${c.id}` : ""} wide>
        {c && (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3">
              <ClaimPill status={c.status} size="md" />
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-ink-mute">Customer</dt><dd><Link className="font-bold text-sea-700 underline" href={`/customers/${c.customerId}`}>{svc.customerName(svc.findCustomer(c.customerId))}</Link></dd>
                <dt className="text-ink-mute">Reason</dt><dd className="font-bold">{CLAIM_REASON[c.reason].label}</dd>
                {c.packageId && (<><dt className="text-ink-mute">Package</dt><dd><Link className="font-bold text-sea-700 underline" href={`/warehouse/packages/${c.packageId}`}>{c.packageId}</Link></dd></>)}
                {c.shipmentId && (<><dt className="text-ink-mute">Shipment</dt><dd><Link className="font-bold text-sea-700 underline" href={`/customs/${c.shipmentId}`}>{c.shipmentId}</Link></dd></>)}
                {c.billId && (<><dt className="text-ink-mute">Invoice</dt><dd><Link className="font-bold text-sea-700 underline" href={`/accounting/bills/${c.billId}`}>{c.billId}</Link></dd></>)}
                <dt className="text-ink-mute">Team</dt><dd className="font-bold">{TEAM_LABEL[c.team]}</dd>
              </dl>
              <p className="rounded-xl bg-[#f7f9fa] p-3">&ldquo;{c.description}&rdquo;</p>
              {c.photos.length > 0 && <div className="grid grid-cols-3 gap-2">{c.photos.map((p) => <PhotoTile key={p} id={p} damaged />)}</div>}
              {c.resolution && <p className="rounded-xl bg-emerald-50 p-3 text-emerald-900"><strong>Resolution:</strong> {c.resolution}</p>}
            </div>
            <div className="space-y-3">
              <ol className="max-h-60 space-y-2 overflow-y-auto">
                {c.updates.map((u, i) => <li key={i} className="rounded-xl bg-[#f7f9fa] p-3 text-sm"><p className="font-bold">{u.by} · {fmtDateTime(u.at)}</p><p>{u.text}</p></li>)}
                {!c.updates.length && <li className="text-ink-mute">No updates yet.</li>}
              </ol>
              <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); if (run(() => svc.updateClaim(actor, c.id, next, msg), "Claim updated — customer notified.")) setMsg(""); }}>
                <Field label="Status"><Select value={next} onChange={(e) => setNext(e.target.value as ClaimStatus)}>{STATUSES.map((s) => <option key={s} value={s}>{CLAIM_COPY[s].label}</option>)}</Select></Field>
                <Field label="Message to customer"><Textarea rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} required /></Field>
                <button className="min-h-12 w-full rounded-xl bg-ink font-bold text-white">Save &amp; notify customer</button>
              </form>
            </div>
          </div>
        )}
      </Modal>
    </OpsPage>
  );
}
