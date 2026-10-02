/**
 * BOOKING SERVICE — customers reserve space on a trip.
 *
 *   request (customer or staff) → confirm (capacity check) → check in at the dock
 *   → a real Package + Shipment on the trip → manifest → depart → arrive.
 *
 * Check-in reuses the existing package and shipment services, so billing,
 * tracking, notifications and the timeline work exactly as for forwarded freight.
 */
import { now, nowIso } from "@/data/clock";
import { db, mutate, nextSeq } from "@/data/store";
import { can, canActOn } from "@/domain/roles";
import type { Actor, Booking, BookingStatus, ID } from "@/domain/types";
import { emit } from "@/events/bus";
import { BusinessError, byId } from "./_shared";
import { authorize, isModuleEnabled, requireModule } from "./access";
import { hasRoomFor } from "./capacity";
import { getCustomer } from "./customers";
import { isManifestClosed } from "./manifests";
import { checkInCargoPackage } from "./packages";
import { createShipment } from "./shipments";

export const getBooking = (id: ID) => byId(db().bookings, id, "Booking");

export function listBookings(f: { customerId?: ID; tripId?: ID; status?: BookingStatus } = {}) {
  requireModule("booking");
  return db()
    .bookings.filter((b) => (!f.customerId || b.customerId === f.customerId) && (!f.tripId || b.tripId === f.tripId) && (!f.status || b.status === f.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Trips a customer can book: upcoming, not closed, with room for at least something. */
export function bookableTrips() {
  requireModule("booking");
  const t = now();
  return db()
    .voyages.filter((v) => v.status === "scheduled" && v.routeId && new Date(v.departsAt).getTime() > t && !isManifestClosed(v.id))
    .sort((a, b) => a.departsAt.localeCompare(b.departsAt));
}

function openTrip(tripId: ID) {
  const trip = byId(db().voyages, tripId, "Trip");
  if (trip.status !== "scheduled") throw new BusinessError(`${trip.label} has already ${trip.status}.`);
  if (isModuleEnabled("manifest") && isManifestClosed(trip.id)) throw new BusinessError(`${trip.label} is closed for loading.`);
  return trip;
}

function assertRoom(tripId: ID, weightLb: number, label: string) {
  if (!hasRoomFor(tripId, weightLb)) throw new BusinessError(`${label} doesn't have room for ${weightLb} lb. Choose another trip.`);
}

/** Customer (own account) or staff. Staff bookings are confirmed straight away. */
export function requestBooking(actor: Actor, input: { customerId: ID; tripId: ID; description: string; pieces: number; weightLb: number }) {
  authorize(actor, "booking", canActOn(actor, "booking.manage", { customerId: input.customerId }), "You can only book for your own account.");
  const c = getCustomer(input.customerId);
  const trip = openTrip(input.tripId);
  if (!input.description?.trim()) throw new BusinessError("Describe the cargo.");
  if (!(input.weightLb > 0) || !(input.pieces >= 1)) throw new BusinessError("Enter the weight and number of pieces.");
  const byStaff = actor.kind === "staff";
  if (byStaff) assertRoom(trip.id, input.weightLb, trip.label);
  return mutate((s) => {
    const b: Booking = {
      id: `BKG-${nextSeq("bkg", 300)}`,
      organizationId: s.organizationId,
      customerId: c.id,
      tripId: trip.id,
      description: input.description.trim(),
      pieces: Math.round(input.pieces),
      weightLb: input.weightLb,
      status: byStaff ? "confirmed" : "requested",
      createdAt: nowIso(),
      createdBy: byStaff ? "staff" : "customer",
    };
    s.bookings.push(b);
    emit(byStaff ? "BOOKING_CONFIRMED" : "BOOKING_REQUESTED", {
      actor,
      refs: { customerId: c.id, bookingId: b.id, tripId: trip.id },
      summary: `Booking ${b.id}: ${b.pieces} pc / ${b.weightLb} lb on ${trip.label}${byStaff ? " (confirmed)" : ""}`,
      customerSummary: byStaff ? `Your space on ${trip.label} is confirmed (${b.id}).` : `We got your booking request ${b.id} for ${trip.label}.`,
    });
    return b;
  });
}

export function confirmBooking(actor: Actor, id: ID) {
  authorize(actor, "booking", can(actor, "booking.manage"), "Only staff can confirm bookings.");
  const b = getBooking(id);
  if (b.status !== "requested") throw new BusinessError(`${b.id} is already ${b.status.replace("_", " ")}.`);
  const trip = openTrip(b.tripId);
  assertRoom(trip.id, b.weightLb, trip.label);
  return mutate(() => {
    b.status = "confirmed";
    emit("BOOKING_CONFIRMED", { actor, refs: { customerId: b.customerId, bookingId: b.id, tripId: trip.id }, summary: `${b.id} confirmed on ${trip.label}`, customerSummary: `Your space on ${trip.label} is confirmed (${b.id}).` });
    return b;
  });
}

export function cancelBooking(actor: Actor, id: ID, reason = "Cancelled") {
  const b = getBooking(id);
  authorize(actor, "booking", canActOn(actor, "booking.manage", b), "You can only cancel your own bookings.");
  if (b.status === "checked_in" || b.status === "cancelled") throw new BusinessError(`${b.id} can't be cancelled now.`);
  return mutate(() => {
    b.status = "cancelled";
    emit("BOOKING_CANCELLED", { actor, refs: { customerId: b.customerId, bookingId: b.id, tripId: b.tripId }, summary: `${b.id} cancelled: ${reason}`, customerSummary: `Booking ${b.id} was cancelled.` });
    return b;
  });
}

/** Cargo arrives at the dock: weigh it, create the package + shipment, put it on the booked trip. */
export function checkInBooking(actor: Actor, id: ID, input: { actualWeight: number; pieces?: number }) {
  authorize(actor, ["booking", "shipments"], can(actor, "booking.manage") && can(actor, "shipment.create_any"), "Only dock staff can check cargo in.");
  const b = getBooking(id);
  if (b.status !== "confirmed") throw new BusinessError(b.status === "requested" ? "Confirm the booking first." : `${b.id} is ${b.status.replace("_", " ")}.`);
  const trip = openTrip(b.tripId);
  if (!(input.actualWeight > 0)) throw new BusinessError("Enter the weight.");
  if (input.actualWeight > b.weightLb && !hasRoomFor(trip.id, input.actualWeight - b.weightLb)) throw new BusinessError(`${trip.label} can't take the extra ${input.actualWeight - b.weightLb} lb.`);
  return mutate(() => {
    const pkg = checkInCargoPackage(actor, { customerId: b.customerId, description: b.description, actualWeight: input.actualWeight, destinationId: trip.destinationId, service: trip.mode, reference: b.id });
    const sh = createShipment(actor, { customerId: b.customerId, packageIds: [pkg.id], service: trip.mode, deliveryMethod: "pickup" });
    b.status = "checked_in";
    b.shipmentId = sh.id;
    if (input.pieces) b.pieces = input.pieces;
    sh.voyageId = trip.id; // space was reserved by the booking
    emit("BOOKING_CHECKED_IN", { actor, refs: { customerId: b.customerId, bookingId: b.id, shipmentId: sh.id, tripId: trip.id, packageId: pkg.id }, summary: `${b.id} checked in: ${input.actualWeight} lb → ${sh.id} on ${trip.label}`, customerSummary: `Your cargo is checked in and loading on ${trip.label}.` });
    return { booking: b, shipment: sh, package: pkg };
  });
}
