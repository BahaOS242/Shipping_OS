/**
 * NETWORK SERVICE — the inter-island network: ports, routes, vessels,
 * schedules and the trips they generate.
 *
 * Trips are the existing Voyage records (flights/sailings), now optionally tied
 * to a route, vessel and schedule. Shipments ride trips; manifests list them.
 *
 *   Route + Vessel → Schedule → Trips → (shipments / bookings) → Manifest → depart → arrive
 */
import { DAY, HOUR, now, nowIso } from "@/data/clock";
import { db, mutate, nextSeq } from "@/data/store";
import { can } from "@/domain/roles";
import type { Actor, DestinationId, ID, Port, Route, Schedule, ServiceLevel, Vessel, VesselKind, Voyage } from "@/domain/types";
import { emit } from "@/events/bus";
import { BusinessError, byId } from "./_shared";
import { authorize, isModuleEnabled } from "./access";
import { hasRoomFor, tripCapacity } from "./capacity";
import { closeManifest, isManifestClosed } from "./manifests";
import { arriveShipment, departShipment, getShipment, shipmentPackages } from "./shipments";

const manage = (actor: Actor, module: "routes" | "vessels" | "schedules") => authorize(actor, module, can(actor, "network.manage"), "Only managers and dispatchers can change the network.");

/* ---------------- Ports & routes ---------------- */

export const listPorts = () => db().ports;
export const getPort = (id: ID) => byId(db().ports, id, "Port");

export function createPort(actor: Actor, input: { code: string; name: string; kind?: Port["kind"]; destinationId?: DestinationId }) {
  manage(actor, "routes");
  const code = input.code?.trim().toUpperCase();
  if (!code || !input.name?.trim()) throw new BusinessError("Port code and name are required.");
  if (db().ports.some((p) => p.code === code)) throw new BusinessError(`Port ${code} already exists.`);
  if (input.destinationId && !db().destinations.some((d) => d.id === input.destinationId)) throw new BusinessError(`Unknown island "${input.destinationId}".`);
  if (input.kind && !["seaport", "dock", "airport"].includes(input.kind)) throw new BusinessError(`Unknown port type "${input.kind}".`);
  return mutate((s) => {
    const p: Port = { id: `PRT-${nextSeq("prt", 100)}`, organizationId: s.organizationId, code, name: input.name.trim(), kind: input.kind ?? "dock", destinationId: input.destinationId };
    s.ports.push(p);
    emit("NETWORK_UPDATED", { actor, refs: {}, summary: `Port ${p.code} — ${p.name} added` });
    return p;
  });
}

export const listRoutes = () => db().routes;
export const getRoute = (id: ID) => byId(db().routes, id, "Route");
export const findRoute = (id?: ID) => db().routes.find((r) => r.id === id);

export function createRoute(actor: Actor, input: { code: string; name?: string; mode: ServiceLevel; portIds: ID[]; transitHours: number }) {
  manage(actor, "routes");
  if (!input.code?.trim()) throw new BusinessError("Route code is required.");
  if (input.portIds.length < 2) throw new BusinessError("A route needs an origin and at least one destination port.");
  if (new Set(input.portIds).size !== input.portIds.length) throw new BusinessError("A port can only appear once on a route.");
  const ports = input.portIds.map(getPort);
  const last = ports.at(-1)!;
  if (!last.destinationId) throw new BusinessError(`${last.name} isn't on an island in your network.`);
  if (!(input.transitHours > 0)) throw new BusinessError("Transit time must be above 0 hours.");
  return mutate((s) => {
    const r: Route = {
      id: `RTE-${nextSeq("rte", 100)}`,
      organizationId: s.organizationId,
      code: input.code.trim().toUpperCase(),
      name: input.name?.trim() || ports.map((p) => p.name.split(",")[0]).join(" → "),
      mode: input.mode,
      portIds: ports.map((p) => p.id),
      destinationId: last.destinationId!,
      transitHours: input.transitHours,
      active: true,
    };
    s.routes.push(r);
    emit("NETWORK_UPDATED", { actor, refs: {}, summary: `Route ${r.code} added: ${r.name}` });
    return r;
  });
}

/* ---------------- Vessels ---------------- */

export const VESSEL_KINDS: { id: VesselKind; label: string }[] = [
  { id: "mailboat", label: "Mailboat" },
  { id: "cargo_vessel", label: "Cargo vessel" },
  { id: "ferry", label: "Ferry" },
  { id: "barge", label: "Barge" },
  { id: "aircraft", label: "Aircraft" },
];

export const listVessels = () => db().vessels;
export const getVessel = (id: ID) => byId(db().vessels, id, "Vessel");
export const findVessel = (id?: ID) => db().vessels.find((v) => v.id === id);

