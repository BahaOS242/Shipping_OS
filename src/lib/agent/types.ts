import type { ToolCallTrace } from "../tools/registry";
import type { Channel, ID, IslandId, PackageStatus, ShippingMode } from "../types";

/** What a channel sends to the agent. Channel-agnostic on purpose. */
export type AgentInput =
  | { kind: "text"; text: string }
  /** A button press. `id` is an opaque action id the agent produced earlier. */
  | { kind: "action"; id: string; label?: string };

/** Small conversational memory the channel stores and echoes back (keeps the agent stateless). */
export type AgentContext = {
  awaiting?: "destination" | "weight";
  weight?: number;
  destination?: IslandId;
  lastPackageId?: ID;
  ticketId?: ID;
};

export type AgentRequest = {
  channel: Channel;
  customerId: ID;
  input: AgentInput;
  context?: AgentContext;
};

export type AgentAction = {
  id: string;
  label: string;
  icon?: string;
  /** If set, the action opens a page instead of continuing the chat. */
  href?: string;
};

export type AgentCard =
  | {
      kind: "package";
      packageId: ID;
      merchant: string;
      itemName: string;
      status: PackageStatus;
      statusTitle: string;
      statusIcon: string;
      where: string;
      next: string;
    }
  | {
      kind: "estimate";
      destination: string;
      weight: number;
      mode: ShippingMode;
      total: number;
      transitDays: string;
    };

/** Text uses a tiny markdown subset: **bold** and line breaks. Channels adapt it. */
export type AgentMessage = { text: string; card?: AgentCard };

export type AgentReply = {
  intent: string;
  messages: AgentMessage[];
  actions: AgentAction[];
  context: AgentContext;
  /** Which tools ran — shown in the demo's "under the hood" panel and logged in production. */
  trace: ToolCallTrace[];
  handoff?: { ticketId: ID; expectedReply: string };
};
