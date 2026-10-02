import { handleAgentRequest } from "@/ai/agent";
import type { AgentContext, AgentInput } from "@/ai/types";
import { withRequestContext } from "@/server/requestContext";

/** Web channel → agent. Organization and customer come from the request context, never the body. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { input?: AgentInput; context?: AgentContext } | null;
  if (!body?.input) return Response.json({ error: "input required" }, { status: 400 });
  const input = body.input;
  return withRequestContext(req, ["assistant"], async ({ actor }) => {
    if (actor.kind !== "customer" || !actor.customerId) return Response.json({ error: "The assistant acts for a signed-in customer." }, { status: 403 });
    return Response.json(await handleAgentRequest({ channel: "web", customerId: actor.customerId, input, context: body.context }));
  });
}
