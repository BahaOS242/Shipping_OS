import { handleAgentRequest } from "@/lib/agent/agent";
import type { AgentContext, AgentInput } from "@/lib/agent/types";
import { getSessionCustomerId } from "@/lib/auth";

/**
 * Web channel → agent.
 * The customer is taken from the session, never from the request body.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as { input: AgentInput; context?: AgentContext };
  if (!body?.input) return Response.json({ error: "input required" }, { status: 400 });
  const customerId = await getSessionCustomerId();
  const reply = await handleAgentRequest({ channel: "web", customerId, input: body.input, context: body.context });
  return Response.json(reply);
}
