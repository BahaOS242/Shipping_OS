/**
 * SUPPORT SERVICE — tickets, and the conversation log shared by the web
 * assistant and WhatsApp. Staff replies go back to the customer's WhatsApp thread.
 */
import { nowIso } from "@/data/clock";
import { db, mutate, nextSeq } from "@/data/store";
import { assert, can, canActOn } from "@/domain/roles";
import type { Actor, Channel, ChatMessage, Conversation, ID, SupportTicket } from "@/domain/types";
import { emit } from "@/events/bus";
import { BusinessError, byId } from "./_shared";

export const getTicket = (id: ID) => byId(db().tickets, id, "Ticket");

export function listTickets(f: { customerId?: ID; status?: SupportTicket["status"] | "open"; assignee?: string } = {}) {
  return db()
    .tickets.filter((t) => (!f.customerId || t.customerId === f.customerId) && (!f.assignee || t.assignee === f.assignee) && (!f.status || (f.status === "open" ? t.status !== "resolved" : t.status === f.status)))
    .sort((a, b) => ({ urgent: 0, high: 1, normal: 2 })[a.priority] - ({ urgent: 0, high: 1, normal: 2 })[b.priority] || b.createdAt.localeCompare(a.createdAt));
}

const msg = (author: ChatMessage["author"], text: string, staffName?: string): ChatMessage => ({ id: `M${nextSeq("msg", 0)}`, author, text, at: nowIso(), staffName });

export function createTicket(actor: Actor, input: { customerId: ID; subject: string; message: string; channel: Channel; packageId?: ID; shipmentId?: ID; billId?: ID; priority?: SupportTicket["priority"] }) {
  assert(canActOn(actor, "ticket.manage", { customerId: input.customerId }) || (actor.kind === "ai" && actor.customerId === input.customerId), "Not allowed.");
  return mutate((s) => {
    const t: SupportTicket = {
      id: `SUP-${nextSeq("sup", 400)}`,
      customerId: input.customerId,
      channel: input.channel,
      subject: input.subject,
      packageId: input.packageId,
      shipmentId: input.shipmentId,
      billId: input.billId,
      priority: input.priority ?? "normal",
      status: "waiting_on_staff",
      createdBy: actor.kind === "ai" ? "ai" : actor.role === "customer" ? "customer" : "staff",
      createdAt: nowIso(),
      messages: [msg(actor.kind === "staff" ? "staff" : "customer", input.message, actor.kind === "staff" ? actor.name : undefined)],
    };
    s.tickets.push(t);
    emit("SUPPORT_TICKET_CREATED", {
      actor,
      refs: { customerId: t.customerId, ticketId: t.id, packageId: t.packageId, shipmentId: t.shipmentId, billId: t.billId },
      summary: `Ticket ${t.id} opened${t.createdBy === "ai" ? " by Shipping OS Assistant" : ""}: ${t.subject}`,
      customerSummary: `We opened request ${t.id} so a person can help: ${t.subject}.`,
    });
    return t;
  });
}

export function replyTicket(actor: Actor, id: ID, text: string) {
  const t = getTicket(id);
  const staff = can(actor, "ticket.manage");
  assert(staff || canActOn(actor, "ticket.manage", t));
  if (!text.trim()) throw new BusinessError("Write a message.");
  return mutate(() => {
    t.messages.push(msg(staff ? "staff" : "customer", text.trim(), staff ? actor.name : undefined));
    t.status = staff ? "waiting_on_customer" : "waiting_on_staff";
    if (staff) {
      t.assignee ??= actor.name;
      logConversation(t.customerId, t.channel === "whatsapp" ? "whatsapp" : "web", "staff", text.trim(), actor.name);
      emit("STAFF_MESSAGE", { actor, refs: { customerId: t.customerId, ticketId: t.id }, summary: `${actor.name} replied on ${t.id}`, customerSummary: `${actor.name.split(" ")[0]} from Shipping OS replied: “${text.trim()}”` });
    } else {
      emit("TICKET_UPDATED", { actor, refs: { customerId: t.customerId, ticketId: t.id }, summary: `Customer replied on ${t.id}` });
    }
    return t;
  });
}

function ticketAction(actor: Actor, id: ID, fn: (t: SupportTicket) => void, summary: string) {
  assert(can(actor, "ticket.manage"), "Only support can do that.");
  return mutate(() => {
    const t = getTicket(id);
    fn(t);
    emit("TICKET_UPDATED", { actor, refs: { customerId: t.customerId, ticketId: t.id }, summary: `${t.id} ${summary}` });
    return t;
  });
}

export const assignTicket = (actor: Actor, id: ID, assignee: string) => ticketAction(actor, id, (t) => (t.assignee = assignee), `assigned to ${assignee}`);
export const escalateTicket = (actor: Actor, id: ID) => ticketAction(actor, id, (t) => (t.priority = "urgent"), "escalated to urgent");
export const resolveTicket = (actor: Actor, id: ID) =>
  ticketAction(actor, id, (t) => {
    t.status = "resolved";
    t.resolvedAt = nowIso();
  }, "resolved");

/* ---------------- Conversations (assistant + WhatsApp) ---------------- */

export function getConversation(customerId: ID, channel: Conversation["channel"]) {
  return db().conversations.find((c) => c.customerId === customerId && c.channel === channel);
}

/** Append to the shared conversation log. Emits timeline events for customer questions and AI answers. */
export function logConversation(customerId: ID, channel: Conversation["channel"], author: ChatMessage["author"], text: string, staffName?: string, intent?: string) {
  return mutate((s) => {
    let c = getConversation(customerId, channel);
    if (!c) {
      c = { id: `CONV-${nextSeq("conv", 0)}`, customerId, channel, messages: [], intents: [], escalated: false, updatedAt: nowIso() };
      s.conversations.push(c);
    }
    const m = msg(author, text, staffName);
    c.messages.push(m);
    c.updatedAt = m.at;
    if (intent) c.intents.push(intent);
    const where = channel === "whatsapp" ? "WhatsApp" : "web chat";
    if (author === "customer") emit("CUSTOMER_MESSAGE", { actor: { kind: "customer", name: "Customer", role: "customer", customerId }, refs: { customerId }, summary: `Customer asked on ${where}: “${text.slice(0, 120)}”` });
    if (author === "assistant" && intent) emit("AI_RESPONDED", { actor: { kind: "ai", name: "Shipping OS Assistant", role: "customer", customerId }, refs: { customerId }, summary: `Shipping OS Assistant answered on ${where} (${intent})` });
    return c;
  });
}

export function markEscalated(customerId: ID, channel: Conversation["channel"], ticketId: ID) {
  return mutate(() => {
    const c = getConversation(customerId, channel);
    if (c) {
      c.escalated = true;
      c.ticketId = ticketId;
    }
  });
}

/** Staff message straight to a customer's WhatsApp (simulated — nothing is sent). */
export function staffMessage(actor: Actor, customerId: ID, text: string) {
  assert(can(actor, "customer.read_any"), "Only staff can message customers.");
  if (!text.trim()) throw new BusinessError("Write a message.");
  return mutate(() => {
    logConversation(customerId, "whatsapp", "staff", text.trim(), actor.name);
    emit("STAFF_MESSAGE", { actor, refs: { customerId }, summary: `${actor.name} messaged the customer on WhatsApp`, customerSummary: undefined });
  });
}

export function clearConversation(customerId: ID, channel: Conversation["channel"]) {
  return mutate((s) => {
    s.conversations = s.conversations.filter((c) => !(c.customerId === customerId && c.channel === channel));
  });
}

export const listStaffNames = () => db().staff.map((s) => s.name);
