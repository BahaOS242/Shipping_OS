/**
 * THE LINK API — the only business layer.
 *
 *   Channel (web / WhatsApp / staff)
 *      ↓
 *   AI Agent            (src/lib/agent)
 *      ↓
 *   Controlled Tools    (src/lib/tools)
 *      ↓
 *   The Link API        ← you are here
 *      ↓
 *   Repository          (mock today → PostgreSQL / warehouse system tomorrow)
 *
 * Web pages call this directly. The AI only reaches it through tools.
 */
import { mockRepository } from "../data/mock-repository";
import type { Repository } from "../data/repository";
import { operationsSnapshot, shoppingAddressFor } from "../data/seed";
import { DEMO_SHIPPING_RULES, estimateShipping, type EstimateInput } from "../pricing";
import { canConsolidate } from "../status";
import type { Channel, Customer, ID, Package, Quote, ShippingRules, SupportTicket } from "../types";

// Production: choose the repository from env (e.g. THE_LINK_MODE=live → PostgresRepository).
const repo: Repository = mockRepository;

export class NotFoundError extends Error {}
export class ForbiddenError extends Error {}

/** What a customer (or the AI acting for them) is allowed to see. */
export type CustomerPackage = Omit<Package, "staffNotes" | "needsAttention">;

function toCustomerPackage(p: Package): CustomerPackage {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { staffNotes, needsAttention, ...rest } = p;
  return rest;
}

const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

/* ---------------- Customers ---------------- */

export async function getCustomer(id: ID): Promise<Customer> {
  const c = await repo.findCustomer(id);
  if (!c) throw new NotFoundError(`Customer ${id} not found`);
  return c;
}

export async function findCustomerByPhone(phone: string) {
  return repo.findCustomerByPhone(phone);
}

export async function getShoppingAddress(customerId: ID) {
  return shoppingAddressFor(await getCustomer(customerId));
}

/* ---------------- Packages ---------------- */

const ACTIVE_ORDER = ["ready", "arrived", "in_transit", "preparing", "received", "incoming", "delivered"];

export async function getPackages(customerId: ID): Promise<CustomerPackage[]> {
  const rows = await repo.listPackages({ customerId });
  return rows
    .slice()
    .sort((a, b) => ACTIVE_ORDER.indexOf(a.status) - ACTIVE_ORDER.indexOf(b.status))
    .map(toCustomerPackage);
}

/** Fetch one package. When a customerId is given, ownership is enforced. */
export async function getPackage(id: ID, scope?: { customerId?: ID }): Promise<CustomerPackage> {
  const p = await repo.findPackage(id);
  if (!p) throw new NotFoundError(`Package ${id} not found`);
  if (scope?.customerId && p.customerId !== scope.customerId) throw new ForbiddenError("Not your package");
  return toCustomerPackage(p);
}

export async function getConsolidationCandidates(customerId: ID) {
  return (await getPackages(customerId)).filter((p) => canConsolidate(p.status));
}

/* ---------------- Shipments & places ---------------- */

export async function getShipment(id: ID) {
  const s = await repo.findShipment(id);
  if (!s) throw new NotFoundError(`Shipment ${id} not found`);
  return s;
}

export async function getLocations() {
  return repo.listLocations();
}

export async function getLocation(id: ID) {
  return (await repo.listLocations()).find((l) => l.id === id);
}

/* ---------------- Pricing ---------------- */

export async function getShippingRules(): Promise<ShippingRules> {
  // Production: read the live rates table.
  return DEMO_SHIPPING_RULES;
}

export async function calculateShipping(input: EstimateInput) {
  return estimateShipping(input, await getShippingRules());
}

export async function createQuote(input: EstimateInput & { customerId?: ID }): Promise<Quote> {
  const e = await calculateShipping(input);
  return repo.saveQuote({
    id: newId("q"),
    customerId: input.customerId,
    destination: input.destination,
    weight: input.weight,
    mode: input.mode,
    packageCount: input.packageCount ?? 1,
    lines: e.lines,
    total: e.total,
    transitDays: e.transitDays,
    isDemo: true,
    createdAt: new Date().toISOString(),
  });
}

/* ---------------- Support ---------------- */

export async function createSupportTicket(input: {
  customerId: ID;
  channel: Channel;
  subject: string;
  message: string;
  packageId?: ID;
}): Promise<SupportTicket> {
  const now = new Date().toISOString();
  return repo.saveTicket({
    id: newId("t"),
    customerId: input.customerId,
    channel: input.channel,
    subject: input.subject,
    packageId: input.packageId,
    status: "open",
    priority: "normal",
    createdAt: now,
    messages: [{ id: newId("m"), author: "customer", text: input.message, at: now }],
  });
}

/** Hand a conversation to a person. Creates a ticket if needed. */
export async function escalateToHuman(input: {
  customerId: ID;
  channel: Channel;
  reason: string;
  ticketId?: ID;
  packageId?: ID;
}) {
  const existing = input.ticketId ? await repo.findTicket(input.ticketId) : undefined;
  const ticket =
    existing ??
    (await createSupportTicket({
      customerId: input.customerId,
      channel: input.channel,
      subject: input.reason,
      message: input.reason,
      packageId: input.packageId,
    }));
  const saved = await repo.saveTicket({ ...ticket, status: "waiting_on_staff", priority: "high" });
  // Production: notify the on-duty staff queue (Slack/email/dashboard push).
  return { ticket: saved, expectedReply: "within 15 minutes during opening hours" };
}

export async function listSupportTickets(customerId?: ID) {
  return repo.listTickets({ customerId });
}

export async function getNotifications(customerId: ID) {
  return repo.listNotifications(customerId);
}

export async function getQuotes(customerId: ID) {
  return repo.listQuotes({ customerId });
}

export async function getInvoices(customerId: ID) {
  return repo.listInvoices({ customerId });
}

/* ---------------- Staff-only (never exposed as AI tools) ---------------- */

export const staff = {
  async operationsSummary() {
    return operationsSnapshot;
  },
  async listPackages() {
    const [pkgs, customers] = await Promise.all([repo.listPackages(), repo.listCustomers()]);
    return pkgs
      .map((p) => ({ ...p, customer: customers.find((c) => c.id === p.customerId)! }))
      .sort((a, b) => (b.history.at(-1)?.at ?? "").localeCompare(a.history.at(-1)?.at ?? ""));
  },
  async getPackage(id: ID) {
    const p = await repo.findPackage(id);
    if (!p) throw new NotFoundError(`Package ${id} not found`);
    const customer = await getCustomer(p.customerId);
    const shipment = p.shipmentId ? await repo.findShipment(p.shipmentId) : undefined;
    return { ...p, customer, shipment };
  },
  async listTickets() {
    return repo.listTickets();
  },
  async listCustomers() {
    return repo.listCustomers();
  },
};
