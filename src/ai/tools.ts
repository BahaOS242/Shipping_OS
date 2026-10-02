/**
 * CUSTOMER TOOLS — what the customer-facing assistant (web, WhatsApp, API/MCP) may do.
 *
 * Each tool follows the contract in contract.ts and delegates to an existing
 * service. The customer comes from the authenticated ToolContext, never from the
 * model, and every record is ownership-checked. Only three tools write
 * (createQuote, createSupportTicket, escalateToHuman). None of them has a
 * financial or operational consequence, so they run without confirmation. The AI
 * cannot pay, refund, approve customs, reconcile, or message anyone else.
 */
import { PACKAGE_COPY, DELIVERY_COPY, SHIPMENT_COPY, CLAIM_COPY } from "@/domain/copy";
import { destinations } from "@/data/reference";
import { DISCLAIMERS, RATE_CARD } from "@/domain/rates";
import { ForbiddenError } from "@/domain/roles";
import { STORAGE_RULES } from "@/domain/storage";
import type { DestinationId, ID, ServiceLevel } from "@/domain/types";
import type { ModuleId } from "@/platform/modules";
import * as svc from "@/services";
import { defineTools, obj, type JsonSchema, type ToolContext, type ToolSpec } from "./contract";

/** Island IDs for schemas (static, so tool definitions never read tenant data at import). */
const dests = () => destinations.map((d) => d.id);

/** The customer this turn acts for — from the authenticated context. */
const me = (ctx: ToolContext): ID => {
  if (!ctx.actor.customerId) throw new ForbiddenError("Customer tools need a customer.");
  return ctx.actor.customerId;
};

/** Ownership check shared by every read tool. */
function own<T extends { customerId?: ID }>(row: T | undefined, ctx: ToolContext, what: string): T {
  if (!row || row.customerId !== me(ctx)) throw new ForbiddenError(`${what} not found on your account.`);
  return row;
}

type Def = { name: string; description: string; inputSchema: JsonSchema; module: ModuleId | null; service: string; run: ToolSpec["run"] };
const read = (d: Def): ToolSpec => ({ ...d, audience: "customer", permission: "customer.self", kind: "read", confirmation: "none", audit: "trace" });
const write = (d: Def): ToolSpec => ({ ...d, audience: "customer", permission: "customer.self", kind: "write", confirmation: "none", audit: "event" });

const pkgSummary = (p: ReturnType<typeof svc.getPackage>) => ({
  id: p.id,
  merchant: p.merchant,
  itemName: p.itemName,
  status: p.status,
  statusTitle: PACKAGE_COPY[p.status].title,
  explain: PACKAGE_COPY[p.status].explain,
  next: PACKAGE_COPY[p.status].next,
  where: p.status === "received" || p.status === "preparing" ? "Florida Warehouse" : p.status === "incoming" ? "With the store's delivery company" : p.status === "in_transit" ? "On the way to The Bahamas" : p.status === "delivered" ? "With you" : "In The Bahamas",
  shipmentId: p.shipmentId,
  hasReceipt: !!p.purchaseInvoiceId,
  billableWeight: p.billableWeight,
  receivedAt: p.storage.receivedAt,
});

