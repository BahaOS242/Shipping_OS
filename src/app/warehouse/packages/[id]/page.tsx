"use client";

import { useLive } from "@/data/useLive";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, use, useState } from "react";
import { Activity } from "@/components/domain/Activity";
import { BillPill, CustomsPill, DeliveryPill, ExStatusPill, PackagePill, ReceiptPill, SeverityPill, ShipmentPill } from "@/components/domain/Status";
import { BillLink, CustomerLink, ReceiptLink, ShipmentLink } from "@/components/ops/Links";
import { Btn, OpsPage } from "@/components/ops/OpsPage";
import { ReceivingWizard } from "@/components/ops/ReceivingWizard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Pill } from "@/components/ui/Pill";
import { Section } from "@/components/ui/Section";
import { fmtDateTime } from "@/components/ui/Time";
import { useAction } from "@/components/ui/Toast";
import { PhotoTile, QR } from "@/components/ui/Visuals";
import { EXCEPTION_CATALOG } from "@/domain/copy";
import { fmtLb, fmtUsd } from "@/domain/rates";
import type { DestinationId, ServiceLevel } from "@/domain/types";
import * as svc from "@/services";

type M = null | "receive" | "weigh" | "assign" | "together" | "hold" | "match" | "message";

export default function StaffPackagePage({ params }: { params: Promise<{ id: string }> }) {
  useLive();
  return <Suspense><Record id={use(params).id} /></Suspense>;
}

