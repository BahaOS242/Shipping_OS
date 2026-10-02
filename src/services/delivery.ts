/**
 * DELIVERY SERVICE — last mile in The Bahamas.
 * Arrival creates a delivery record; pickup shipments become "Ready for you" at once.
 * Home delivery: not scheduled → scheduled → out for delivery → delivered (with proof) / failed → rescheduled.
 */
import { nowIso } from "@/data/clock";
import { db, mutate, nextSeq } from "@/data/store";
import { can } from "@/domain/roles";
import type { Actor, Delivery, DeliveryStatus, ID } from "@/domain/types";
import { SYSTEM, emit } from "@/events/bus";
import { BusinessError, byId } from "./_shared";
import { authorize, isModuleEnabled } from "./access";
import { addCharge } from "./billing";
import { getCustomer } from "./customers";
import { ensureException } from "./exceptions";
import { getDestination, getLocation } from "./locations";
import { getShipment, onShipmentArrived, shipmentPackages } from "./shipments";

/** Drivers without their own sign-in (vans, partner couriers) — the original demo fleet. */
export const DRIVERS = ["Andre (Van 2)", "Kayla (Van 1)", "Rodney (Truck 1)", "Partner courier — Exuma", "Partner courier — Abaco"];

/** Who can be assigned a run: the organization's driver accounts, else the demo fleet. */
export function listDrivers() {
  const staff = db().staff.filter((u) => u.role === "driver").map((u) => u.name);
  return staff.length ? staff : DRIVERS;
}

/** A driver's run: their deliveries that are planned or on the road, plus today's completed ones. */
export function driverRun(driver: string) {
  const today = new Date().toDateString();
  return db().deliveries.filter((d) => d.driver === driver && (["scheduled", "rescheduled", "out_for_delivery"].includes(d.status) || (d.proof && new Date(d.proof.at).toDateString() === today)));
}

export const getDelivery = (id: ID) => byId(db().deliveries, id, "Delivery");
export const deliveryForShipment = (shipmentId?: ID) => db().deliveries.find((d) => d.shipmentId === shipmentId);

export function listDeliveries(f: { status?: DeliveryStatus; method?: Delivery["method"]; customerId?: ID } = {}) {
  return db()
    .deliveries.filter((d) => (!f.status || d.status === f.status) && (!f.method || d.method === f.method) && (!f.customerId || d.customerId === f.customerId))
    .sort((a, b) => (a.window?.date ?? "9").localeCompare(b.window?.date ?? "9"));
}

onShipmentArrived((sh, actor) => {
  if (!isModuleEnabled("delivery")) return; // no last-mile module: the shipment simply arrives
  const c = getCustomer(sh.customerId);
  const dest = getDestination(sh.destinationId);
  const pickup = sh.deliveryMethod === "pickup" || !dest.homeDelivery;
  const loc = getLocation(dest.pickupLocationIds[0]);
  const d: Delivery = {
    id: `DLV-${nextSeq("dlv", 800)}`,
    organizationId: sh.organizationId,
    shipmentId: sh.id,
    customerId: c.id,
    method: pickup ? "pickup" : "home_delivery",
    status: pickup ? "scheduled" : "not_scheduled",
    address: pickup ? `${loc?.name ?? "Pickup center"} — ${loc?.addressLines.join(", ")}` : c.deliveryAddress,
    window: pickup ? { date: nowIso(), from: "Opening hours", to: loc?.hours ?? "" } : undefined,
    fee: pickup ? 0 : dest.homeDeliveryFee,
    notes: [],
    attempts: 0,
  };
  db().deliveries.push(d);
  if (pickup) {
    sh.status = "ready_for_pickup";
    for (const p of shipmentPackages(sh)) p.status = "ready";
    emit("PACKAGE_READY", { actor, refs: { customerId: c.id, shipmentId: sh.id, deliveryId: d.id }, summary: `Ready for pickup at ${loc?.name}`, customerSummary: `Ready for you at ${loc?.name}. Bring your ID.` });
  }
});

/**
 * `manage` = planning (schedule); `drive` = working the run (dispatch, deliver, fail).
 * A driver may only work deliveries assigned to them.
 */
function act(actor: Actor, id: ID, fn: (d: Delivery) => void, kind: "manage" | "drive" = "manage") {
  const permitted = can(actor, "delivery.manage") || (kind === "drive" && can(actor, "delivery.driver"));
  authorize(actor, "delivery", permitted, "Only the delivery team can do that.");
  return mutate(() => {
    const d = getDelivery(id);
    if (kind === "drive" && actor.role === "driver" && d.driver !== actor.name) throw new BusinessError("This delivery isn't on your run.");
    fn(d);
    return d;
  });
}

