/**
 * CONTROLLED TOOLS — the only things the AI can do.
 *
 *   AI → Tool → Authorization (scoped to the signed-in customer) → Business logic → Data
 *
 * - Each tool has a JSON Schema, so it maps 1:1 to an LLM tool or an MCP tool.
 * - The customer comes from ToolContext (set by the channel), never from the model.
 * - Read tools return facts from services; the AI never invents statuses, prices,
 *   balances, tracking, customs decisions or payments.
 * - Only three tools write: createQuote, createSupportTicket, escalateToHuman.
 *   The AI cannot pay, refund, approve customs, reconcile, or message anyone else.
 */
import { PACKAGE_COPY, DELIVERY_COPY, SHIPMENT_COPY, CLAIM_COPY } from "@/domain/copy";
import { DISCLAIMERS, RATE_CARD } from "@/domain/rates";
import { STORAGE_RULES } from "@/domain/storage";
import type { Channel, DestinationId, ID, ServiceLevel } from "@/domain/types";
import * as svc from "@/services";
import { ForbiddenError } from "@/domain/roles";

export type ToolContext = { customerId: ID; channel: Channel };

type Schema = { type: "object"; properties: Record<string, { type: string; description?: string; enum?: readonly string[] }>; required?: string[]; additionalProperties: false };

export type ToolDef = {
  name: string;
  description: string;
  inputSchema: Schema;
  access: "read" | "write";
  run: (input: Record<string, unknown>, ctx: ToolContext) => unknown;
};

const obj = (properties: Schema["properties"] = {}, required: string[] = []): Schema => ({ type: "object", properties, required, additionalProperties: false });
const dests = () => svc.getDestinations().map((d) => d.id);

/** Ownership check shared by every read tool. */
function own<T extends { customerId?: ID }>(row: T | undefined, ctx: ToolContext, what: string): T {
  if (!row || row.customerId !== ctx.customerId) throw new ForbiddenError(`${what} not found on your account.`);
  return row;
}

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

