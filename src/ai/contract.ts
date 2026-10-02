/**
 * AI TOOL CONTRACT — the only way any AI runtime touches Shipping OS.
 *
 *   AI runtime → AI tool (this contract) → existing Shipping OS service
 *             → organization authorization → role permission → business rules → store
 *
 * A tool is a thin, declared adapter over a service. It never reads the store
 * (enforced by lint: src/ai/** cannot import @/data/*) and never re-implements
 * business rules: the service it names does the work and repeats every check.
 * The executor (executor.ts) enforces the declared fields BEFORE the service runs,
 * so a tool can't be used to reach a module, role or record the actor couldn't.
 */
import type { Permission } from "@/domain/roles";
import type { Actor, Channel, ID } from "@/domain/types";
import { MODULES, isModuleId, type ModuleId } from "@/platform/modules";

export type JsonSchema = {
  type: "object";
  properties: Record<string, { type: "string" | "number" | "boolean"; description?: string; enum?: readonly string[] }>;
  required?: string[];
  additionalProperties: false;
};

/** Who the AI is acting for. Organization + actor come from the authenticated request, never from the model. */
export type ToolContext = {
  organizationId: ID;
  /** Customer audience: an `ai` actor scoped to one customer. Staff audience: the staff user, marked `via: "ai"`. */
  actor: Actor;
  channel: Channel;
};

export type ToolPreview = { title: string; lines: string[] };

export type ToolSpec = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  /** customer = the signed-in customer's own records; staff = delegated staff user. */
  audience: "customer" | "staff";
  /** Entitlement required (null = core platform, available to every organization). */
  module: ModuleId | null;
  /** Role permission required. Customer tools use `customer.self` (ownership). */
  permission: Permission;
  /** read = no side effects, runs automatically. write = changes data. */
  kind: "read" | "write";
  /** required = returns a proposal; nothing changes until the same user confirms. */
  confirmation: "none" | "required";
  /** The service function the tool delegates to (documentation + audit). */
  service: string;
  /** trace = recorded in the turn's tool trace only; event = audit-log event (plus the service's own events). */
  audit: "trace" | "event";
  /** For confirmation: describe the action from service reads, without changing anything. */
  preview?: (input: Record<string, unknown>, ctx: ToolContext) => ToolPreview;
  run: (input: Record<string, unknown>, ctx: ToolContext) => unknown;
};

export const obj = (properties: JsonSchema["properties"] = {}, required: string[] = []): JsonSchema => ({ type: "object", properties, required, additionalProperties: false });

/** Contract problems for a tool (empty = valid). Checked for every tool at load time. */
export function contractProblems(t: ToolSpec): string[] {
  const p: string[] = [];
  if (!/^[a-z][A-Za-z]+$/.test(t.name)) p.push("name must be camelCase");
  if (!t.description.trim()) p.push("description required");
  if (!t.service.includes(".")) p.push("service must name module.function");
  if (t.module !== null) {
    if (!isModuleId(t.module)) p.push(`unknown module ${t.module}`);
    else if (MODULES[t.module].availability !== "available") p.push(`module ${t.module} is planned, not implemented`);
  }
  if (t.audience === "customer" && t.permission !== "customer.self") p.push("customer tools use customer.self");
  if (t.audience === "staff" && t.permission === "customer.self") p.push("staff tools need a staff permission");
  if (t.kind === "read" && (t.confirmation !== "none" || t.audit !== "trace")) p.push("reads run automatically and are traced");
  if (t.kind === "write" && t.audit !== "event") p.push("writes must be audited as events");
  if (t.confirmation === "required" && !t.preview) p.push("confirmation needs a preview");
  for (const r of t.inputSchema.required ?? []) if (!t.inputSchema.properties[r]) p.push(`required field ${r} not in schema`);
  return p;
}

export function defineTools(tools: ToolSpec[]): ToolSpec[] {
  const names = new Set<string>();
  for (const t of tools) {
    const problems = contractProblems(t);
    if (names.has(t.name)) problems.push("duplicate name");
    names.add(t.name);
    if (problems.length) throw new Error(`AI tool ${t.name}: ${problems.join("; ")}`);
  }
  return tools;
}