function Record({ id }: { id: string }) {
  useLive();
  const sp = useSearchParams();
  const run = useAction();
  const actor = svc.currentActor();
  const p = svc.findPackage(id);
  const [modal, setModal] = useState<M>(p && p.status === "incoming" && sp.get("receive") ? "receive" : null);
  const [w, setW] = useState({ weight: String(p?.actualWeight ?? ""), l: String(p?.length ?? ""), wd: String(p?.width ?? ""), h: String(p?.height ?? "") });
  const [dest, setDest] = useState<DestinationId>(p?.destinationId ?? "nassau");
  const [service, setService] = useState<ServiceLevel>(p?.service ?? "air");
  const [picked, setPicked] = useState<string[]>(p ? [p.id] : []);
  const [text, setText] = useState("");
  const [cust, setCust] = useState("");
  if (!p) return <EmptyState icon="🔎" title={`No package ${id}`} action={<Link href="/warehouse/scan" className="font-bold text-sea-700">Scan again</Link>} />;

  const c = svc.findCustomer(p.customerId);
  const inv = svc.findPurchaseInvoice(p.purchaseInvoiceId);
  const sh = svc.findShipment(p.shipmentId);
  const bill = sh ? svc.listBills({ shipmentId: sh.id })[0] : undefined;
  const dlv = svc.deliveryForShipment(sh?.id);
  const ex = svc.listExceptions({ packageId: p.id });
  const st = svc.packageStorage(p.id);
  const eligible = c ? svc.consolidationCandidates(c.id) : [];
  const atWarehouse = p.status === "received" && !p.shipmentId;
  const close = () => setModal(null);

  return (
    <OpsPage
      eyebrow={<Link href="/warehouse" className="text-sea-700">← Warehouse</Link>}
      title={<span className="font-mono">{p.id}</span>}
      sub={`${p.merchant} — ${p.itemName}`}
      actions={
        <>
          {p.status === "incoming" && <Btn tone="sea" onClick={() => setModal("receive")}>📥 Receive</Btn>}
          {p.status !== "incoming" && !sh && <Btn tone="light" onClick={() => setModal("weigh")}>⚖ Weigh</Btn>}
          <Btn tone="light" onClick={() => run(() => svc.addPhoto(actor, p.id), "Photo added.")}>📷 Photograph</Btn>
          {!sh && <Btn tone="light" onClick={() => setModal("assign")}>📍 Assign</Btn>}
          {atWarehouse && c && <Btn tone="light" onClick={() => { setPicked(eligible.map((x) => x.id)); setModal("together"); }}>📦 Put Together</Btn>}
          {!sh && (p.storage.holdStatus === "none" ? <Btn tone="light" onClick={() => setModal("hold")}>✋ Hold</Btn> : <Btn tone="light" onClick={() => run(() => svc.releaseHold(actor, p.id), "Hold released.")}>▶ Release</Btn>)}
          {sh?.status === "cleared" && <Btn tone="gold" onClick={() => run(() => svc.departShipment(actor, sh.id), `${sh.id} departed.`)}>✈️ Send</Btn>}
          {c && <Btn tone="light" onClick={() => setModal("message")}>💬 Message customer</Btn>}
        </>
      }
    >
      {ex.filter(svc.isOpen).length > 0 && (
        <div className="space-y-2">
          {ex.filter(svc.isOpen).map((e) => (
            <Link key={e.id} href={`/exceptions?open=${e.id}`} className="flex flex-wrap items-center gap-2 rounded-2xl bg-coral-50 p-3 ring-1 ring-coral-100">
              <SeverityPill severity={e.severity} /> <strong>{EXCEPTION_CATALOG[e.type].icon} {e.title}</strong> <span className="text-ink-soft">— {e.detail}</span> <span className="ml-auto text-sm font-bold text-sea-700">{e.id} →</span>
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0 space-y-5">
          <Section title="Package record">
            <div className="flex flex-wrap gap-5">
              <QR value={p.id} size={120} />
              <dl className="grid flex-1 grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
                {[
                  ["Customer", c ? <span key="c"><CustomerLink id={c.id} /><span className="block text-xs text-ink-mute">{c.accountNumber}</span></span> : <span key="c"><span className="font-bold text-coral-700">Unmatched</span> <button className="text-sm font-bold text-sea-700 underline" onClick={() => setModal("match")}>Match</button></span>],
                  ["Label", `${p.labelName}${p.labelSuite ? ` #${p.labelSuite}` : ""}`],
                  ["Status", <PackagePill key="s" status={p.status} staff />],
                  ["Merchant / order", `${p.merchant}${p.orderNumber ? ` · ${p.orderNumber}` : ""}`],
                  ["Inbound", `${p.carrier} ${p.inboundTracking}`],
                  ["Bin", p.bin ?? "—"],
                  ["Weight", `${fmtLb(p.actualWeight)}${p.carrierWeight ? ` (carrier ${fmtLb(p.carrierWeight)})` : ""}`],
                  ["Dimensions", p.length ? `${p.length}×${p.width}×${p.height} in` : "—"],
                  ["Billable", p.billableWeight ? `${fmtLb(p.billableWeight)}${p.dimensionalWeight && p.dimensionalWeight > (p.actualWeight ?? 0) ? " (dim)" : ""}` : "—"],
                  ["Destination", `${svc.getDestination(p.destinationId).name} · ${p.service}`],
                  ["Declared value", p.declaredValue !== undefined ? fmtUsd(p.declaredValue) : "—"],
                  ["Condition", p.condition === "damaged" ? <Pill key="d" tone="bad" icon="💔">Damaged</Pill> : "Good"],
                ].map(([k, v]) => (
                  <div key={String(k)}><dt className="text-xs font-bold uppercase tracking-wide text-ink-mute">{k}</dt><dd className="font-semibold">{v}</dd></div>
                ))}
              </dl>
            </div>
          </Section>

          <Section title="Contents (from invoice)" action={inv ? <ReceiptLink id={inv.id} /> : undefined}>
            {inv ? (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2"><ReceiptPill status={inv.status} /> <span className="text-sm text-ink-soft">{inv.merchant} {inv.invoiceNumber} · {inv.currency} {inv.total.toFixed(2)} · confidence {Math.round(inv.confidence * 100)}%</span></div>
                <ul className="divide-y divide-[#eef1f4]">{inv.items.map((i) => <li key={i.sku} className="flex justify-between gap-3 py-2"><span>{i.quantity} × {i.name}{i.reviewFlag && <span className="block text-xs font-bold text-coral-700">⚠ {i.reviewFlag}</span>}</span><span className="tabular-nums">{i.totalPrice.toFixed(2)}</span></li>)}</ul>
              </>
            ) : <p className="text-ink-soft">🧾 No invoice yet. {p.status !== "incoming" && "A MISSING_INVOICE exception tracks this."}</p>}
          </Section>

          <Section title={`Photos (${p.photos.length})`}>
            {p.photos.length ? <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">{p.photos.map((x) => <PhotoTile key={x} id={x} damaged={p.condition === "damaged"} />)}</div> : <p className="text-ink-mute">No photos yet.</p>}
          </Section>

          <Section title="Audit history"><Activity events={svc.timeline({ packageId: p.id })} /></Section>
        </div>

        <div className="min-w-0 space-y-5">
          <Section title="Shipment & customs">
            {sh ? (
              <div className="space-y-2">
                <p className="flex flex-wrap items-center gap-2"><ShipmentLink id={sh.id} /> <ShipmentPill status={sh.status} staff /></p>
                <p className="flex items-center gap-2 text-sm">Customs: <CustomsPill status={sh.customs.status} /></p>
                <p className="text-sm text-ink-soft">{sh.packageIds.length} package(s) · {sh.service} · {sh.deliveryMethod.replace("_", " ")}</p>
              </div>
            ) : <p className="text-ink-soft">Not in a shipment yet.</p>}
          </Section>
          <Section title="Payment">
            {bill ? <p className="flex flex-wrap items-center gap-2"><BillLink id={bill.id} /> <BillPill status={bill.status} /> {fmtUsd(bill.total)}{bill.balance > 0 && ` · ${fmtUsd(bill.balance)} due`}</p> : <p className="text-ink-soft">Billed when it ships.</p>}
          </Section>
          <Section title="Delivery">{dlv ? <p className="flex flex-wrap items-center gap-2"><DeliveryPill status={dlv.status} staff /> {dlv.driver && `· ${dlv.driver}`} <Link href="/delivery" className="text-sm font-bold text-sea-700">Board →</Link></p> : <p className="text-ink-soft">—</p>}</Section>
          <Section title="Storage">
            {st.applies ? (
              <div className="space-y-2">
                <p className={st.daysOver ? "font-bold text-coral-700" : ""}>Waiting {st.daysWaiting} days · free until {fmtDateTime(st.freeUntil)}{st.daysOver ? ` · ${st.daysOver} days over · $${st.feeUncharged.toFixed(2)} uncharged` : ""}</p>
                <p className="text-sm">Hold: {p.storage.holdStatus.replace("_", " ")}{p.storage.holdReason ? ` — ${p.storage.holdReason}` : ""}</p>
                <div className="flex flex-wrap gap-2">
                  <Btn tone="light" onClick={() => run(() => svc.notifyStorage(actor, p.id), "Customer notified (simulated).")}>🔔 Notify</Btn>
                  {st.feeUncharged > 0 && <Btn tone="light" onClick={() => run(() => svc.applyStorageFee(actor, p.id), "Fee applied.")}>$ Apply fee</Btn>}
                  <Btn tone="light" onClick={() => run(() => svc.markCollected(actor, p.id, "Collected at warehouse"), "Marked collected.")}>✓ Collected</Btn>
                  <Btn tone="danger" onClick={() => run(() => svc.escalateStorage(actor, p.id), "Escalated.")}>⚑ Escalate</Btn>
                </div>
              </div>
            ) : <p className="text-ink-soft">{st.state === "collected" ? "Collected." : "Not in storage."}</p>}
          </Section>
          <Section title={`Exceptions (${ex.length})`}>
            {!ex.length ? <p className="text-ink-mute">None.</p> : <ul className="space-y-2">{ex.map((e) => <li key={e.id}><Link href={`/exceptions?open=${e.id}`} className="flex flex-wrap items-center gap-2 text-sm"><ExStatusPill status={e.status} /> <strong>{e.title}</strong> <span className="font-mono text-ink-mute">{e.id}</span></Link></li>)}</ul>}
          </Section>
          <Section title="Documents">
            <ul className="space-y-1 text-sm">
              {inv && <li>🧾 {inv.source.fileName}</li>}
              {sh && <li>📄 <Link className="font-semibold text-sea-700 underline" href={`/customs/${sh.id}`}>Customs packet {sh.id}</Link></li>}
              {!inv && !sh && <li className="text-ink-mute">No documents yet.</li>}
            </ul>
          </Section>
        </div>
      </div>

      <Modal open={modal === "receive"} onClose={close} title={`Receive ${p.id}`} wide>{modal === "receive" && <ReceivingWizard pkg={p} onDone={close} />}</Modal>
      <Modal open={modal === "weigh"} onClose={close} title="Weigh & measure">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (run(() => svc.updateMeasurements(actor, p.id, { actualWeight: Number(w.weight), length: Number(w.l) || undefined, width: Number(w.wd) || undefined, height: Number(w.h) || undefined }), (x) => `Billable weight now ${fmtLb(x.billableWeight)}.`)) close(); }}>
          <Field label="Weight (lb)"><Input type="number" step="0.1" required value={w.weight} onChange={(e) => setW({ ...w, weight: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-2">{(["l", "wd", "h"] as const).map((k) => <Field key={k} label={{ l: "L", wd: "W", h: "H" }[k] + " (in)"}><Input type="number" value={w[k]} onChange={(e) => setW({ ...w, [k]: e.target.value })} /></Field>)}</div>
          <Btn type="submit" tone="dark">Save</Btn>
        </form>
      </Modal>
      <Modal open={modal === "assign"} onClose={close} title="Assign destination & service">
        <div className="space-y-3">
          <Field label="Destination"><Select value={dest} onChange={(e) => setDest(e.target.value as DestinationId)}>{svc.getDestinations().map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</Select></Field>
          <Field label="Service"><Select value={service} onChange={(e) => setService(e.target.value as ServiceLevel)}><option value="air">Air</option><option value="ocean">Ocean</option></Select></Field>
          <Btn tone="dark" onClick={() => { if (run(() => svc.assignDestination(actor, p.id, dest, service), "Assigned.")) close(); }}>Save</Btn>
        </div>
      </Modal>
      <Modal open={modal === "together"} onClose={close} title="Put together (staff, for the customer)">
        <div className="space-y-3">
          <p className="text-ink-soft">{c && svc.customerName(c)}&apos;s packages at the warehouse:</p>
          {eligible.map((x) => (
            <label key={x.id} className="flex min-h-12 items-center gap-3 rounded-xl p-2 ring-1 ring-[#e3e7ec]">
              <input type="checkbox" className="h-5 w-5" checked={picked.includes(x.id)} onChange={() => setPicked((s) => (s.includes(x.id) ? s.filter((y) => y !== x.id) : [...s, x.id]))} />
              <span className="font-mono text-sm">{x.id}</span> {x.merchant} · {fmtLb(x.actualWeight)}
            </label>
          ))}
          <Btn tone="sea" disabled={!picked.length} onClick={() => { if (c && run(() => svc.createShipment(actor, { customerId: c.id, packageIds: picked }), (s) => `Shipment ${s.id} created and sent to customs.`)) close(); }}>Create shipment</Btn>
        </div>
      </Modal>
      <Modal open={modal === "hold"} onClose={close} title="Place on hold">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (run(() => svc.holdPackage(actor, p.id, text), "On hold.")) { setText(""); close(); } }}>
          <Field label="Reason"><Input required value={text} onChange={(e) => setText(e.target.value)} /></Field>
          <Btn type="submit" tone="dark">Hold</Btn>
        </form>
      </Modal>
      <Modal open={modal === "match"} onClose={close} title="Match to a customer">
        <div className="space-y-3">
          <Field label="Customer"><Select value={cust} onChange={(e) => setCust(e.target.value)}><option value="">Choose…</option>{svc.listCustomers().map((x) => <option key={x.id} value={x.id}>{svc.customerName(x)} · {x.accountNumber}</option>)}</Select></Field>
          <Btn tone="dark" disabled={!cust} onClick={() => { if (run(() => svc.matchCustomer(actor, p.id, cust), "Matched — exception resolved.")) close(); }}>Match</Btn>
        </div>
      </Modal>
      <Modal open={modal === "message"} onClose={close} title={`Message ${c?.firstName ?? ""} on WhatsApp`}>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (c && run(() => svc.staffMessage(actor, c.id, text), "Sent (simulated) — it's in their WhatsApp thread.")) { setText(""); close(); } }}>
          <Textarea rows={4} required value={text} onChange={(e) => setText(e.target.value)} placeholder={`Hi ${c?.firstName}, about your ${p.merchant} package (${p.id})…`} />
          <Btn type="submit" tone="sea">Send (demo)</Btn>
        </form>
      </Modal>
    </OpsPage>
  );
}
