/** CLAIMS SERVICE — damaged, missing, billing and delivery problems. */
import { nowIso } from "@/data/clock";
import { db, mutate, nextSeq } from "@/data/store";
import { CLAIM_REASON } from "@/domain/copy";
import { assert, can, canActOn } from "@/domain/roles";
import type { Actor, Claim, ClaimReason, ClaimStatus, ID } from "@/domain/types";
import { emit } from "@/events/bus";
import { BusinessError, byId } from "./_shared";

export const getClaim = (id: ID) => byId(db().claims, id, "Claim");

export function listClaims(f: { customerId?: ID; status?: ClaimStatus | "open" } = {}) {
  return db()
    .claims.filter((c) => (!f.customerId || c.customerId === f.customerId) && (!f.status || (f.status === "open" ? !["resolved", "rejected"].includes(c.status) : c.status === f.status)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createClaim(actor: Actor, input: { customerId: ID; reason: ClaimReason; description: string; packageId?: ID; shipmentId?: ID; billId?: ID; photos?: string[] }) {
  assert(canActOn(actor, "claim.manage", { customerId: input.customerId }), "You can only open claims on your own account.");
  if (input.description.trim().length < 5) throw new BusinessError("Tell us a little about what happened.");
  return mutate((s) => {
    const pkg = input.packageId ? s.packages.find((p) => p.id === input.packageId) : undefined;
    const c: Claim = {
      id: `CLM-${nextSeq("clm", 700)}`,
      customerId: input.customerId,
      packageId: input.packageId,
      shipmentId: input.shipmentId ?? pkg?.shipmentId,
      billId: input.billId,
      reason: input.reason,
      description: input.description.trim(),
      photos: input.photos ?? [],
      status: "submitted",
      team: CLAIM_REASON[input.reason].team,
      createdAt: nowIso(),
      updates: [],
    };
    s.claims.push(c);
    emit("CLAIM_CREATED", { actor, refs: { customerId: c.customerId, claimId: c.id, packageId: c.packageId, shipmentId: c.shipmentId, billId: c.billId }, summary: `Claim ${c.id}: ${CLAIM_REASON[c.reason].label}`, customerSummary: `We got your claim ${c.id}. We'll review it within 2 business days.` });
    return c;
  });
}

export function updateClaim(actor: Actor, id: ID, status: ClaimStatus, message: string) {
  assert(can(actor, "claim.manage"), "Only staff can update claims.");
  if (!message.trim()) throw new BusinessError("Add a note for the customer.");
  return mutate(() => {
    const c = getClaim(id);
    c.status = status;
    c.updates.push({ at: nowIso(), by: actor.name, text: message.trim() });
    if (status === "resolved" || status === "rejected") c.resolution = message.trim();
    emit("CLAIM_UPDATED", { actor, refs: { customerId: c.customerId, claimId: c.id, packageId: c.packageId }, summary: `${c.id} → ${status}: ${message.trim()}`, customerSummary: `Update on claim ${c.id}: ${message.trim()}` });
    return c;
  });
}

export function customerClaimReply(actor: Actor, id: ID, text: string) {
  const c = getClaim(id);
  assert(canActOn(actor, "claim.manage", c));
  return mutate(() => {
    c.updates.push({ at: nowIso(), by: actor.name, text });
    if (c.status === "waiting_for_customer") c.status = "under_review";
    emit("CLAIM_UPDATED", { actor, refs: { customerId: c.customerId, claimId: c.id }, summary: `Customer replied on ${c.id}` });
    return c;
  });
}
