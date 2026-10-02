/**
 * MANIFEST SERVICE — what is loaded on a trip.
 * Lines are derived from the shipments assigned to the trip (one source of
 * truth); the stored Manifest record only tracks whether loading is closed.
 */
import { nowIso } from "@/data/clock";
import { db, mutate, nextSeq } from "@/data/store";
import { can } from "@/domain/roles";
import type { Actor, ID, Manifest } from "@/domain/types";
import { emit } from "@/events/bus";
import { BusinessError, byId, customerName } from "./_shared";
import { authorize, requireModule } from "./access";
import { tripCapacity } from "./capacity";

export const isManifestClosed = (tripId: ID) => db().manifests.some((m) => m.tripId === tripId && m.status === "closed");

export function manifestFor(tripId: ID) {
  requireModule("manifest");
  const s = db();
  const trip = byId(s.voyages, tripId, "Trip");
  const record = s.manifests.find((m) => m.tripId === trip.id);
  const lines = s.shipments
    .filter((sh) => sh.voyageId === trip.id)
    .map((sh) => {
      const pkgs = s.packages.filter((p) => sh.packageIds.includes(p.id));
      const booking = s.bookings.find((b) => b.shipmentId === sh.id);
      return {
        shipment: sh,
        customer: customerName(s.customers.find((c) => c.id === sh.customerId)),
        description: booking?.description ?? pkgs.map((p) => p.itemName).join(", "),
        pieces: booking?.pieces ?? pkgs.length,
        weightLb: Math.round(pkgs.reduce((a, p) => a + (p.actualWeight ?? 0), 0) * 10) / 10,
        bookingId: booking?.id,
      };
    });
  return {
    trip,
    status: record?.status ?? ("open" as const),
    record,
    lines,
    totals: { shipments: lines.length, pieces: lines.reduce((a, l) => a + l.pieces, 0), weightLb: Math.round(lines.reduce((a, l) => a + l.weightLb, 0) * 10) / 10 },
    capacity: tripCapacity(trip),
  };
}

/** Trips with something on them (or about to), soonest first. */
export function listManifests() {
  requireModule("manifest");
  const s = db();
  return s.voyages
    .filter((v) => v.status !== "cancelled" && (s.shipments.some((sh) => sh.voyageId === v.id) || s.bookings.some((b) => b.tripId === v.id && b.status !== "cancelled")))
    .sort((a, b) => Number(b.status === "scheduled") - Number(a.status === "scheduled") || (a.status === "scheduled" ? a.departsAt.localeCompare(b.departsAt) : b.departsAt.localeCompare(a.departsAt)))
    .map((v) => manifestFor(v.id));
}

export function closeManifest(actor: Actor, tripId: ID) {
  authorize(actor, "manifest", can(actor, "manifest.manage"), "Only dispatch or the warehouse can close a manifest.");
  const trip = byId(db().voyages, tripId, "Trip");
  if (trip.status !== "scheduled") throw new BusinessError("This trip has already left.");
  return mutate((s) => {
    let m = s.manifests.find((x) => x.tripId === trip.id);
    if (!m) {
      m = { id: `MAN-${nextSeq("man", 100)}`, organizationId: s.organizationId, tripId: trip.id, status: "open", createdAt: nowIso() } satisfies Manifest;
      s.manifests.push(m);
    }
    if (m.status === "closed") return m;
    m.status = "closed";
    m.closedBy = actor.name;
    m.closedAt = nowIso();
    emit("MANIFEST_CLOSED", { actor, refs: { tripId: trip.id }, summary: `Manifest ${m.id} for ${trip.label} closed by ${actor.name}` });
    return m;
  });
}

export function reopenManifest(actor: Actor, tripId: ID) {
  authorize(actor, "manifest", can(actor, "manifest.manage"), "Only dispatch or the warehouse can reopen a manifest.");
  const trip = byId(db().voyages, tripId, "Trip");
  if (trip.status !== "scheduled") throw new BusinessError("This trip has already left.");
  return mutate((s) => {
    const m = s.manifests.find((x) => x.tripId === trip.id);
    if (m) m.status = "open";
    return m;
  });
}
