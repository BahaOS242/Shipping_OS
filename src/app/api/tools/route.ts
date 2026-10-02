import { toolManifest } from "@/ai/executor";
import { withRequestContext } from "@/server/requestContext";

export const GET = (req: Request) => withRequestContext(req, ["api"], ({ organization, source }) => Response.json({ mode: source, organization: organization.slug, tools: toolManifest() }));
