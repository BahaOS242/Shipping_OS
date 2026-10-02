import { TOOLS, runTool, toolManifest } from "@/ai/tools";
import { demoCustomerId, withApiTenant } from "../_demo";

/**
 * MCP-ready JSON-RPC endpoint (DEMO). The app does not depend on MCP — this
 * simply exposes the same controlled tools. Production: dedicated MCP server
 * with OAuth per customer, rate limits and audit logging.
 */
type Rpc = { jsonrpc: "2.0"; id?: number | string; method: string; params?: Record<string, unknown> };
const ok = (id: Rpc["id"], result: unknown) => Response.json({ jsonrpc: "2.0", id, result });
const fail = (id: Rpc["id"], code: number, message: string) => Response.json({ jsonrpc: "2.0", id, error: { code, message } });

export const GET = () => Response.json({ name: "the-link", mode: "demo", methods: ["initialize", "tools/list", "tools/call"] });

export async function POST(req: Request) {
  const rpc = (await req.json().catch(() => ({}))) as Rpc;
  return withApiTenant(req, ["api"], () => handle(rpc));
}

function handle(rpc: Rpc): Response {
  switch (rpc.method) {
    case "initialize":
      return ok(rpc.id, { protocolVersion: "2025-06-18", serverInfo: { name: "the-link", version: "0.2.0-demo" }, capabilities: { tools: {} } });
    case "notifications/initialized":
      return new Response(null, { status: 202 });
    case "tools/list":
      return ok(rpc.id, { tools: toolManifest().map(({ mcpName, ...t }) => ({ ...t, name: mcpName, title: t.name })) });
    case "tools/call": {
      const n = String(rpc.params?.name ?? "");
      const tool = TOOLS.find((t) => t.name === n || t.name.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`) === n);
      if (!tool) return fail(rpc.id, -32602, `Unknown tool ${n}`);
      try {
        const out = runTool(tool.name, (rpc.params?.arguments as Record<string, unknown>) ?? {}, { customerId: demoCustomerId(), channel: "web" });
        return ok(rpc.id, { content: [{ type: "text", text: JSON.stringify(out) }], structuredContent: out });
      } catch (e) {
        return ok(rpc.id, { content: [{ type: "text", text: (e as Error).message }], isError: true });
      }
    }
    default:
      return fail(rpc.id, -32601, `Method not found: ${rpc.method}`);
  }
}
