"use client";

import { useLive } from "@/data/useLive";
import Link from "next/link";
import { use, useState } from "react";
import { Activity } from "@/components/domain/Activity";
import { CustomsPill, ExStatusPill, ShipmentPill } from "@/components/domain/Status";
import { CustomsPacketView, downloadPacket } from "@/components/ops/CustomsPacket";
import { CustomerLink, PackageLink, ReceiptLink } from "@/components/ops/Links";
import { Btn, OpsPage } from "@/components/ops/OpsPage";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Section } from "@/components/ui/Section";
import { useAction } from "@/components/ui/Toast";
import * as svc from "@/services";

type M = null | "review" | "flag" | "escalate" | "approve";

export default function CustomsShipmentPage({ params }: { params: Promise<{ id: string }> }) {
  useLive();
  const { id } = use(params);
  const run = useAction();
  const actor = svc.currentActor();
  const [modal, setModal] = useState<M>(null);
  const [text, setText] = useState("");
  const sh = svc.findShipment(id);
  if (!sh) return <EmptyState icon="🔎" title={`No shipment ${id}`} />;
  const pk = svc.customsPacket(sh.id);
  const ex = svc.listExceptions({ shipmentId: sh.id }).concat(...sh.packageIds.map((pid) => svc.listExceptions({ packageId: pid })));
  const reviewable = ["awaiting_customs", "cleared"].includes(sh.status);
  const submit = (fn: () => unknown, ok: string) => { if (run(fn, ok) !== undefined) { setModal(null); setText(""); } };

  return (
    <OpsPage
      eyebrow={<Link href="/customs" className="text-sea-700">← Customs</Link>}
      title={<span className="font-mono">{sh.id}</span>}
      sub={<span className="flex flex-wrap items-center gap-2"><CustomerLink id={sh.customerId} /> · {svc.getDestination(sh.destinationId).name} · {sh.service} <CustomsPill status={sh.customs.status} /> <ShipmentPill status={sh.status} staff /></span>}
      actions={
        <>
          <Btn tone="light" onClick={() => downloadPacket(pk)}>⬇ Download Demo Packet</Btn>
          {reviewable && sh.customs.status !== "approved" && (
            <>
              <Btn tone="light" onClick={() => run(() => svc.markPacketReviewed(actor, sh.id), "Packet marked reviewed.")}>✓ Mark Reviewed</Btn>
              <Btn tone="light" onClick={() => setModal("review")}>📋 Request Review</Btn>
              <Btn tone="light" onClick={() => setModal("flag")}>⚑ Flag</Btn>
              <Btn tone="danger" onClick={() => setModal("escalate")}>⬆ Escalate</Btn>
              <Btn tone="sea" onClick={() => setModal("approve")}>✓ Approve</Btn>
            </>
          )}
        </>
      }
    >
      <p className="rounded-2xl bg-sun-50 p-3 text-sm font-semibold text-sun-700 ring-1 ring-sun-300">{svc.CUSTOMS_DISCLAIMER} AI item categories and flags are suggestions only.</p>
      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        <Section title="Customs packet (preview)" action={sh.customs.packetReviewedBy ? <span className="text-sm font-bold text-emerald-800">✓ Reviewed by {sh.customs.packetReviewedBy}</span> : undefined}>
          <CustomsPacketView p={pk} />
        </Section>
        <div className="space-y-5">
          <Section title="Packages & documents">
            <ul className="space-y-2">
              {pk.lines.map((l) => (
                <li key={l.package.id} className="rounded-xl bg-[#f7f9fa] p-3 text-sm">
                  <PackageLink id={l.package.id} /> · {l.merchant}
                  <span className="block">{l.invoice ? <>🧾 <ReceiptLink id={l.invoice.id} /> · {Math.round(l.invoice.confidence * 100)}% confidence · {l.invoice.status}</> : <span className="font-bold text-coral-700">🧾 Missing invoice</span>}</span>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Flags & exceptions">
            {!ex.length && !sh.customs.flags.length ? <p className="text-ink-mute">None.</p> : (
              <ul className="space-y-2 text-sm">
                {sh.customs.flags.map((f) => <li key={f} className="font-semibold text-coral-700">⚑ {f}</li>)}
                {ex.map((e) => <li key={e.id}><Link href={`/exceptions?open=${e.id}`} className="flex flex-wrap items-center gap-2"><ExStatusPill status={e.status} /> {e.title} <span className="font-mono text-ink-mute">{e.id}</span></Link></li>)}
              </ul>
            )}
            {sh.customs.notes.length > 0 && <ul className="mt-3 space-y-1 text-sm text-ink-soft">{sh.customs.notes.map((n, i) => <li key={i}>📝 {n}</li>)}</ul>}
          </Section>
          <Section title="History"><Activity events={svc.timeline({ shipmentId: sh.id })} /></Section>
        </div>
      </div>
      <Modal open={modal === "approve"} onClose={() => setModal(null)} title="Approve customs review (demo)">
        <p className="mb-3 text-ink-soft">Confirms the invoices, items and declared value look right. {svc.CUSTOMS_DISCLAIMER}</p>
        <Field label="Note (optional)"><Input value={text} onChange={(e) => setText(e.target.value)} /></Field>
        <div className="mt-3"><Btn tone="sea" onClick={() => submit(() => svc.approveCustoms(actor, sh.id, text || undefined), "Approved — shipment cleared to depart.")}>Approve</Btn></div>
      </Modal>
      {(["review", "flag", "escalate"] as const).map((m) => (
        <Modal key={m} open={modal === m} onClose={() => setModal(null)} title={{ review: "Request review", flag: "Add a flag", escalate: "Escalate to a manager" }[m]}>
          <form onSubmit={(e) => { e.preventDefault(); submit(() => (m === "review" ? svc.requestCustomsReview(actor, sh.id, text) : m === "flag" ? svc.flagCustoms(actor, sh.id, text) : svc.escalateCustoms(actor, sh.id, text)), m === "review" ? "Review requested — exception created." : m === "flag" ? "Flag added." : "Escalated."); }} className="space-y-3">
            <Field label={m === "flag" ? "Flag" : "What needs attention?"}><Input required value={text} onChange={(e) => setText(e.target.value)} placeholder={m === "review" ? "e.g. Confirm battery watt-hours on receipt" : ""} /></Field>
            <Btn type="submit" tone="dark">Save</Btn>
          </form>
        </Modal>
      ))}
    </OpsPage>
  );
}
