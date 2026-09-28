import { handleAgentRequest } from "@/lib/agent/agent";
import type { AgentInput } from "@/lib/agent/types";
import { findCustomerByPhone } from "@/lib/api/link-api";
import { agentReplyToWhatsApp, extractMessages, getWhatsAppSender, type WaWebhookPayload } from "@/lib/channels/whatsapp";
import { memoryConversationStore } from "@/lib/channels/session-store";

/**
 * WhatsApp Business (Cloud API) webhook.
 *
 * GET  — Meta's verification handshake.
 * POST — inbound messages → agent → outbound messages.
 *
 * In demo mode nothing is sent: the outbound payloads are returned in the
 * response so the mock WhatsApp screen can render them.
 * Production TODO: verify the X-Hub-Signature-256 header with the app secret.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = process.env.WHATSAPP_VERIFY_TOKEN ?? "demo-verify-token";
  if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === token) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const payload = (await req.json()) as WaWebhookPayload;
  const sender = getWhatsAppSender();
  const results = [];

  for (const msg of extractMessages(payload)) {
    // Identify the customer by their verified WhatsApp number.
    const customer = await findCustomerByPhone(msg.from);
    if (!customer) {
      results.push({ from: msg.from, outbound: [], note: "Unknown number — would start sign-up flow." });
      continue;
    }

    const input: AgentInput =
      msg.type === "text"
        ? { kind: "text", text: msg.text.body }
        : { kind: "action", id: msg.interactive.button_reply.id, label: msg.interactive.button_reply.title };

    const context = await memoryConversationStore.get(msg.from);
    const reply = await handleAgentRequest({ channel: "whatsapp", customerId: customer.id, input, context });
    await memoryConversationStore.set(msg.from, reply.context);

    const outbound = agentReplyToWhatsApp(reply, msg.from);
    const sent = await Promise.all(outbound.map((m) => sender.send(m)));
    results.push({ from: msg.from, intent: reply.intent, trace: reply.trace, handoff: reply.handoff, outbound, sent, cards: reply.messages.map((m) => m.card ?? null) });
  }

  return Response.json({ status: "ok", mode: process.env.THE_LINK_MODE === "live" ? "live" : "demo", results });
}