export function createVessel(actor: Actor, input: { name: string; kind: VesselKind; capacityLb: number; registration?: string }) {
  manage(actor, "vessels");
  if (!input.name?.trim()) throw new BusinessError("Vessel name is required.");
  if (!VESSEL_KINDS.some((k) => k.id === input.kind)) throw new BusinessError(`Unknown vessel type "${input.kind}".`);
  if (!(input.capacityLb > 0)) throw new BusinessError("Capacity must be above 0 lb.");
  return mutate((s) => {
    const v: Vessel = { id: `VSL-${nextSeq("vsl", 100)}`, organizationId: s.organizationId, name: input.name.trim(), kind: input.kind, capacityLb: input.capacityLb, registration: input.registration?.trim() || undefined, status: "active" };
    s.vessels.push(v);
    emit("NETWORK_UPDATED", { actor, refs: {}, summary: `Vessel ${v.name} added (${v.capacityLb.toLocaleString()} lb)` });
    return v;
  });
}

export function setVesselStatus(actor: Actor, id: ID, status: Vessel["status"]) {
  manage(actor, "vessels");
  return mutate(() => {
    const v = getVessel(id);
    v.status = status;
    emit("NETWORK_UPDATED", { actor, refs: {}, summary: `${v.name} is now ${status}` });
    return v;
  });
}

/* ---------------- Schedules → trips ---------------- */

export const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const listSchedules = () => db().schedules;
export const getSchedule = (id: ID) => byId(db().schedules, id, "Schedule");

