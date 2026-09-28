/**
 * WHATSAPP CHANNEL
 *
 * Translates between the WhatsApp Business (Cloud API) webhook format and the
 * channel-agnostic agent. The mock WhatsApp screen in the demo talks to the
 * same `handleWhatsAppWebhook` function the /api webhook route uses, with the
 * exact Cloud API payload shapes, so going live means swapping the sender.
 */
import * as svc from "@/services";
import { handleAgentRequest } from "./agent";
import type { AgentAction, AgentContext, AgentInput, AgentReply } from "./types";

/* ---------- Inbound (subset of the Cloud API webhook payload) ---------- */

export type WaInboundMessage =
  | { from: string; id: string; timestamp: string; type: "text"; text: { body: string } }
  | {
      from: string;
      id: string;
      timestamp: string;
      type: "interactive";
      interactive: { type: "button_reply"; button_reply: { id: string; title: string } };
    };

export type WaWebhookPayload = {
  object: "whatsapp_business_account";
  entry: {
    id: string;
    changes: {
      field: "messages";
      value: {
        messaging_product: "whatsapp";
        metadata: { display_phone_number: string; phone_number_id: string };
        contacts?: { profile: { name: string }; wa_id: string }[];
        messages?: WaInboundMessage[];
      };
    }[];
  }[];
};

export function extractMessages(payload: WaWebhookPayload): WaInboundMessage[] {
  return payload.entry?.flatMap((e) => e.changes.flatMap((c) => c.value.messages ?? [])) ?? [];
}

/* ---------- Outbound (Cloud API send-message bodies) ---------- */

export type WaOutbound =
  | { messaging_product: "whatsapp"; to: string; type: "text"; text: { body: string; preview_url?: boolean } }
  | {
      messaging_product: "whatsapp";
      to: string;
      type: "interactive";
      interactive: {
        type: "button";
        body: { text: string };
        action: { buttons: { type: "reply"; reply: { id: string; title: string } }[] };
      };
    };

/** WhatsApp uses *bold*, not **bold**. */
export function toWhatsAppText(md: string) {
  return md.replace(/\*\*(.+?)\*\*/g, "*$1*");
}

/** Reply-button titles are limited to 20 characters and 3 buttons. */
function toButtons(actions: AgentAction[]) {
  return actions.slice(0, 3).map((a) => ({
    type: "reply" as const,
    reply: { id: a.href ? `link:${a.href}` : a.id, title: a.label.slice(0, 20) },
  }));
}

export function agentReplyToWhatsApp(reply: AgentReply, to: string): WaOutbound[] {
  const out: WaOutbound[] = [];
  // Buttons belong on the main answer (the one with a card), else on the last message.
  const withCard = reply.messages.map((m) => !!m.card).lastIndexOf(true);
  const buttonsAt = withCard >= 0 ? withCard : reply.messages.length - 1;
  reply.messages.forEach((m, i) => {
    const body = toWhatsAppText(m.text);
    if (i === buttonsAt && reply.actions.length) {
      out.push({
        messaging_product: "whatsapp",
        to,
        type: "interactive",
        interactive: { type: "button", body: { text: body }, action: { buttons: toButtons(reply.actions) } },
      });
    } else {
      out.push({ messaging_product: "whatsapp", to, type: "text", text: { body } });
    }
  });
  return out;
}

/* ---------- Sending ---------- */

export interface WhatsAppSender {
  send(message: WaOutbound): Promise<{ id: string; delivered: boolean; mode: "demo" | "live" }>;
}

/** DEMO: records the message, sends nothing. */
export const demoSender: WhatsAppSender = {
  async send() {
    return { id: `wamid.DEMO_${Math.random().toString(36).slice(2, 10)}`, delivered: false, mode: "demo" };
  },
};

/**
 * LIVE (not enabled in the demo): POST to the Cloud API.
 * Wired up but guarded — it refuses to run unless THE_LINK_MODE=live and credentials exist.
 */
export const cloudApiSender: WhatsAppSender = {
  async send(message) {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (process.env.THE_LINK_MODE !== "live" || !token || !phoneId) {
      throw new Error("Live WhatsApp sending is disabled in the demo.");
    }
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(message),
    });
    const json = (await res.json()) as { messages?: { id: string }[] };
    return { id: json.messages?.[0]?.id ?? "unknown", delivered: res.ok, mode: "live" };
  },
};

export function getWhatsAppSender(): WhatsAppSender {
  return process.env.THE_LINK_MODE === "live" ? cloudApiSender : demoSender;
}

/** Helper for the demo UI: build an inbound webhook payload like Meta would send. */
export function buildInboundPayload(from: string, name: string, msg: { text: string } | { buttonId: string; title: string }): WaWebhookPayload {
  const base = { from, id: `wamid.IN_${Date.now()}`, timestamp: String(Math.floor(Date.now() / 1000)) };
  const message: WaInboundMessage =
    "text" in msg
      ? { ...base, type: "text", text: { body: msg.text } }
      : { ...base, type: "interactive", interactive: { type: "button_reply", button_reply: { id: msg.buttonId, title: msg.title } } };
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "DEMO_WABA_ID",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "12425550100", phone_number_id: "DEMO_PHONE_ID" },
              contacts: [{ profile: { name }, wa_id: from }],
              messages: [message],
            },
          },
        ],
      },
    ],
  };
}

/* ---------- The channel handler (transport-agnostic) ---------- */

/** Per-number conversation memory. Production: Redis/Postgres keyed by wa_id. */
const contexts = new Map<string, AgentContext>();

/**
 * Inbound webhook payload → agent → outbound payloads. Used by the API route
 * (server) and by the WhatsApp demo screen (in-browser transport).
 */
export async function handleWhatsAppWebhook(payload: WaWebhookPayload, sender: WhatsAppSender = getWhatsAppSender()) {
  const results = [];
  for (const msg of extractMessages(payload)) {
    const customer = svc.findCustomerByPhone(msg.from);
    if (!customer) {
      results.push({ from: msg.from, intent: "unknown_number", outbound: [] as WaOutbound[], note: "Unknown number — production would start a verified sign-up flow." });
      continue;
    }
    const input: AgentInput = msg.type === "text" ? { kind: "text", text: msg.text.body } : { kind: "action", id: msg.interactive.button_reply.id, label: msg.interactive.button_reply.title };
    const shown = msg.type === "text" ? msg.text.body : msg.interactive.button_reply.title;
    svc.logConversation(customer.id, "whatsapp", "customer", shown);
    const reply = await handleAgentRequest({ channel: "whatsapp", customerId: customer.id, input, context: contexts.get(msg.from) });
    contexts.set(msg.from, reply.context);
    reply.messages.forEach((m, i) => svc.logConversation(customer.id, "whatsapp", "assistant", toWhatsAppText(m.text), undefined, i === 0 ? reply.intent : undefined));
    const outbound = agentReplyToWhatsApp(reply, msg.from);
    const sent = await Promise.all(outbound.map((m) => sender.send(m)));
    results.push({ from: msg.from, intent: reply.intent, trace: reply.trace, handoff: reply.handoff, outbound, sent });
  }
  return { status: "ok" as const, mode: process.env.THE_LINK_MODE === "live" ? "live" : "demo", results };
}
