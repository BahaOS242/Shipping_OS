import { toolManifest } from "@/ai/tools";
import "../_demo";

export const GET = () => Response.json({ mode: "demo", tools: toolManifest() });
