/**
 * AI TOOL EXECUTOR — the one door between any AI runtime and Shipping OS.
 *
 * For every call, before the service runs:
 *   1. the tool exists and the input matches its schema
 *   2. the call is for the organization in scope (request tenant = tool context)
 *   3. the actor is a member of that organization (services/access.assertMember)
 *   4. the organization has the tool's module
 *   5. the actor's role has the tool's permission (customer tools: own records only)
 * then:
 *   read                     → run, record in the turn's trace
 *   write, no confirmation   → run, audit event
 *   write, confirmation      → PROPOSE (nothing changes); `confirmToolAction` by the
 *                              same user re-runs 1–5, then the service, then audits
 * The services repeat their own checks — this is defense in depth, not a second
 * authorization system: it reuses `assertMember`, `requireModule` and `can`.
 */
import { ForbiddenError, can } from "@/domain/roles";
import type { Actor, AiProposal, Channel, ID } from "@/domain/types";
import * as svc from "@/services";
import type { ToolContext, ToolSpec } from "./contract";
import { STAFF_TOOLS } from "./staffTools";
import { CUSTOMER_TOOLS } from "./tools";

export type { ToolContext } from "./contract";
export const ALL_TOOLS: ToolSpec[] = [...CUSTOMER_TOOLS, ...STAFF_TOOLS];
/** Customer-facing tools (assistant, WhatsApp, public API/MCP). */
export const TOOLS = CUSTOMER_TOOLS;

export type ToolTrace = { tool: string; input: Record<string, unknown>; ok: boolean; error?: string };
export type ToolOutcome<T = unknown> = { status: "done"; result: T } | { status: "needs_confirmation"; proposal: AiProposal };

export const findTool = (name: string) => ALL_TOOLS.find((t) => t.name === name);

/** Context for the customer assistant: an AI actor scoped to one customer of the organization in scope. */
export function customerToolContext(customerId: ID, channel: Channel): ToolContext {
  const organizationId = svc.currentOrganization().id;
  return { organizationId, actor: svc.aiActor(customerId, organizationId), channel };
}

/** Context for a staff assistant: the signed-in staff user, marked as acting via AI. */
export function staffToolContext(staff: Actor, channel: Channel = "web"): ToolContext {
  if (staff.kind !== "staff") throw new ForbiddenError("Staff tools need a staff user.");
  return { organizationId: staff.organizationId, actor: { ...staff, via: "ai" }, channel };
}

function validateInput(tool: ToolSpec, input: Record<string, unknown>) {
  const { properties, required = [] } = tool.inputSchema;
  for (const k of required) if (input[k] === undefined || input[k] === null || input[k] === "") throw new Error(`${tool.name}: missing ${k}`);
  for (const [k, v] of Object.entries(input)) {
    const p = properties[k];
    if (!p) throw new Error(`${tool.name}: unexpected field ${k}`);
    if (v === undefined) continue;
    if (p.type === "number" ? !Number.isFinite(Number(v)) : typeof v !== p.type) throw new Error(`${tool.name}: ${k} must be a ${p.type}`);
    if (p.enum && !p.enum.includes(String(v))) throw new Error(`${tool.name}: ${k} must be one of ${p.enum.join(", ")}`);
  }
}

/** Steps 2–5. Throws ForbiddenError / ModuleDisabledError. */
export function authorizeToolCall(tool: ToolSpec, ctx: ToolContext) {
  const org = svc.currentOrganization();
  if (ctx.organizationId !== org.id || ctx.actor.organizationId !== org.id) throw new ForbiddenError("This tool call isn't for the organization in scope.");
  svc.assertMember(ctx.actor);
  if (tool.module) svc.requireModule(tool.module);
  if (tool.audience === "customer") {
    if (ctx.actor.kind !== "ai" || !ctx.actor.customerId) throw new ForbiddenError(`${tool.name} acts for a signed-in customer.`);
  } else {
    if (ctx.actor.kind !== "staff" || ctx.actor.via !== "ai") throw new ForbiddenError(`${tool.name} acts for a staff user.`);
    if (!can(ctx.actor, tool.permission)) throw new ForbiddenError(`Your role can't use ${tool.name}.`);
  }
}

function run(tool: ToolSpec, input: Record<string, unknown>, ctx: ToolContext, proposalId?: ID) {
  const result = tool.run(input, ctx);
  if (tool.kind === "write") {
    const r = result as { id?: string; customerId?: string; shipmentId?: string } | undefined;
    svc.recordAiWrite(ctx.actor, tool.name, { customerId: r?.customerId, shipmentId: r?.shipmentId }, proposalId);
  }
  return result;
}

export function executeTool<T = unknown>(name: string, input: Record<string, unknown>, ctx: ToolContext, trace?: ToolTrace[]): ToolOutcome<T> {
  const tool = findTool(name);
  try {
    if (!tool) throw new Error(`Unknown tool ${name}`);
    validateInput(tool, input);
    authorizeToolCall(tool, ctx);
    if (tool.confirmation === "required") {
      const proposal = svc.proposeAiAction(ctx.actor, { tool: tool.name, input, preview: tool.preview!(input, ctx) });
      trace?.push({ tool: name, input, ok: true });
      return { status: "needs_confirmation", proposal };
    }
    const result = run(tool, input, ctx) as T;
    trace?.push({ tool: name, input, ok: true });
    return { status: "done", result };
  } catch (e) {
    trace?.push({ tool: name, input, ok: false, error: (e as Error).message });
    throw e;
  }
}

/** The same user confirms a proposal: full re-authorization, then the real service. */
export function confirmToolAction<T = unknown>(proposalId: ID, ctx: ToolContext): T {
  const p = svc.pendingProposalFor(ctx.actor, proposalId);
  const tool = findTool(p.tool)!;
  try {
    validateInput(tool, p.input);
    authorizeToolCall(tool, ctx);
    const result = run(tool, p.input, ctx, p.id) as T;
    svc.resolveAiProposal(ctx.actor, p.id, "confirmed");
    return result;
  } catch (e) {
    svc.resolveAiProposal(ctx.actor, p.id, "failed", (e as Error).message);
    throw e;
  }
}

export const cancelToolAction = (proposalId: ID, ctx: ToolContext) => svc.resolveAiProposal(ctx.actor, proposalId, "cancelled");

/** Direct-result helper for tools that never need confirmation (customer assistant). */
export function runTool<T = unknown>(name: string, input: Record<string, unknown>, ctx: ToolContext, trace?: ToolTrace[]): T {
  const out = executeTool<T>(name, input, ctx, trace);
  if (out.status !== "done") throw new Error(`${name} needs confirmation.`);
  return out.result;
}

/** MCP `tools/list` shape for the customer tools. Future MCP names are snake_case versions. */
export const toolManifest = () =>
  TOOLS.map((t) => ({ name: t.name, mcpName: t.name.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`), description: t.description, inputSchema: t.inputSchema, annotations: { readOnlyHint: t.kind === "read" }, module: t.module, kind: t.kind, confirmation: t.confirmation }));
