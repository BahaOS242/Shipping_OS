/**
 * EXCEPTION SERVICE — anything that needs a human.
 * Created by business rules (system), staff, or the AI. Always references real records.
 */
import { nowIso } from "@/data/clock";
import { db, mutate, nextSeq } from "@/data/store";
import { EXCEPTION_CATALOG, SEVERITY_COPY } from "@/domain/copy";
import { can } from "@/domain/roles";
import type { Actor, ExceptionStatus, ExceptionType, ID, OpsException, Severity, Team } from "@/domain/types";
import { SYSTEM, emit } from "@/events/bus";
import { BusinessError, byId } from "./_shared";
import { authorize } from "./access";

type Links = Pick<OpsException, "customerId" | "packageId" | "shipmentId" | "billId" | "purchaseInvoiceId">;

export function raiseException(
  actor: Actor,
  input: Links & { type: ExceptionType; detail: string; title?: string; severity?: Severity; team?: Team; source?: OpsException["source"] },
): OpsException {
  return mutate((s) => {
    const cat = EXCEPTION_CATALOG[input.type];
    const ex: OpsException = {
      id: `EX-${nextSeq("ex", 1000)}`,
      organizationId: s.organizationId,
      type: input.type,
      severity: input.severity ?? cat.severity,
      title: input.title ?? cat.label,
      detail: input.detail,
      customerId: input.customerId,
      packageId: input.packageId,
      shipmentId: input.shipmentId,
      billId: input.billId,
      purchaseInvoiceId: input.purchaseInvoiceId,
      createdAt: nowIso(),
      team: input.team ?? cat.team,
      status: "open",
      notes: [],
      source: input.source ?? (actor.kind === "system" ? "system" : actor.kind === "ai" ? "ai" : "staff"),
    };
    s.exceptions.push(ex);
    emit("EXCEPTION_CREATED", {
      actor,
      refs: { exceptionId: ex.id, customerId: ex.customerId, packageId: ex.packageId, shipmentId: ex.shipmentId, billId: ex.billId, purchaseInvoiceId: ex.purchaseInvoiceId },
      summary: `${ex.title}: ${ex.detail}`,
      customerSummary: cat.customerMessage,
      data: { type: ex.type, severity: ex.severity, team: ex.team },
    });
    return ex;
  });
}

/** Idempotent: only one open exception per type + record. Used by automatic checks. */
export function ensureException(input: Parameters<typeof raiseException>[1]) {
  const existing = db().exceptions.find(
    (e) =>
      e.type === input.type &&
      !["resolved", "dismissed"].includes(e.status) &&
      e.packageId === input.packageId &&
      e.shipmentId === input.shipmentId &&
      e.billId === input.billId &&
      (input.packageId || input.shipmentId || input.billId ? true : e.customerId === input.customerId),
  );
  return existing ?? raiseException(SYSTEM, input);
}

export const isOpen = (e: OpsException) => e.status !== "resolved" && e.status !== "dismissed";

export type ExceptionFilter = { team?: Team; severity?: Severity; type?: ExceptionType; status?: ExceptionStatus | "active"; sinceDays?: number; customerId?: ID; packageId?: ID; shipmentId?: ID };

export function listExceptions(f: ExceptionFilter = {}) {
  const since = f.sinceDays ? Date.now() - f.sinceDays * 86_400_000 : 0;
  return db()
    .exceptions.filter(
      (e) =>
        (!f.team || e.team === f.team) &&
        (!f.severity || e.severity === f.severity) &&
        (!f.type || e.type === f.type) &&
        (!f.status || (f.status === "active" ? isOpen(e) : e.status === f.status)) &&
        (!f.customerId || e.customerId === f.customerId) &&
        (!f.packageId || e.packageId === f.packageId) &&
        (!f.shipmentId || e.shipmentId === f.shipmentId) &&
        new Date(e.createdAt).getTime() >= since,
    )
    .sort((a, b) => Number(isOpen(b)) - Number(isOpen(a)) || SEVERITY_COPY[b.severity].rank - SEVERITY_COPY[a.severity].rank || b.createdAt.localeCompare(a.createdAt));
}

export const getException = (id: ID) => byId(db().exceptions, id, "Exception");

function update(actor: Actor, id: ID, fn: (e: OpsException) => void, summary: string, type: "EXCEPTION_UPDATED" | "EXCEPTION_RESOLVED" = "EXCEPTION_UPDATED") {
  authorize(actor, null, can(actor, "exception.manage") || actor.kind === "system", "Only staff can work on exceptions.");
  return mutate(() => {
    const e = getException(id);
    fn(e);
    emit(type, { actor, refs: { exceptionId: e.id, customerId: e.customerId, packageId: e.packageId, shipmentId: e.shipmentId, billId: e.billId }, summary: `${e.id} ${summary}` });
    return e;
  });
}

export const assignException = (actor: Actor, id: ID, assignee: string) =>
  update(actor, id, (e) => {
    e.assignee = assignee;
    e.status = "assigned";
  }, `assigned to ${assignee}`);

export const startException = (actor: Actor, id: ID) =>
  update(actor, id, (e) => {
    e.status = "in_progress";
    e.assignee ??= actor.name;
  }, `started by ${actor.name}`);

export const noteException = (actor: Actor, id: ID, text: string) =>
  update(actor, id, (e) => e.notes.push({ at: nowIso(), by: actor.name, text }), `note: ${text}`);

type ResolveHook = (e: OpsException, actor: Actor) => void;
const resolveHooks: ResolveHook[] = [];
/** Other services react to resolutions (e.g. customs review → back to ready). */
export const onExceptionResolved = (h: ResolveHook) => resolveHooks.push(h);

export function resolveException(actor: Actor, id: ID, resolution: string) {
  if (!resolution.trim()) throw new BusinessError("Say how it was resolved.");
  return mutate(() => {
    const e = update(actor, id, (x) => {
      x.status = "resolved";
      x.resolution = resolution.trim();
      x.resolvedAt = nowIso();
      x.notes.push({ at: nowIso(), by: actor.name, text: `Resolved: ${resolution.trim()}` });
    }, `resolved — ${resolution.trim()}`, "EXCEPTION_RESOLVED");
    resolveHooks.forEach((h) => h(e, actor));
    return e;
  });
}

export const dismissException = (actor: Actor, id: ID, reason: string) =>
  update(actor, id, (e) => {
    e.status = "dismissed";
    e.resolution = reason || "Dismissed";
    e.resolvedAt = nowIso();
  }, `dismissed — ${reason}`);

/** Auto-resolve open exceptions of a type for a record (e.g. invoice arrived). */
export function autoResolve(type: ExceptionType, match: Partial<Links>, resolution: string) {
  for (const e of db().exceptions) {
    if (e.type !== type || !isOpen(e)) continue;
    if (Object.entries(match).every(([k, v]) => e[k as keyof Links] === v)) resolveException(SYSTEM, e.id, resolution);
  }
}
