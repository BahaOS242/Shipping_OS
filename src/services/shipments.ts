/**
 * SHIPMENT & CUSTOMS SERVICE
 *
 * Shipment = one customer's packages traveling together to one island.
 * create ("Put these together") → customs packet → customs review → cleared
 * → depart (voyage) → arrive → delivery / pickup (delivery.ts).
 *
 * Demo customs workflow — final clearance decisions remain with authorized personnel.
 */
import { nowIso } from "@/data/clock";
import { db, mutate, nextSeq } from "@/data/store";
import { assert, can, canActOn } from "@/domain/roles";
import type { Actor, CustomsStatus, ID, Package, ServiceLevel, Shipment } from "@/domain/types";
import { SYSTEM, emit } from "@/events/bus";
import { BusinessError, byId, customerName, round2 } from "./_shared";
import { billShipment } from "./billing";
import { getCustomer } from "./customers";
import { autoResolve, isOpen, onExceptionResolved, raiseException } from "./exceptions";
import { declaredValueUsd, findPurchaseInvoice, onInvoiceLinked } from "./invoiceEngine";
import { getDestination, getLocation, nextVoyage, warehouse } from "./locations";

export const CUSTOMS_DISCLAIMER = "Demo customs workflow — final clearance decisions remain with authorized personnel.";

export const getShipment = (id: ID): Shipment => byId(db().shipments, id.trim().toUpperCase(), "Shipment");
export const findShipment = (id?: ID) => (id ? db().shipments.find((s) => s.id === id.toUpperCase()) : undefined);
export const shipmentPackages = (sh: Shipment) => db().packages.filter((p) => sh.packageIds.includes(p.id));

