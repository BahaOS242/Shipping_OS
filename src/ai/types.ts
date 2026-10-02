import type { Channel, DestinationId, ID, PackageStatus } from "@/domain/types";
import type { ToolTrace } from "./executor";

export type AgentInput = { kind: "text"; text: string } | { kind: "action"; id: string; label?: string };

/** Small memory the channel keeps between turns (the agent itself is stateless). */
export type AgentContext = { awaiting?: "destination" | "weight"; weight?: number; destinationId?: DestinationId; lastPackageId?: ID; ticketId?: ID };

export type AgentRequest = { channel: Channel; customerId: ID; input: AgentInput; context?: AgentContext };

export type AgentAction = { id: string; label: string; icon?: string; href?: string };

export type AgentCard =
  | { kind: "package"; packageId: ID; merchant: string; itemName: string; status: PackageStatus; statusTitle: string; where: string; next: string }
  | { kind: "estimate"; destination: string; weight: number; billableWeight: number; total: number; transit: string }
  | { kind: "balance"; balance: number; overdue: number };

/** Text uses **bold** and line breaks; channels adapt it. */
export type AgentMessage = { text: string; card?: AgentCard };

export type AgentReply = { intent: string; messages: AgentMessage[]; actions: AgentAction[]; context: AgentContext; trace: ToolTrace[]; handoff?: { ticketId: ID; expectedReply: string } };
