import { toolManifest } from "@/ai/tools";
import { withApiTenant } from "../_demo";

export const GET = (req: Request) => withApiTenant(req, ["api"], (org) => Response.json({ mode: "demo", organization: org.slug, tools: toolManifest() }));