export const scheduleDelivery = (actor: Actor, id: ID, input: { date: string; from: string; to: string; driver: string; route?: string; address?: string }) =>
  act(actor, id, (d) => {
    if (d.method !== "home_delivery") throw new BusinessError("Pickup orders don't need scheduling.");
    if (["delivered", "out_for_delivery"].includes(d.status)) throw new BusinessError("Too late to reschedule.");
    const again = d.status === "failed" || d.status === "scheduled" || d.status === "rescheduled";
    d.window = { date: input.date, from: input.from, to: input.to };
    d.driver = input.driver;
    d.route = input.route || d.route || "Route A";
    if (input.address) d.address = input.address;
    d.status = again ? "rescheduled" : "scheduled";
    const sh = getShipment(d.shipmentId);
    for (const p of shipmentPackages(sh)) p.status = "ready";
    if (!again && d.fee > 0 && isModuleEnabled("billing")) addCharge(SYSTEM, { customerId: d.customerId, shipmentId: d.shipmentId, kind: "delivery", description: `Home delivery — ${getDestination(sh.destinationId).name}`, amount: d.fee });
    const when = new Date(input.date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
    emit("DELIVERY_SCHEDULED", { actor, refs: { customerId: d.customerId, shipmentId: d.shipmentId, deliveryId: d.id }, summary: `${again ? "Rescheduled" : "Scheduled"} ${when} ${input.from}–${input.to}, ${input.driver}`, customerSummary: `Delivery ${again ? "rescheduled" : "scheduled"}: ${when}, ${input.from}–${input.to}.` });
  });

export const dispatchDelivery = (actor: Actor, id: ID) =>
  act(actor, id, (d) => {
    if (!["scheduled", "rescheduled"].includes(d.status) || d.method !== "home_delivery") throw new BusinessError("Schedule it first.");
    d.status = "out_for_delivery";
    d.attempts++;
    getShipment(d.shipmentId).status = "out_for_delivery";
    emit("OUT_FOR_DELIVERY", { actor, refs: { customerId: d.customerId, shipmentId: d.shipmentId, deliveryId: d.id }, summary: `Out for delivery with ${d.driver}`, customerSummary: "Your package is out for delivery 🚚" });
  }, "drive");

function signature(name: string) {
  // A simple generated squiggle — simulated proof of delivery.
  let x = 10;
  const pts = [...name].map((ch, i) => `${(x += 8 + (ch.charCodeAt(0) % 7))},${20 + ((ch.charCodeAt(0) * (i + 3)) % 22)}`);
  return `M10,30 L${pts.join(" L")}`;
}

export const completeDelivery = (actor: Actor, id: ID, input: { receivedBy: string; note?: string }) =>
  act(actor, id, (d) => {
    const ok = d.method === "pickup" ? ["scheduled", "not_scheduled"].includes(d.status) : d.status === "out_for_delivery";
    if (!ok) throw new BusinessError(d.method === "pickup" ? "Already collected." : "It must be out for delivery first.");
    if (!input.receivedBy.trim()) throw new BusinessError("Who received it?");
    d.status = "delivered";
    d.proof = { receivedBy: input.receivedBy.trim(), at: nowIso(), signature: signature(input.receivedBy), photo: `pod:${d.id}`, gps: d.method === "home_delivery" ? "25.06°N, 77.34°W (simulated)" : undefined };
    if (input.note) d.notes.push({ at: nowIso(), by: actor.name, text: input.note });
    const sh = getShipment(d.shipmentId);
    sh.status = "completed";
    sh.completedAt = nowIso();
    for (const p of shipmentPackages(sh)) p.status = "delivered";
    emit("PACKAGE_DELIVERED", {
      actor,
      refs: { customerId: d.customerId, shipmentId: d.shipmentId, deliveryId: d.id },
      summary: `${d.method === "pickup" ? "Collected" : "Delivered"} — received by ${d.proof.receivedBy}`,
      customerSummary: d.method === "pickup" ? "You picked up your package. Delivered 🎉" : "Delivered 🎉",
    });
  }, "drive");

export const failDelivery = (actor: Actor, id: ID, reason: string) =>
  act(actor, id, (d) => {
    if (d.status !== "out_for_delivery") throw new BusinessError("Only deliveries on the road can fail.");
    d.status = "failed";
    d.notes.push({ at: nowIso(), by: actor.name, text: reason });
    getShipment(d.shipmentId).status = "arrived";
    emit("DELIVERY_FAILED", { actor, refs: { customerId: d.customerId, shipmentId: d.shipmentId, deliveryId: d.id }, summary: `Delivery failed: ${reason}`, customerSummary: "We missed you today. We'll set a new delivery time." });
    if (/address|find|gate|wrong/i.test(reason)) ensureException({ type: "ADDRESS_PROBLEM", customerId: d.customerId, shipmentId: d.shipmentId, detail: reason });
  }, "drive");
