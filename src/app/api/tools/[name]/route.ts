import { getSessionCustomerId } from "@/lib/auth";
import { runTool, tools, type ToolName } from "@/lib/tools/registry";

/** Invoke one tool (demo). Customer scope comes from the session. */
export async function POST(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  if (!(name in tools)) return Response.json({ error: `Unknown tool ${name}` }, { status: 404 });
  const input = ((await req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  try {
    const result = await runTool(name as ToolName, input, { customerId: await getSessionCustomerId(), channel: "web" });
    return Response.json({ result });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
