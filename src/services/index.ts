/**
 * The Link service layer — the only way screens, the AI and APIs touch data.
 *
 *   Website · Customer app · Staff UI · AI assistant · WhatsApp · MCP/API
 *                                   ↓
 *                        services (business logic + authorization)
 *                                   ↓
 *                           store (demo) → PostgreSQL (production)
 */
export * from "./api";
import "../data/seed"; // registers the demo seeder (replays history through ./api)
