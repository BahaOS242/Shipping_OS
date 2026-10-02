/**
 * STAFF TOOLS — the contract for the future operations assistant.
 *
 * The AI acts as the signed-in staff user (actor marked `via: "ai"`), so it has
 * exactly that user's organization, modules and role permissions — never more.
 * Reads run automatically. Every write here has an operational or financial
 * consequence, so it only PROPOSES; the real service runs after the same user
 * confirms (executor.ts). No business rule lives here: each tool names the
 * service that does the work and repeats every check.
 */
import type { BookingStatus, DeliveryStatus, ShipmentStatus } from "@/domain/types";
import * as svc from "@/services";
import { defineTools, obj, type ToolSpec } from "./contract";

const fmtDateTime = (iso: string) => new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const str = (v: unknown) => String(v ?? "").trim();
const num = (v: unknown) => Number(v);

type R = Omit<ToolSpec, "audience" | "kind" | "confirmation" | "audit">;
const read = (d: R): ToolSpec => ({ ...d, audience: "staff", kind: "read", confirmation: "none", audit: "trace" });
const consequential = (d: R & { preview: NonNullable<ToolSpec["preview"]> }): ToolSpec => ({ ...d, audience: "staff", kind: "write", confirmation: "required", audit: "event" });

const tripSummary = (id: string) => {
  const d = svc.tripDetails(svc.getTrip(id));
  return { id: d.trip.id, label: d.trip.label, status: d.trip.status, route: d.route?.name, vessel: d.vessel?.name, departsAt: d.trip.departsAt, arrivesAt: d.trip.arrivesAt, shipments: d.shipments.length, bookingsWaiting: d.bookings.filter((b) => b.status !== "checked_in").length, manifestClosed: d.manifestClosed, capacity: d.capacity };
};

