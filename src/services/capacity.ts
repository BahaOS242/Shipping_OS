/**
 * CAPACITY — how much weight a trip can still take.
 * Pure reads over the tenant partition (no service imports, so anything can use it).
 *
 * Load on a trip = shipments assigned to it (actual package weights)
 *                + confirmed bookings not yet checked in (booked weight).
 */
import { db } from "@/data/store";
import type { ID, Voyage } from "@/domain/types";
import { isModuleEnabled } from "./access";

export type TripCapacity = {
  /** Undefined = no limit known (no vessel / no override). */
  capacityLb?: number;
  loadedLb: number;
  reservedLb: number;
  usedLb: number;
  remainingLb?: number;
  /** 0–100+, undefined when unlimited. */
  percent?: number;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

export function tripCapacity(trip: Voyage): TripCapacity {
  const s = db();
  const vessel = trip.vesselId ? s.vessels.find((v) => v.id === trip.vesselId) : undefined;
  const capacityLb = trip.capacityLb ?? vessel?.capacityLb;
  const loadedLb = s.shipments
    .filter((sh) => sh.voyageId === trip.id)
    .reduce((sum, sh) => sum + s.packages.filter((p) => sh.packageIds.includes(p.id)).reduce((a, p) => a + (p.actualWeight ?? 0), 0), 0);
  const reservedLb = s.bookings.filter((b) => b.tripId === trip.id && b.status === "confirmed").reduce((a, b) => a + b.weightLb, 0);
  const usedLb = loadedLb + reservedLb;
  return {
    capacityLb,
    loadedLb: r1(loadedLb),
    reservedLb: r1(reservedLb),
    usedLb: r1(usedLb),
    remainingLb: capacityLb === undefined ? undefined : r1(capacityLb - usedLb),
    percent: capacityLb ? Math.round((usedLb / capacityLb) * 100) : undefined,
  };
}

/** Capacity is only enforced when the organization has the Capacity module. */
export function hasRoomFor(tripId: ID, weightLb: number) {
  if (!isModuleEnabled("capacity")) return true;
  const trip = db().voyages.find((v) => v.id === tripId);
  if (!trip) return false;
  const c = tripCapacity(trip);
  return c.remainingLb === undefined || c.remainingLb >= weightLb;
}