export function createSchedule(actor: Actor, input: { routeId: ID; vesselId: ID; daysOfWeek: number[]; departureTime: string }) {
  manage(actor, "schedules");
  const route = getRoute(input.routeId);
  const vessel = getVessel(input.vesselId);
  const days = [...new Set(input.daysOfWeek)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
  if (!days.length) throw new BusinessError("Pick at least one sailing day.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.departureTime)) throw new BusinessError("Departure time must look like 07:30.");
  return mutate((s) => {
    const sc: Schedule = { id: `SCH-${nextSeq("sch", 100)}`, organizationId: s.organizationId, routeId: route.id, vesselId: vessel.id, daysOfWeek: days, departureTime: input.departureTime, active: true };
    s.schedules.push(sc);
    emit("NETWORK_UPDATED", { actor, refs: {}, summary: `Schedule: ${vessel.name} on ${route.code}, ${days.map((d) => DAY_NAMES[d]).join("/")} ${sc.departureTime}` });
    return sc;
  });
}

/** Create the trips a schedule implies for a date window (idempotent). */
export function generateTrips(actor: Actor, scheduleId: ID, window: { fromDaysAgo?: number; days?: number } = {}) {
  manage(actor, "schedules");
  const sc = getSchedule(scheduleId);
  const route = getRoute(sc.routeId);
  const vessel = getVessel(sc.vesselId);
  const [hh, mm] = sc.departureTime.split(":").map(Number);
  const start = new Date(now() - (window.fromDaysAgo ?? 0) * DAY);
  start.setHours(0, 0, 0, 0);
  return mutate((s) => {
    const created: Voyage[] = [];
    for (let i = 0; i < (window.days ?? 14); i++) {
      const day = new Date(start.getTime() + i * DAY);
      if (!sc.daysOfWeek.includes(day.getDay())) continue;
      day.setHours(hh, mm, 0, 0);
      const departsAt = day.toISOString();
      if (s.voyages.some((v) => v.scheduleId === sc.id && v.departsAt === departsAt)) continue;
      const v: Voyage = {
        id: `TRP-${nextSeq("trp", 1000)}`,
        organizationId: s.organizationId,
        label: `${vessel.name} · ${route.code}`,
        mode: route.mode,
        destinationId: route.destinationId,
        departsAt,
        arrivesAt: new Date(day.getTime() + route.transitHours * HOUR).toISOString(),
        status: "scheduled",
        routeId: route.id,
        vesselId: vessel.id,
        scheduleId: sc.id,
      };
      s.voyages.push(v);
      created.push(v);
    }
    if (created.length) emit("TRIP_SCHEDULED", { actor, refs: {}, summary: `${created.length} trips scheduled for ${vessel.name} on ${route.code}` });
    return created;
  });
}

/* ---------------- Trips ---------------- */

export const getTrip = (id: ID) => byId(db().voyages, id, "Trip");

export function listTrips(f: { fromDaysAgo?: number; days?: number; status?: Voyage["status"]; routed?: boolean } = {}) {
  const from = now() - (f.fromDaysAgo ?? 1) * DAY;
  const to = now() + (f.days ?? 14) * DAY;
  return db()
    .voyages.filter((v) => {
      const t = new Date(v.departsAt).getTime();
      return t >= from && t <= to && (!f.status || v.status === f.status) && (!f.routed || !!v.routeId);
    })
    .sort((a, b) => a.departsAt.localeCompare(b.departsAt));
}

export function todaysTrips() {
  const d = new Date(now()).toDateString();
  return db()
    .voyages.filter((v) => new Date(v.departsAt).toDateString() === d)
    .sort((a, b) => a.departsAt.localeCompare(b.departsAt));
}

/** Everything a trip card needs. */
export function tripDetails(trip: Voyage) {
  return {
    trip,
    route: findRoute(trip.routeId),
    vessel: findVessel(trip.vesselId),
    capacity: tripCapacity(trip),
    shipments: db().shipments.filter((sh) => sh.voyageId === trip.id),
    bookings: db().bookings.filter((b) => b.tripId === trip.id && b.status !== "cancelled"),
    manifestClosed: isManifestClosed(trip.id),
  };
}

function assertOpenTrip(trip: Voyage) {
  if (trip.status !== "scheduled") throw new BusinessError(`${trip.label} has already ${trip.status === "cancelled" ? "been cancelled" : trip.status}.`);
  if (isModuleEnabled("manifest") && isManifestClosed(trip.id)) throw new BusinessError(`The manifest for ${trip.label} is closed.`);
}

/** Put a shipment on a specific trip (planning the load before departure). */
export function assignShipmentToTrip(actor: Actor, shipmentId: ID, tripId: ID) {
  authorize(actor, "shipments", can(actor, "shipment.move"), "Only dispatch or the warehouse can plan loads.");
  const sh = getShipment(shipmentId);
  const trip = getTrip(tripId);
  assertOpenTrip(trip);
  if (["departed", "arrived", "out_for_delivery", "ready_for_pickup", "completed"].includes(sh.status)) throw new BusinessError(`${sh.id} has already left.`);
  if (trip.destinationId !== sh.destinationId) throw new BusinessError(`${trip.label} doesn't go to this shipment's island.`);
  if (trip.mode !== sh.service) throw new BusinessError(`${sh.id} is booked by ${sh.service}, this trip is ${trip.mode}.`);
  const weight = shipmentPackages(sh).reduce((a, p) => a + (p.actualWeight ?? 0), 0);
  if (sh.voyageId !== trip.id && !hasRoomFor(trip.id, weight)) throw new BusinessError(`${trip.label} is full.`);
  return mutate(() => {
    sh.voyageId = trip.id;
    emit("SHIPMENT_ASSIGNED_TO_TRIP", { actor, refs: { customerId: sh.customerId, shipmentId: sh.id, tripId: trip.id }, summary: `${sh.id} planned on ${trip.label}`, customerSummary: `Your shipment is planned on ${trip.label}, departing ${new Date(trip.departsAt).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}.` });
    return sh;
  });
}

/** The whole trip departs: closes its manifest and departs every cleared shipment on it. */
export function departTrip(actor: Actor, tripId: ID) {
  authorize(actor, "schedules", can(actor, "shipment.move"), "Only dispatch can depart a trip.");
  const trip = getTrip(tripId);
  if (trip.status !== "scheduled") throw new BusinessError(`${trip.label} has already ${trip.status}.`);
  return mutate((s) => {
    if (isModuleEnabled("manifest") && !isManifestClosed(trip.id)) closeManifest(actor, trip.id);
    const left: ID[] = [];
    for (const sh of s.shipments.filter((x) => x.voyageId === trip.id)) {
      if (sh.status === "cleared") departShipment(actor, sh.id);
      else if (!["departed", "arrived", "completed", "ready_for_pickup", "out_for_delivery"].includes(sh.status)) {
        sh.voyageId = undefined; // not ready — rolls to a later trip
        left.push(sh.id);
      }
    }
    trip.status = "departed";
    emit("TRIP_DEPARTED", { actor, refs: { tripId: trip.id }, summary: `${trip.label} departed${left.length ? ` (${left.join(", ")} not ready, left behind)` : ""}` });
    return { trip, leftBehind: left };
  });
}

export function arriveTrip(actor: Actor, tripId: ID) {
  authorize(actor, "schedules", can(actor, "shipment.move"), "Only dispatch can arrive a trip.");
  const trip = getTrip(tripId);
  if (trip.status !== "departed") throw new BusinessError("Only departed trips can arrive.");
  return mutate((s) => {
    for (const sh of s.shipments.filter((x) => x.voyageId === trip.id && x.status === "departed")) arriveShipment(actor, sh.id);
    trip.status = "arrived";
    emit("TRIP_ARRIVED", { actor, refs: { tripId: trip.id }, summary: `${trip.label} arrived at ${nowIso().slice(11, 16)}` });
    return trip;
  });
}
