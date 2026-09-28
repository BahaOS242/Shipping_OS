import "@/services";
import { DEMO_CUSTOMER_ID } from "@/services/session";

/**
 * DEMO auth for API routes: acts as the demo customer. Production: resolve the
 * customer from a session/OAuth token (web, MCP) or a verified phone (WhatsApp).
 * NOTE: server routes use an in-memory copy of the demo data per instance.
 */
export const demoCustomerId = () => DEMO_CUSTOMER_ID;