export const TOOLS: ToolDef[] = [
  { name: "getCustomer", description: "The signed-in customer's profile and U.S. shopping address.", inputSchema: obj(), access: "read",
    run: (_i, ctx) => { const c = svc.getCustomer(ctx.customerId); return { firstName: c.firstName, accountNumber: c.accountNumber, type: c.type, home: svc.getDestination(c.homeDestination).name, shoppingAddress: svc.shoppingAddress(c) }; } },
  { name: "getPackages", description: "The customer's packages with plain-language status.", inputSchema: obj(), access: "read",
    run: (_i, ctx) => svc.listPackages({ customerId: ctx.customerId }).map(pkgSummary) },
  { name: "getPackage", description: "One of the customer's packages by ID (e.g. TL-PKG-10482).", inputSchema: obj({ packageId: { type: "string" } }, ["packageId"]), access: "read",
    run: (i, ctx) => pkgSummary(own(svc.findPackage(String(i.packageId)), ctx, "Package")) },
  { name: "getShipment", description: "A shipment (packages traveling together) and its trip.", inputSchema: obj({ shipmentId: { type: "string" } }, ["shipmentId"]), access: "read",
    run: (i, ctx) => { const sh = own(svc.findShipment(String(i.shipmentId)), ctx, "Shipment"); const v = svc.getVoyage(sh.voyageId); return { id: sh.id, status: SHIPMENT_COPY[sh.status].customer, packages: sh.packageIds.length, voyage: v?.label, arrivesAt: v?.arrivesAt, destination: svc.getDestination(sh.destinationId).name }; } },
  { name: "getLocations", description: "Warehouse and pickup locations.", inputSchema: obj({ destinationId: { type: "string", enum: dests() } }), access: "read",
    run: (i) => (i.destinationId ? [svc.warehouse(), ...svc.pickupLocationsFor(i.destinationId as DestinationId)] : svc.getLocations()) },
  { name: "getShippingRules", description: "Demo rate card, storage rules and disclaimers.", inputSchema: obj(), access: "read",
    run: () => ({ rates: RATE_CARD, storage: STORAGE_RULES, disclaimers: DISCLAIMERS, simulated: true }) },
  { name: "calculateShipping", description: "Demo estimate using the central rates engine (billable weight included).", inputSchema: obj({ destinationId: { type: "string", enum: dests() }, weight: { type: "number" }, service: { type: "string", enum: ["air", "ocean"] }, length: { type: "number" }, width: { type: "number" }, height: { type: "number" } }, ["destinationId", "weight"]), access: "read",
    run: (i) => svc.estimate({ destinationId: i.destinationId as DestinationId, service: (i.service as ServiceLevel) ?? "air", actualWeight: Number(i.weight), length: i.length as number, width: i.width as number, height: i.height as number }) },
  { name: "createQuote", description: "Save a demo quote for the customer.", inputSchema: obj({ destinationId: { type: "string", enum: dests() }, weight: { type: "number" }, service: { type: "string", enum: ["air", "ocean"] } }, ["destinationId", "weight", "service"]), access: "write",
    run: (i, ctx) => svc.createQuote(svc.aiActor(ctx.customerId), { destinationId: i.destinationId as DestinationId, service: i.service as ServiceLevel, actualWeight: Number(i.weight) }).quote },
  { name: "getInvoices", description: "The customer's bills from The Link with status and balance.", inputSchema: obj(), access: "read",
    run: (_i, ctx) => svc.listBills({ customerId: ctx.customerId }).filter((b) => b.lifecycle === "issued").map((b) => ({ id: b.id, total: b.total, paid: b.paid, balance: b.balance, status: b.status, dueAt: b.dueAt, shipmentId: b.shipmentId })) },
  { name: "getInvoice", description: "One bill with its lines.", inputSchema: obj({ billId: { type: "string" } }, ["billId"]), access: "read",
    run: (i, ctx) => { const b = own(svc.findBill(String(i.billId)), ctx, "Bill"); const v = svc.billView(b); return { id: v.id, lines: v.lines, total: v.total, paid: v.paid, balance: v.balance, status: v.status }; } },
  { name: "getPayment", description: "The customer's payments (all simulated DEMO PAYMENTS).", inputSchema: obj({ paymentId: { type: "string" } }), access: "read",
    run: (i, ctx) => svc.customerBalance(ctx.customerId).payments.filter((p) => !i.paymentId || p.id === i.paymentId).map((p) => ({ id: p.id, amount: p.amount, method: p.method, billId: p.billId, receivedAt: p.receivedAt })) },
  { name: "getBalance", description: "What the customer owes right now.", inputSchema: obj(), access: "read",
    run: (_i, ctx) => { const b = svc.customerBalance(ctx.customerId); return { balance: b.balance, overdue: b.overdue, openBills: b.openBills.map((x) => ({ id: x.id, balance: x.balance, dueAt: x.dueAt })) }; } },
  { name: "getClaims", description: "The customer's claims.", inputSchema: obj(), access: "read",
    run: (_i, ctx) => svc.listClaims({ customerId: ctx.customerId }).map((c) => ({ id: c.id, status: CLAIM_COPY[c.status].label, reason: c.reason, lastUpdate: c.updates.at(-1)?.text })) },
  { name: "getSupportTickets", description: "The customer's open help requests.", inputSchema: obj(), access: "read",
    run: (_i, ctx) => svc.listTickets({ customerId: ctx.customerId }).map((t) => ({ id: t.id, subject: t.subject, status: t.status })) },
  { name: "createSupportTicket", description: "Open a help request for a person to review.", inputSchema: obj({ subject: { type: "string" }, message: { type: "string" }, packageId: { type: "string" }, billId: { type: "string" } }, ["subject", "message"]), access: "write",
    run: (i, ctx) => svc.createTicket(svc.aiActor(ctx.customerId), { customerId: ctx.customerId, channel: ctx.channel, subject: String(i.subject), message: String(i.message), packageId: i.packageId as string, billId: i.billId as string, priority: "high" }) },
  { name: "getStorageStatus", description: "Free storage days left / storage fees for a package at the warehouse.", inputSchema: obj({ packageId: { type: "string" } }, ["packageId"]), access: "read",
    run: (i, ctx) => { const p = own(svc.findPackage(String(i.packageId)), ctx, "Package"); return svc.packageStorage(p.id); } },
  { name: "getDeliveryStatus", description: "Delivery or pickup status for a shipment.", inputSchema: obj({ shipmentId: { type: "string" } }, ["shipmentId"]), access: "read",
    run: (i, ctx) => { const sh = own(svc.findShipment(String(i.shipmentId)), ctx, "Shipment"); const d = svc.deliveryForShipment(sh.id); return d ? { status: DELIVERY_COPY[d.status].customer, method: d.method, window: d.window, driver: d.driver, address: d.address } : { status: "Not in The Bahamas yet" }; } },
  { name: "escalateToHuman", description: "Hand the conversation to a person on The Link team.", inputSchema: obj({ reason: { type: "string" }, packageId: { type: "string" } }, ["reason"]), access: "write",
    run: (i, ctx) => { const t = svc.createTicket(svc.aiActor(ctx.customerId), { customerId: ctx.customerId, channel: ctx.channel, subject: String(i.reason).slice(0, 80), message: String(i.reason), packageId: i.packageId as string, priority: "high" }); svc.markEscalated(ctx.customerId, ctx.channel === "whatsapp" ? "whatsapp" : "web", t.id); return { ticketId: t.id, expectedReply: "within 15 minutes during opening hours" }; } },
];

export type ToolName = (typeof TOOLS)[number]["name"];
export type ToolTrace = { tool: string; input: Record<string, unknown>; ok: boolean; error?: string };

export function runTool<T = unknown>(name: string, input: Record<string, unknown>, ctx: ToolContext, trace?: ToolTrace[]): T {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`Unknown tool ${name}`);
  for (const k of tool.inputSchema.required ?? []) if (input[k] === undefined) throw new Error(`${name}: missing ${k}`);
  try {
    const out = tool.run(input, ctx) as T;
    trace?.push({ tool: name, input, ok: true });
    return out;
  } catch (e) {
    trace?.push({ tool: name, input, ok: false, error: (e as Error).message });
    throw e;
  }
}

/** MCP `tools/list` shape. Future MCP names are snake_case versions. */
export const toolManifest = () =>
  TOOLS.map((t) => ({ name: t.name, mcpName: t.name.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`), description: t.description, inputSchema: t.inputSchema, annotations: { readOnlyHint: t.access === "read" } }));
