/**
 * AI ACTIONS — the service side of AI tool calls: confirmation proposals and audit.
 *
 * Proposals live in the tenant's own data (like every other record), so they
 * can't be seen, confirmed or leaked across organizations. Confirming one does
 * not execute anything here: the AI executor re-authorizes and then calls the
 * real business service. This file only records what was proposed, by whom,
 * and how it ended.
 */
import { now, nowIso } from "@/data/clock";
import { db, mutate } from "@/data/store";
import { ForbiddenError } from "@/domain/roles";
import type { Actor, AiProposal, ID, Refs } from "@/domain/types";
import { emit, type EventType } from "@/events/bus";
import { BusinessError } from "./_shared";
import { authorize } from "./access";

/** Proposals expire if nobody confirms them. */
export const AI_PROPOSAL_TTL_MS = 15 * 60 * 1000;

const sameActor = (p: AiProposal, a: Actor) =>
  p.proposedBy.kind === a.kind && p.proposedBy.userId === a.userId && p.proposedBy.customerId === a.customerId;

export const listAiProposals = (status?: AiProposal["status"]) => db().aiProposals.filter((p) => !status || p.status === status);

export function proposeAiAction(actor: Actor, input: { tool: string; input: Record<string, unknown>; preview: AiProposal["preview"] }) {
  authorize(actor, null, true);
  return mutate((s) => {
    const p: AiProposal = {
      id: `AIP-${crypto.randomUUID()}`,
      organizationId: s.organizationId,
      tool: input.tool,
      input: structuredClone(input.input),
      preview: input.preview,
      proposedBy: { kind: actor.kind, name: actor.name, userId: actor.userId, customerId: actor.customerId },
      status: "pending",
      createdAt: nowIso(),
      expiresAt: new Date(now() + AI_PROPOSAL_TTL_MS).toISOString(),
    };
    s.aiProposals.push(p);
    emit("AI_ACTION_PROPOSED", { actor, refs: {}, summary: `AI prepared “${p.preview.title}” (${p.tool}) — waiting for ${actor.name} to confirm`, data: { proposalId: p.id, tool: p.tool } });
    return p;
  });
}

/** The pending proposal, if (and only if) this actor in this organization may act on it. */
export function pendingProposalFor(actor: Actor, id: ID): AiProposal {
  authorize(actor, null, true);
  const p = db().aiProposals.find((x) => x.id === id);
  if (!p) throw new BusinessError("That action wasn't found.");
  if (!sameActor(p, actor)) throw new ForbiddenError("Only the person who asked for this action can confirm it.");
  if (p.status !== "pending") throw new BusinessError(`This action was already ${p.status}.`);
  if (new Date(p.expiresAt).getTime() < now()) {
    mutate(() => {
      p.status = "expired";
      p.resolvedAt = nowIso();
    });
    throw new BusinessError("This action expired. Ask again.");
  }
  return p;
}

const OUTCOME: Record<"confirmed" | "cancelled" | "failed", EventType> = { confirmed: "AI_ACTION_CONFIRMED", cancelled: "AI_ACTION_CANCELLED", failed: "AI_ACTION_FAILED" };

export function resolveAiProposal(actor: Actor, id: ID, status: "confirmed" | "cancelled" | "failed", error?: string) {
  const p = pendingProposalFor(actor, id);
  return mutate(() => {
    p.status = status;
    p.resolvedAt = nowIso();
    p.error = error;
    emit(OUTCOME[status], { actor, refs: {}, summary: `${actor.name} ${status} AI action “${p.preview.title}”${error ? `: ${error}` : ""}`, data: { proposalId: p.id, tool: p.tool } });
    return p;
  });
}

/** Audit record for every AI write, in addition to the business service's own events. */
export function recordAiWrite(actor: Actor, tool: string, refs: Refs = {}, proposalId?: ID) {
  return mutate(() => emit("AI_ACTION_EXECUTED", { actor, refs, summary: `AI tool ${tool} executed for ${actor.name}${proposalId ? ` (confirmed ${proposalId})` : ""}`, data: { tool, proposalId } }));
}
