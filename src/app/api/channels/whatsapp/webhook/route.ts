import { handleWhatsAppWebhook, type WaWebhookPayload } from "@/ai/whatsapp";
import { withApiTenant } from "../../../_demo";

/**
 * WhatsApp Business (Cloud API) webhook. Same handler the in-app WhatsApp demo uses.
 * Demo mode: nothing is sent; outbound payloads are returned.
 * Production TODO: verify X-Hub-Signature-256 with the app secret before processing.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = process.env.WHATSAPP_VERIFY_TOKEN ?? "demo-verify-token";
  if (url.searchParams.get("hub.mode") === "subscribe" && url.searchParams.get("hub.verify_token") === token) return new Response(url.searchParams.get("hub.challenge") ?? "");
  return new Response("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => null)) as WaWebhookPayload | null;
  if (!payload?.entry) return Response.json({ error: "Invalid payload" }, { status: 400 });
  return withApiTenant(req, ["assistant"], async () => Response.json(await handleWhatsAppWebhook(payload)));
}
