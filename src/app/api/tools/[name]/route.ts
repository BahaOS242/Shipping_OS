import { TOOLS, customerToolContext, runTool } from "@/ai/executor";
import { withRequestContext } from "@/server/requestContext";

/** Customer tools over HTTP. Every call goes through the AI tool executor (organization → module → permission → service). */
export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!TOOLS.some((t) => t.name === name)) return Response.json({ error: `Unknown tool ${name}` }, { status: 404 });
  const input = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  return withRequestContext(req, ["api"], ({ actor }) => {
    if (actor.kind !== "customer" || !actor.customerId) return Response.json({ error: "Customer tools need a signed-in customer." }, { status: 403 });
    try {
      return Response.json({ result: runTool(name, input, customerToolContext(actor.customerId, "web")) });
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 400 });
    }
  });
}
