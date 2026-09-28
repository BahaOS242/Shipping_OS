import type { AgentContext } from "../agent/types";

/**
 * Per-conversation memory for message channels (WhatsApp) where the client
 * can't echo context back. DEMO: in-memory. Production: Redis / Postgres keyed by wa_id.
 */
export interface ConversationStore {
  get(key: string): Promise<AgentContext>;
  set(key: string, ctx: AgentContext): Promise<void>;
}

const mem = new Map<string, AgentContext>();

export const memoryConversationStore: ConversationStore = {
  async get(key) {
    return mem.get(key) ?? {};
  },
  async set(key, ctx) {
    mem.set(key, ctx);
  },
};
