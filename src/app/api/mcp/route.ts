import { getSessionCustomerId } from "@/lib/auth";
import { runTool, toolManifest, tools, type ToolName } from "@/lib/tools/registry";

/**
 * Minimal MCP-style JSON-RPC endpoint (DEMO).
 * Supports initialize, tools/list and tools/call over the same controlled tools
 * the assistant uses. Production: move to a dedicated MCP server with OAuth,
 * per-customer auth and audit logging.
 */
type RpcRequest = { jsonrpc: "2.0"; id?: number | string; method: string; params?: Record<string, unknown> };

const ok = (id: RpcRequest["id"], result: unknown) => Response.json({ jsonrpc: "2.0", id, result });
const err = (id: RpcRequest["id"], code: number, message: string) =>
  Response.json({ jsonrpc: "2.0", id, error: { code, message } });

export async function GET() {
  return Response.json({ name: "the-link", mode: "demo", methods: ["initialize", "tools/list", "tools/call"] });
}

export async function POST(req: Request) {
  const rpc = (await req.json()) as RpcRequest;
  switch (rpc.method) {
    case "initialize":
      return ok(rpc.id, {
        protocolVersion: "2025-06-18",
        serverInfo: { name: "the-link", version: "0.1.0-demo" },
        capabilities: { tools: {} },
      });
    case "notifications/initialized":
      return new Response(null, { status: 202 });
    case "tools/list":
      return ok(rpc.id, { tools: toolManifest() });
    case "tools/call": {
      const name = rpc.params?.name as string;
      if (!(name in tools)) return err(rpc.id, -32602, `Unknown tool ${name}`);
      try {
        const out = await runTool(name as ToolName, (rpc.params?.arguments as Record<string, unknown>) ?? {}, {
          customerId: await getSessionCustomerId(),
          channel: "web",
        });
        return ok(rpc.id, { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out });
      } catch (e) {
        return ok(rpc.id, { content: [{ type: "text", text: (e as Error).message }], isError: true });
      }
    }
    default:
      return err(rpc.id, -32601, `Method not found: ${rpc.method}`);
  }
}
