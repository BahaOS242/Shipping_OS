import { TOOLS, runTool } from "@/ai/tools";
import { demoCustomerId, withApiTenant } from "../../_demo";

export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!TOOLS.some((t) => t.name === name)) return Response.json({ error: `Unknown tool ${name}` }, { status: 404 });
  const input = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  return withApiTenant(req, ["api"], () => {
    try {
      return Response.json({ result: runTool(name, input, { customerId: demoCustomerId(), channel: "web" }) });
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 400 });
    }
  });
}
