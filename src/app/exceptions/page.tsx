"use client";

import { useLive } from "@/data/useLive";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Activity } from "@/components/domain/Activity";
import { ExStatusPill, SeverityPill } from "@/components/domain/Status";
import { BillLink, CustomerLink, PackageLink, ReceiptLink, ShipmentLink } from "@/components/ops/Links";
import { Btn, OpsPage } from "@/components/ops/OpsPage";
import { Field, Input, Select } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Section } from "@/components/ui/Section";
import { Ago, fmtDateTime } from "@/components/ui/Time";
import { useAction } from "@/components/ui/Toast";
import { EXCEPTION_CATALOG, EXCEPTION_STATUS_COPY, SEVERITY_COPY, TEAM_LABEL } from "@/domain/copy";
import type { ExceptionStatus, ExceptionType, Severity, Team } from "@/domain/types";
import * as svc from "@/services";

const ROLE_TEAM: Record<string, Team | undefined> = { warehouse: "warehouse", customs: "customs", accounting: "accounting", support: "support" };

export default function ExceptionsPage() {
  useLive();
  return <Suspense><Center /></Suspense>;
}

function Center() {
  useLive();
  const sp = useSearchParams();
  const run = useAction();
  const actor = svc.currentActor();
  const [team, setTeam] = useState<Team | "">((sp.get("team") as Team) ?? ROLE_TEAM[actor.role] ?? "");
  const [severity, setSeverity] = useState<Severity | "">("");
  const [type, setType] = useState<ExceptionType | "">("");
  const [status, setStatus] = useState<ExceptionStatus | "active" | "">("active");
  const [since, setSince] = useState<number | "">("");
  const [open, setOpen] = useState<string | null>(sp.get("open"));
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [assignee, setAssignee] = useState("");

  const list = svc.listExceptions({ team: team || undefined, severity: severity || undefined, type: type || undefined, status: status || undefined, sinceDays: since || undefined });
  const active = svc.listExceptions({ status: "active" });
  const e = open ? svc.listExceptions().find((x) => x.id === open) : undefined;
  const byTeam = (t: Team) => active.filter((x) => x.team === t).length;

  return (
    <OpsPage title={`${active.length} things need attention`} sub="Exception Center — every problem, linked to the real package, shipment, customer or bill.">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {(["warehouse", "customs", "accounting", "support", "delivery", "management"] as Team[]).map((t) => (
          <button key={t} onClick={() => setTeam(team === t ? "" : t)} aria-pressed={team === t} className={`rounded-2xl p-4 text-left ring-1 transition ${team === t ? "bg-ink text-white ring-ink" : "bg-white ring-[#e3e7ec] hover:ring-sea-400"}`}>
            <p className="text-sm font-bold opacity-80">{TEAM_LABEL[t]}</p>
            <p className="text-3xl font-black">{byTeam(t)}</p>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Field label="Team"><Select value={team} onChange={(x) => setTeam(x.target.value as Team)}><option value="">All teams</option>{Object.entries(TEAM_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
        <Field label="Severity"><Select value={severity} onChange={(x) => setSeverity(x.target.value as Severity)}><option value="">Any</option>{Object.entries(SEVERITY_COPY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
        <Field label="Type"><Select value={type} onChange={(x) => setType(x.target.value as ExceptionType)}><option value="">Any type</option>{Object.entries(EXCEPTION_CATALOG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
        <Field label="Status"><Select value={status} onChange={(x) => setStatus(x.target.value as ExceptionStatus)}><option value="active">Needs attention</option><option value="">All</option>{Object.entries(EXCEPTION_STATUS_COPY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></Field>
        <Field label="Date"><Select value={since} onChange={(x) => setSince(Number(x.target.value) || "")}><option value="">Any time</option><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></Select></Field>
      </div>
      <Section title={`${list.length} exceptions`} pad={false}>
        {!list.length ? <p className="p-5 text-ink-mute">Nothing matches. 🎉</p> : (
          <ul className="divide-y divide-[#eef1f4]">
            {list.map((x) => (
              <li key={x.id}>
                <button onClick={() => { setOpen(x.id); setAssignee(x.assignee ?? ""); }} className="grid w-full gap-1 px-5 py-3 text-left hover:bg-[#f7f9fa] md:grid-cols-[auto_1fr_auto] md:items-center md:gap-4">
                  <span className="flex items-center gap-2"><SeverityPill severity={x.severity} /><span className="font-mono text-xs text-ink-mute">{x.id}</span></span>
                  <span className="min-w-0"><span className="block font-bold">{EXCEPTION_CATALOG[x.type].icon} {x.title} <span className="font-normal text-ink-mute">· {TEAM_LABEL[x.team]}</span></span><span className="block truncate text-sm text-ink-soft">{x.detail}</span><span className="text-xs text-ink-mute">{svc.customerName(svc.findCustomer(x.customerId))} · {x.packageId ?? x.shipmentId ?? x.billId ?? ""} · <Ago iso={x.createdAt} />{x.assignee && ` · 👤 ${x.assignee}`}{x.source === "ai" && " · 🤖 AI"}</span></span>
                  <ExStatusPill status={x.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Modal open={!!e} onClose={() => setOpen(null)} title={e ? `${EXCEPTION_CATALOG[e.type].icon} ${e.title}` : ""} wide>
        {e && (
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2"><SeverityPill severity={e.severity} size="md" /><ExStatusPill status={e.status} size="md" /></div>
              <p className="text-lg">{e.detail}</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-ink-mute">ID / type</dt><dd className="font-mono">{e.id} · {e.type}</dd>
                <dt className="text-ink-mute">Customer</dt><dd><CustomerLink id={e.customerId} /></dd>
                {e.packageId && (<><dt className="text-ink-mute">Package</dt><dd><PackageLink id={e.packageId} /></dd></>)}
                {e.shipmentId && (<><dt className="text-ink-mute">Shipment</dt><dd><ShipmentLink id={e.shipmentId} /></dd></>)}
                {e.billId && (<><dt className="text-ink-mute">Bill</dt><dd><BillLink id={e.billId} /></dd></>)}
                {e.purchaseInvoiceId && (<><dt className="text-ink-mute">Invoice</dt><dd><ReceiptLink id={e.purchaseInvoiceId} /></dd></>)}
                <dt className="text-ink-mute">Team</dt><dd>{TEAM_LABEL[e.team]}</dd>
                <dt className="text-ink-mute">Created</dt><dd>{fmtDateTime(e.createdAt)} · {e.source}</dd>
                <dt className="text-ink-mute">Assignee</dt><dd>{e.assignee ?? "—"}</dd>
                {e.resolution && (<><dt className="text-ink-mute">Resolution</dt><dd className="font-semibold text-emerald-800">{e.resolution}</dd></>)}
              </dl>
              {e.type === "PROHIBITED_ITEM" && <p className="rounded-xl bg-sun-50 p-3 text-sm font-semibold text-sun-700">AI-generated suggestion. Human review required. This demo does not make legal determinations.</p>}
              <Section title="History"><Activity events={svc.timeline({ exceptionId: e.id })} /></Section>
            </div>
            <div className="space-y-4">
              {svc.isOpen(e) ? (
                <>
                  <div className="flex flex-wrap items-end gap-2">
                    <Field label="Assign to"><Select value={assignee} onChange={(x) => setAssignee(x.target.value)}><option value="">Choose…</option>{svc.listStaffNames().map((n) => <option key={n}>{n}</option>)}</Select></Field>
                    <Btn tone="light" disabled={!assignee} onClick={() => run(() => svc.assignException(actor, e.id, assignee), `Assigned to ${assignee}.`)}>Assign</Btn>
                    <Btn tone="light" onClick={() => run(() => svc.startException(actor, e.id), "Marked in progress.")}>◐ Start</Btn>
                  </div>
                  <form className="flex gap-2" onSubmit={(x) => { x.preventDefault(); if (run(() => svc.noteException(actor, e.id, note), "Note added.")) setNote(""); }}>
                    <Input value={note} onChange={(x) => setNote(x.target.value)} placeholder="Add a note…" required aria-label="Note" />
                    <Btn type="submit" tone="light">Add</Btn>
                  </form>
                  <form className="space-y-2 rounded-2xl bg-emerald-50 p-4" onSubmit={(x) => { x.preventDefault(); if (run(() => svc.resolveException(actor, e.id, resolution), "Resolved — linked records updated.")) setResolution(""); }}>
                    <Field label="How was it resolved?"><Input value={resolution} onChange={(x) => setResolution(x.target.value)} required /></Field>
                    <div className="flex gap-2"><Btn type="submit" tone="sea">✓ Resolve</Btn><Btn tone="light" onClick={() => run(() => svc.dismissException(actor, e.id, resolution || "Not an issue"), "Dismissed.")}>Dismiss</Btn></div>
                  </form>
                </>
              ) : <p className="rounded-2xl bg-[#f7f9fa] p-4 font-semibold">This exception is {e.status}.</p>}
              <div>
                <p className="mb-1 font-bold">Notes</p>
                {!e.notes.length ? <p className="text-ink-mute">No notes.</p> : <ul className="space-y-1.5">{e.notes.map((n, i) => <li key={i} className="rounded-xl bg-[#f7f9fa] p-2 text-sm"><strong>{n.by}</strong> · {fmtDateTime(n.at)}<br />{n.text}</li>)}</ul>}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </OpsPage>
  );
}