export function listShipments(f: { customerId?: ID; status?: Shipment["status"]; customs?: CustomsStatus } = {}) {
  return db()
    .shipments.filter((s) => (!f.customerId || s.customerId === f.customerId) && (!f.status || s.status === f.status) && (!f.customs || s.customs.status === f.customs))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Documents are complete when every package has a linked store receipt. */
function docsComplete(sh: Shipment) {
  return shipmentPackages(sh).every((p) => p.purchaseInvoiceId);
}

function blockingExceptions(sh: Shipment) {
  return db().exceptions.filter(
    (e) => isOpen(e) && (e.shipmentId === sh.id || (e.packageId && sh.packageIds.includes(e.packageId))) && ["CUSTOMS_REVIEW_REQUIRED", "PROHIBITED_ITEM", "MISSING_INVOICE"].includes(e.type),
  );
}

function refreshCustoms(sh: Shipment) {
  if (sh.customs.status === "approved") return;
  if (!docsComplete(sh)) sh.customs.status = "missing_documents";
  else if (blockingExceptions(sh).length) sh.customs.status = "needs_attention";
  else sh.customs.status = "ready_for_review";
}

/** "Put these together" — customer or staff. Creates a real Shipment linked to its packages. */
export function createShipment(actor: Actor, input: { customerId: ID; packageIds: ID[]; service?: ServiceLevel; deliveryMethod?: Shipment["deliveryMethod"] }) {
  assert(canActOn(actor, "shipment.create_any", { customerId: input.customerId }), "You can only ship your own packages.");
  const c = getCustomer(input.customerId);
  if (!input.packageIds.length) throw new BusinessError("Pick at least one package.");
  const pkgs = input.packageIds.map((id) => db().packages.find((p) => p.id === id));
  for (const p of pkgs) {
    if (!p) throw new BusinessError("Package not found.");
    if (p.customerId !== c.id) throw new BusinessError(`${p.id} isn't on this account.`);
    if (p.status !== "received") throw new BusinessError(`${p.id} isn't at our warehouse yet.`);
    if (p.shipmentId) throw new BusinessError(`${p.id} is already in ${p.shipmentId}.`);
    if (p.storage.holdStatus !== "none") throw new BusinessError(`${p.id} is on hold.`);
  }
  const list = pkgs as Package[];
  const destinationId = list[0].destinationId;
  if (list.some((p) => p.destinationId !== destinationId)) throw new BusinessError("Packages must be going to the same island.");
  const service = input.service ?? (list.some((p) => p.service === "ocean") ? "ocean" : list[0].service);
  if (!getDestination(destinationId).services.includes(service)) throw new BusinessError("That service isn't available to this island.");

  return mutate((s) => {
    const sh: Shipment = {
      id: `TL-SHP-${nextSeq("shp", 2030)}`,
      customerId: c.id,
      packageIds: list.map((p) => p.id),
      destinationId,
      service,
      deliveryMethod: input.deliveryMethod ?? c.deliveryPreference,
      status: "awaiting_customs",
      customs: { status: "missing_documents", flags: [], notes: [] },
      createdAt: nowIso(),
      createdBy: actor.role === "customer" ? "customer" : "staff",
    };
    s.shipments.push(sh);
    for (const p of list) {
      p.shipmentId = sh.id;
      p.status = "preparing";
      p.service = service;
      const inv = findPurchaseInvoice(p.purchaseInvoiceId);
      if (inv) inv.shipmentId = sh.id;
    }
    const refs = { customerId: c.id, shipmentId: sh.id };
    if (list.length > 1) {
      emit("PACKAGE_CONSOLIDATED", { actor, refs, summary: `${list.length} packages put together: ${list.map((p) => p.id).join(", ")}`, customerSummary: `We'll combine your ${list.length} packages into one shipment.`, data: { packageIds: sh.packageIds } });
    }
    emit("SHIPMENT_CREATED", { actor, refs, summary: `Shipment ${sh.id} created (${service}, ${getDestination(destinationId).name}, ${sh.deliveryMethod.replace("_", " ")})`, customerSummary: `Shipment ${sh.id} created. We're getting it ready.` });
    refreshCustoms(sh);
    sh.customs.packetGeneratedAt = nowIso();
    emit("CUSTOMS_PACKET_GENERATED", { actor: SYSTEM, refs, summary: `Customs packet generated — ${CUSTOMS_COPY_STATUS[sh.customs.status]}` });
    billShipment(SYSTEM, sh.id);
    return sh;
  });
}

const CUSTOMS_COPY_STATUS: Record<CustomsStatus, string> = {
  missing_documents: "missing documents",
  ready_for_review: "ready for review",
  needs_attention: "needs attention",
  approved: "approved",
};

/* ---------------- Customs ---------------- */

export function customsPacket(shipmentId: ID) {
  const sh = getShipment(shipmentId);
  const c = getCustomer(sh.customerId);
  const pkgs = shipmentPackages(sh);
  const lines = pkgs.map((p) => {
    const inv = findPurchaseInvoice(p.purchaseInvoiceId);
    return {
      package: p,
      invoice: inv,
      merchant: p.merchant,
      items: inv?.items ?? [],
      declaredValueUsd: inv ? declaredValueUsd(inv) : undefined,
      currency: inv?.currency,
      document: inv?.source.fileName,
    };
  });
  const voyage = db().voyages.find((v) => v.id === sh.voyageId);
  return {
    title: `DEMO CUSTOMS PACKET — ${sh.id}`,
    generatedAt: sh.customs.packetGeneratedAt ?? nowIso(),
    disclaimer: CUSTOMS_DISCLAIMER,
    consignee: { name: customerName(c), account: c.accountNumber, phone: c.phone, address: c.deliveryAddress },
    shipper: { name: "The Link Services (DEMO)", address: warehouse().addressLines.join(", ") },
    shipment: { id: sh.id, service: sh.service, destination: getDestination(sh.destinationId).name, voyage: voyage?.label, pickup: getLocation(getDestination(sh.destinationId).pickupLocationIds[0])?.name },
    lines,
    totals: {
      packages: pkgs.length,
      actualWeight: round2(pkgs.reduce((s, p) => s + (p.actualWeight ?? 0), 0)),
      billableWeight: round2(pkgs.reduce((s, p) => s + (p.billableWeight ?? 0), 0)),
      declaredValueUsd: round2(lines.reduce((s, l) => s + (l.declaredValueUsd ?? 0), 0)),
    },
    missing: lines.filter((l) => !l.invoice).map((l) => l.package.id),
    flags: [...sh.customs.flags, ...lines.flatMap((l) => l.items.filter((i) => i.reviewFlag).map((i) => `${i.name}: ${i.reviewFlag}`))],
    status: sh.customs.status,
  };
}

export function customsQueue(status?: CustomsStatus) {
  return db()
    .shipments.filter((s) => ["awaiting_customs", "cleared"].includes(s.status))
    .filter((s) => !status || s.customs.status === status)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function customsAction(actor: Actor, id: ID, fn: (sh: Shipment) => void) {
  assert(can(actor, "customs.review"), "Only the customs team can do that.");
  return mutate(() => {
    const sh = getShipment(id);
    if (!["awaiting_customs", "cleared"].includes(sh.status)) throw new BusinessError("This shipment is past customs review.");
    fn(sh);
    return sh;
  });
}

export const approveCustoms = (actor: Actor, id: ID, note?: string) =>
  customsAction(actor, id, (sh) => {
    refreshCustoms(sh);
    if (sh.customs.status === "missing_documents") throw new BusinessError("Documents are missing. Every package needs a store receipt.");
    const blocking = blockingExceptions(sh);
    if (blocking.length) throw new BusinessError(`Resolve ${blocking.map((e) => e.id).join(", ")} first.`);
    sh.customs.status = "approved";
    sh.customs.reviewedBy = actor.name;
    sh.customs.reviewedAt = nowIso();
    if (note) sh.customs.notes.push(note);
    sh.status = "cleared";
    emit("CUSTOMS_APPROVED", { actor, refs: { customerId: sh.customerId, shipmentId: sh.id }, summary: `Customs review approved by ${actor.name} (demo)${note ? ` — ${note}` : ""}`, customerSummary: "Your paperwork is checked. Your shipment is ready to travel." });
  });

export const requestCustomsReview = (actor: Actor, id: ID, reason: string) =>
  customsAction(actor, id, (sh) => {
    if (!reason.trim()) throw new BusinessError("Say what needs review.");
    sh.customs.status = "needs_attention";
    sh.customs.notes.push(`Review requested: ${reason}`);
    if (sh.status === "cleared") sh.status = "awaiting_customs";
    emit("CUSTOMS_REVIEW_REQUIRED", { actor, refs: { customerId: sh.customerId, shipmentId: sh.id }, summary: `Customs review requested: ${reason}` });
    raiseException(actor, { type: "CUSTOMS_REVIEW_REQUIRED", customerId: sh.customerId, shipmentId: sh.id, detail: reason.trim() });
  });

export const flagCustoms = (actor: Actor, id: ID, flag: string) =>
  customsAction(actor, id, (sh) => {
    sh.customs.flags.push(flag);
    emit("CUSTOMS_FLAGGED", { actor, refs: { customerId: sh.customerId, shipmentId: sh.id }, summary: `Flagged: ${flag}` });
  });

export const escalateCustoms = (actor: Actor, id: ID, reason: string) =>
  customsAction(actor, id, (sh) => {
    sh.customs.status = "needs_attention";
    raiseException(actor, { type: "CUSTOMS_REVIEW_REQUIRED", severity: "critical", team: "management", title: "Escalated by customs", customerId: sh.customerId, shipmentId: sh.id, detail: reason || "Needs a manager decision." });
  });

export const markPacketReviewed = (actor: Actor, id: ID) =>
  customsAction(actor, id, (sh) => {
    sh.customs.packetReviewedBy = actor.name;
    emit("CUSTOMS_PACKET_GENERATED", { actor, refs: { customerId: sh.customerId, shipmentId: sh.id }, summary: `Customs packet reviewed by ${actor.name}` });
  });

// Keep customs status in sync with the rest of the system.
onExceptionResolved((e) => {
  const sh = e.shipmentId ? findShipment(e.shipmentId) : e.packageId ? db().shipments.find((s) => s.packageIds.includes(e.packageId!)) : undefined;
  if (sh && sh.customs.status !== "approved") refreshCustoms(sh);
});
onInvoiceLinked((inv) => {
  const sh = db().shipments.find((s) => inv.packageId && s.packageIds.includes(inv.packageId));
  if (sh && sh.customs.status !== "approved") refreshCustoms(sh);
});

/* ---------------- Movement ---------------- */

export function departShipment(actor: Actor, id: ID) {
  assert(can(actor, "shipment.move"), "Only warehouse or managers can send shipments.");
  return mutate(() => {
    const sh = getShipment(id);
    if (sh.status !== "cleared") throw new BusinessError(sh.customs.status === "approved" ? "Already departed." : "Customs review must be approved first.");
    const v = nextVoyage(sh.destinationId, sh.service);
    if (v) {
      sh.voyageId = v.id;
      v.status = "departed";
    }
    sh.status = "departed";
    sh.departedAt = nowIso();
    for (const p of shipmentPackages(sh)) p.status = "in_transit";
    emit("SHIPMENT_DEPARTED", {
      actor,
      refs: { customerId: sh.customerId, shipmentId: sh.id },
      summary: `${sh.id} departed${v ? ` on ${v.label}` : ""}`,
      customerSummary: `Your shipment left Florida and is coming to The Bahamas ${sh.service === "air" ? "✈️" : "🚢"}`,
    });
    return sh;
  });
}

type ArrivalHook = (sh: Shipment, actor: Actor) => void;
const arrivalHooks: ArrivalHook[] = [];
export const onShipmentArrived = (h: ArrivalHook) => arrivalHooks.push(h);

export function arriveShipment(actor: Actor, id: ID) {
  assert(can(actor, "shipment.move"));
  return mutate((s) => {
    const sh = getShipment(id);
    if (sh.status !== "departed") throw new BusinessError("Only departed shipments can arrive.");
    sh.status = "arrived";
    sh.arrivedAt = nowIso();
    const v = s.voyages.find((x) => x.id === sh.voyageId);
    if (v) v.status = "arrived";
    for (const p of shipmentPackages(sh)) p.status = "arrived";
    emit("SHIPMENT_ARRIVED", { actor, refs: { customerId: sh.customerId, shipmentId: sh.id }, summary: `${sh.id} arrived in ${getDestination(sh.destinationId).name}`, customerSummary: `Your shipment arrived in The Bahamas 🇧🇸` });
    arrivalHooks.forEach((h) => h(sh, actor));
    autoResolve("SHIPMENT_DELAYED", { shipmentId: sh.id }, "Arrived");
    return sh;
  });
}
