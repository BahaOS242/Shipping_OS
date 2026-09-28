import { toolManifest } from "@/lib/tools/registry";

/** Lists the controlled tools the AI layer is allowed to use. */
export async function GET() {
  return Response.json({ mode: "demo", tools: toolManifest() });
}