export const CUSTOMER_TOOLS: ToolSpec[] = defineTools([
  read({ name: "getCustomer", description: "The signed-in customer's profile and U.S. shopping address.", inputSchema: obj(), module: "customers", service: "customers.getCustomer",
    run: (_i, ctx) => { const c = svc.getCustomer(me(ctx)); return { firstName: c.firstName, accountNumber: c.accountNumber, type: c.type, home: svc.getDestination(c.homeDestination).name, homeDestinationId: c.homeDestination, shoppingAddress: svc.shoppingAddress(c) }; } }),
  read({ name: "getPackages", description: "The customer's packages with plain-language status.", inputSchema: obj(), module: "shipments", service: "packages.listPackages",
    run: (_i, ctx) => svc.listPackages({ customerId: me(ctx) }).map(pkgSummary) }),
  read({ name: "getPackage", description: "One of the customer's packages by ID (e.g. TL-PKG-10482).", inputSchema: obj({ packageId: { type: "string" } }, ["packageId"]), module: "shipments", service: "packages.findPackage",
    run: (i, ctx) => pkgSummary(own(svc.findPackage(String(i.packageId)), ctx, "Package")) }),
  read({ name: "getShipment", description: "A shipment (packages traveling together) and its trip.", inputSchema: obj({ shipmentId: { type: "string" } }, ["shipmentId"]), module: "shipments", service: "shipments.findShipment",
    run: (i, ctx) => { const sh = own(svc.findShipment(String(i.shipmentId)), ctx, "Shipment"); const v = svc.getVoyage(sh.voyageId); return { id: sh.id, status: SHIPMENT_COPY[sh.status].customer, packages: sh.packageIds.length, voyage: v?.label, arrivesAt: v?.arrivesAt, destination: svc.getDestination(sh.destinationId).name }; } }),
  read({ name: "getLocations", description: "Warehouse and pickup locations.", inputSchema: obj({ destinationId: { type: "string", enum: dests() } }), module: null, service: "locations.getLocations",
    run: (i) => (i.destinationId ? [svc.warehouse(), ...svc.pickupLocationsFor(i.destinationId as DestinationId)] : svc.getLocations()) }),
  read({ name: "getShippingRules", description: "Demo rate card, storage rules and disclaimers.", inputSchema: obj(), module: "quotes", service: "rates.RATE_CARD",
    run: () => ({ rates: RATE_CARD, storage: STORAGE_RULES, disclaimers: DISCLAIMERS, simulated: true }) }),
  read({ name: "calculateShipping", description: "Demo estimate using the central rates engine (billable weight included).", inputSchema: obj({ destinationId: { type: "string", enum: dests() }, weight: { type: "number" }, service: { type: "string", enum: ["air", "ocean"] }, length: { type: "number" }, width: { type: "number" }, height: { type: "number" } }, ["destinationId", "weight"]), module: "quotes", service: "quotes.estimate",
    run: (i) => svc.estimate({ destinationId: i.destinationId as DestinationId, service: (i.service as ServiceLevel) ?? "air", actualWeight: Number(i.weight), length: i.length as number, width: i.width as number, height: i.height as number }) }),
  write({ name: "createQuote", description: "Save a demo quote for the customer.", inputSchema: obj({ destinationId: { type: "string", enum: dests() }, weight: { type: "number" }, service: { type: "string", enum: ["air", "ocean"] } }, ["destinationId", "weight", "service"]), module: "quotes", service: "quotes.createQuote",
    run: (i, ctx) => svc.createQuote(ctx.actor, { destinationId: i.destinationId as DestinationId, service: i.service as ServiceLevel, actualWeight: Number(i.weight) }).quote }),
  read({ name: "getInvoices", description: "The customer's bills from Shipping OS with status and balance.", inputSchema: obj(), module: "billing", service: "billing.listBills",
    run: (_i, ctx) => svc.listBills({ customerId: me(ctx) }).filter((b) => b.lifecycle === "issued").map((b) => ({ id: b.id, total: b.total, paid: b.paid, balance: b.balance, status: b.status, dueAt: b.dueAt, shipmentId: b.shipmentId })) }),
  read({ name: "getInvoice", description: "One bill with its lines.", inputSchema: obj({ billId: { type: "string" } }, ["billId"]), module: "billing", service: "billing.billView",
    run: (i, ctx) => { const b = own(svc.findBill(String(i.billId)), ctx, "Bill"); const v = svc.billView(b); return { id: v.id, lines: v.lines, total: v.total, paid: v.paid, balance: v.balance, status: v.status }; } }),
  read({ name: "getPayment", description: "The customer's payments (all simulated DEMO PAYMENTS).", inputSchema: obj({ paymentId: { type: "string" } }), module: "billing", service: "billing.customerBalance",
    run: (i, ctx) => svc.customerBalance(me(ctx)).payments.filter((p) => !i.paymentId || p.id === i.paymentId).map((p) => ({ id: p.id, amount: p.amount, method: p.method, billId: p.billId, receivedAt: p.receivedAt })) }),
  read({ name: "getBalance", description: "What the customer owes right now.", inputSchema: obj(), module: "billing", service: "billing.customerBalance",
    run: (_i, ctx) => { const b = svc.customerBalance(me(ctx)); return { balance: b.balance, overdue: b.overdue, openBills: b.openBills.map((x) => ({ id: x.id, balance: x.balance, dueAt: x.dueAt })) }; } }),
  read({ name: "getClaims", description: "The customer's claims.", inputSchema: obj(), module: "support", service: "claims.listClaims",
    run: (_i, ctx) => svc.listClaims({ customerId: me(ctx) }).map((c) => ({ id: c.id, status: CLAIM_COPY[c.status].label, reason: c.reason, lastUpdate: c.updates.at(-1)?.text })) }),
  read({ name: "getSupportTickets", description: "The customer's open help requests.", inputSchema: obj(), module: "support", service: "support.listTickets",
    run: (_i, ctx) => svc.listTickets({ customerId: me(ctx) }).map((t) => ({ id: t.id, subject: t.subject, status: t.status })) }),
  write({ name: "createSupportTicket", description: "Open a help request for a person to review.", inputSchema: obj({ subject: { type: "string" }, message: { type: "string" }, packageId: { type: "string" }, billId: { type: "string" }, escalate: { type: "boolean", description: "Mark the conversation as handed to a person." } }, ["subject", "message"]), module: "support", service: "support.createTicket",
    run: (i, ctx) => {
      const t = svc.createTicket(ctx.actor, { customerId: me(ctx), channel: ctx.channel, subject: String(i.subject), message: String(i.message), packageId: i.packageId as string, billId: i.billId as string, priority: "high" });
      if (i.escalate) svc.markEscalated(ctx.actor, me(ctx), ctx.channel === "whatsapp" ? "whatsapp" : "web", t.id);
      return t;
    } }),
  read({ name: "getStorageStatus", description: "Free storage days left / storage fees for a package at the warehouse.", inputSchema: obj({ packageId: { type: "string" } }, ["packageId"]), module: "warehouse", service: "storage.packageStorage",
    run: (i, ctx) => { const p = own(svc.findPackage(String(i.packageId)), ctx, "Package"); return svc.packageStorage(p.id); } }),
  read({ name: "getDeliveryStatus", description: "Delivery or pickup status for a shipment.", inputSchema: obj({ shipmentId: { type: "string" } }, ["shipmentId"]), module: "delivery", service: "delivery.deliveryForShipment",
    run: (i, ctx) => { const sh = own(svc.findShipment(String(i.shipmentId)), ctx, "Shipment"); const d = svc.deliveryForShipment(sh.id); return d ? { status: DELIVERY_COPY[d.status].customer, method: d.method, window: d.window, driver: d.driver, address: d.address } : { status: "Not in The Bahamas yet" }; } }),
  write({ name: "escalateToHuman", description: "Hand the conversation to a person on the Shipping OS team.", inputSchema: obj({ reason: { type: "string" }, packageId: { type: "string" } }, ["reason"]), module: "support", service: "support.createTicket",
    run: (i, ctx) => { const t = svc.createTicket(ctx.actor, { customerId: me(ctx), channel: ctx.channel, subject: String(i.reason).slice(0, 80), message: String(i.reason), packageId: i.packageId as string, priority: "high" }); svc.markEscalated(ctx.actor, me(ctx), ctx.channel === "whatsapp" ? "whatsapp" : "web", t.id); return { ticketId: t.id, expectedReply: "within 15 minutes during opening hours" }; } }),
  read({ name: "getIslands", description: "Islands served, with their IDs.", inputSchema: obj(), module: null, service: "locations.getDestinations",
    run: () => svc.getDestinations().map((d) => ({ id: d.id, name: d.name })) }),
]);