export const STAFF_TOOLS: ToolSpec[] = defineTools([
  /* ---------------- Reads ---------------- */
  read({ name: "searchShipments", description: "Find shipments by ID, customer name or status.", inputSchema: obj({ query: { type: "string" }, status: { type: "string" } }), module: "shipments", permission: "operations.read", service: "shipments.listShipments",
    run: (i) => {
      const q = str(i.query).toLowerCase();
      return svc
        .listShipments({ status: (str(i.status) || undefined) as ShipmentStatus | undefined })
        .filter((s) => !q || s.id.toLowerCase().includes(q) || svc.customerName(svc.findCustomer(s.customerId)).toLowerCase().includes(q))
        .slice(0, 25)
        .map((s) => ({ id: s.id, customer: svc.customerName(svc.findCustomer(s.customerId)), status: s.status, destination: s.destinationId, service: s.service, packages: s.packageIds.length, tripId: s.voyageId }));
    } }),
  read({ name: "listTodaysTrips", description: "Today's sailings/flights with load and capacity.", inputSchema: obj(), module: "schedules", permission: "operations.read", service: "network.todaysTrips",
    run: () => svc.todaysTrips().map((t) => tripSummary(t.id)) }),
  read({ name: "getTrip", description: "One trip: route, vessel, departure, load, bookings, manifest state.", inputSchema: obj({ tripId: { type: "string" } }, ["tripId"]), module: "schedules", permission: "operations.read", service: "network.tripDetails",
    run: (i) => tripSummary(str(i.tripId)) }),
  read({ name: "getTripCapacity", description: "Weight capacity, used and remaining on a trip.", inputSchema: obj({ tripId: { type: "string" } }, ["tripId"]), module: "capacity", permission: "operations.read", service: "capacity.tripCapacity",
    run: (i) => svc.tripCapacity(svc.getTrip(str(i.tripId))) }),
  read({ name: "getManifest", description: "Manifest lines and totals for a trip.", inputSchema: obj({ tripId: { type: "string" } }, ["tripId"]), module: "manifest", permission: "operations.read", service: "manifests.manifestFor",
    run: (i) => {
      const m = svc.manifestFor(str(i.tripId));
      return { tripId: m.trip.id, trip: m.trip.label, status: m.status, totals: m.totals, lines: m.lines.map((l) => ({ shipmentId: l.shipment.id, customer: l.customer, description: l.description, pieces: l.pieces, weightLb: l.weightLb, bookingId: l.bookingId })) };
    } }),
  read({ name: "listBookings", description: "Bookings, optionally by status or trip.", inputSchema: obj({ status: { type: "string", enum: ["requested", "confirmed", "checked_in", "cancelled"] }, tripId: { type: "string" } }), module: "booking", permission: "operations.read", service: "bookings.listBookings",
    run: (i) => svc.listBookings({ status: (str(i.status) || undefined) as BookingStatus | undefined, tripId: str(i.tripId) || undefined }).map((b) => ({ id: b.id, customer: svc.customerName(svc.findCustomer(b.customerId)), tripId: b.tripId, description: b.description, pieces: b.pieces, weightLb: b.weightLb, status: b.status })) }),
  read({ name: "listDeliveries", description: "Last-mile deliveries, optionally by status.", inputSchema: obj({ status: { type: "string" } }), module: "delivery", permission: "operations.read", service: "delivery.listDeliveries",
    run: (i) => svc.listDeliveries({ status: (str(i.status) || undefined) as DeliveryStatus | undefined }).map((d) => ({ id: d.id, customer: svc.customerName(svc.findCustomer(d.customerId)), status: d.status, driver: d.driver, window: d.window, address: d.address })) }),
  read({ name: "summarizeWarehouse", description: "Warehouse queues: arriving, at the dock, stored, packing, ready, needing attention.", inputSchema: obj(), module: "warehouse", permission: "operations.read", service: "warehouse.warehouseQueues",
    run: () => {
      const q = svc.warehouseQueues();
      return { arriving: q.arriving.length, atDock: q.atDock.length, atWarehouse: q.atWarehouse.length, packing: q.packing.length, readyToSend: q.readyToSend.length, needsAttention: q.needsAttention.length };
    } }),
  read({ name: "getCustomerBalance", description: "What a customer owes, overdue amount and open bills.", inputSchema: obj({ customerId: { type: "string" } }, ["customerId"]), module: "billing", permission: "billing.read_any", service: "billing.customerBalance",
    run: (i) => {
      const c = svc.getCustomer(str(i.customerId));
      const b = svc.customerBalance(c.id);
      return { customer: svc.customerName(c), balance: b.balance, overdue: b.overdue, openBills: b.openBills.map((x) => ({ id: x.id, balance: x.balance, dueAt: x.dueAt })) };
    } }),

  /* ---------------- Consequential writes (confirmation required) ---------------- */
  consequential({ name: "createBooking", description: "Reserve space for a customer on a trip (confirmed booking).", inputSchema: obj({ customerId: { type: "string" }, tripId: { type: "string" }, description: { type: "string" }, pieces: { type: "number" }, weightLb: { type: "number" } }, ["customerId", "tripId", "description", "pieces", "weightLb"]), module: "booking", permission: "booking.manage", service: "bookings.requestBooking",
    preview: (i) => {
      const t = svc.getTrip(str(i.tripId));
      const c = svc.tripCapacity(t);
      return { title: `Book ${num(i.weightLb).toLocaleString()} lb on ${t.label}`, lines: [`Customer: ${svc.customerName(svc.getCustomer(str(i.customerId)))}`, `Cargo: ${str(i.description)} · ${num(i.pieces)} pc`, `Departs ${fmtDateTime(t.departsAt)}`, c.remainingLb === undefined ? "No capacity limit" : `${c.remainingLb.toLocaleString()} lb free before this booking`] };
    },
    run: (i, ctx) => svc.requestBooking(ctx.actor, { customerId: str(i.customerId), tripId: str(i.tripId), description: str(i.description), pieces: num(i.pieces), weightLb: num(i.weightLb) }) }),
  consequential({ name: "closeManifest", description: "Finalize a trip's manifest: no more loading after this.", inputSchema: obj({ tripId: { type: "string" } }, ["tripId"]), module: "manifest", permission: "manifest.manage", service: "manifests.closeManifest",
    preview: (i) => {
      const m = svc.manifestFor(str(i.tripId));
      return { title: `Close the manifest for ${m.trip.label}`, lines: [`${m.totals.shipments} shipments · ${m.totals.pieces} pieces`, `Total weight: ${m.totals.weightLb.toLocaleString()} lb`, `Departs ${fmtDateTime(m.trip.departsAt)}`] };
    },
    run: (i, ctx) => svc.closeManifest(ctx.actor, str(i.tripId)) }),
  consequential({ name: "assignShipmentToTrip", description: "Plan a cleared shipment onto a specific trip.", inputSchema: obj({ shipmentId: { type: "string" }, tripId: { type: "string" } }, ["shipmentId", "tripId"]), module: "shipments", permission: "shipment.move", service: "network.assignShipmentToTrip",
    preview: (i) => {
      const sh = svc.getShipment(str(i.shipmentId));
      const t = svc.getTrip(str(i.tripId));
      return { title: `Load ${sh.id} on ${t.label}`, lines: [`Customer: ${svc.customerName(svc.findCustomer(sh.customerId))}`, `${sh.packageIds.length} packages`, `Departs ${fmtDateTime(t.departsAt)}`] };
    },
    run: (i, ctx) => svc.assignShipmentToTrip(ctx.actor, str(i.shipmentId), str(i.tripId)) }),
  consequential({ name: "assignDriver", description: "Schedule a home delivery with a driver and time window.", inputSchema: obj({ deliveryId: { type: "string" }, driver: { type: "string" }, date: { type: "string" }, from: { type: "string" }, to: { type: "string" } }, ["deliveryId", "driver", "date", "from", "to"]), module: "delivery", permission: "delivery.manage", service: "delivery.scheduleDelivery",
    preview: (i) => {
      const d = svc.getDelivery(str(i.deliveryId));
      return { title: `Assign ${d.id} to ${str(i.driver)}`, lines: [`${svc.customerName(svc.findCustomer(d.customerId))} · ${d.address}`, `${str(i.date).slice(0, 10)} ${str(i.from)}–${str(i.to)}`, d.fee > 0 && d.status === "not_scheduled" ? `Delivery fee $${d.fee.toFixed(2)} will be billed` : "No new charge"] };
    },
    run: (i, ctx) => svc.scheduleDelivery(ctx.actor, str(i.deliveryId), { driver: str(i.driver), date: str(i.date), from: str(i.from), to: str(i.to) }) }),
  consequential({ name: "addCharge", description: "Add a charge to a customer's bill (issues a bill if needed).", inputSchema: obj({ customerId: { type: "string" }, description: { type: "string" }, amount: { type: "number" }, shipmentId: { type: "string" } }, ["customerId", "description", "amount"]), module: "billing", permission: "billing.record_payment", service: "billing.addCharge",
    preview: (i) => ({ title: `Charge ${svc.customerName(svc.getCustomer(str(i.customerId)))} $${num(i.amount).toFixed(2)}`, lines: [str(i.description), i.shipmentId ? `On shipment ${str(i.shipmentId)}` : "New bill"] }),
    run: (i, ctx) => svc.addCharge(ctx.actor, { customerId: str(i.customerId), kind: "other", description: str(i.description), amount: num(i.amount), shipmentId: str(i.shipmentId) || undefined }) }),
  consequential({ name: "sendCustomerMessage", description: "Send a WhatsApp message to a customer as this staff member.", inputSchema: obj({ customerId: { type: "string" }, text: { type: "string" } }, ["customerId", "text"]), module: "customers", permission: "customer.read_any", service: "support.staffMessage",
    preview: (i) => ({ title: `Message ${svc.customerName(svc.getCustomer(str(i.customerId)))} on WhatsApp`, lines: [`“${str(i.text)}”`] }),
    run: (i, ctx) => svc.staffMessage(ctx.actor, str(i.customerId), str(i.text)) }),
]);
