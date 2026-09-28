import { handleAgentRequest } from "@/ai/agent";
import type { AgentContext, AgentInput } from "@/ai/types";
import { demoCustomerId } from "../_demo";

/** Web channel → agent. The customer comes from the session, never the body. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { input?: AgentInput; context?: AgentContext } | null;
  if (!body?.input) return Response.json({ error: "input required" }, { status: 400 });
  return Response.json(await handleAgentRequest({ channel: "web", customerId: demoCustomerId(), input: body.input, context: body.context }));
}
