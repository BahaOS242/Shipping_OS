/**
 * CONTROLLED TOOLS
 *
 * The only things the AI agent is allowed to do. Each tool:
 *  - has a JSON Schema (so it can be exposed 1:1 as an MCP tool or an LLM tool),
 *  - is scoped to the signed-in customer via ToolContext — the model can never
 *    pick whose data it reads,
 *  - calls The Link API, never the database.
 *
 * The same registry powers: the web assistant, the WhatsApp channel,
 * the /api/tools endpoints and the /api/mcp JSON-RPC endpoint.
 */
import * as api from "../api/link-api";
import { ISLANDS } from "../pricing";
import { STATUS } from "../status";
import type { Channel, ID, IslandId, ShippingMode } from "../types";

export type ToolContext = {
  /** The authenticated customer. Set by the channel, never by the model. */
  customerId: ID;
  channel: Channel;
};

type JSONSchema = {
  type: "object";
  properties: Record<string, { type: string; description?: string; enum?: readonly string[] }>;
  required?: string[];
  additionalProperties?: false;
};

export type ToolDefinition<I = Record<string, unknown>, O = unknown> = {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  /** "read" tools are safe to auto-run. "write" tools change state. */
  access: "read" | "write";
  handler: (input: I, ctx: ToolContext) => Promise<O>;
};

const islandIds = Object.keys(ISLANDS) as IslandId[];

function defineTool<I, O>(t: ToolDefinition<I, O>) {
  return t as unknown as ToolDefinition;
}

export const tools = {
  getCustomer: defineTool<Record<string, never>, unknown>({
    name: "getCustomer",
    description: "Get the signed-in customer's profile and U.S. shopping address.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    access: "read",
    async handler(_input, ctx) {
      const c = await api.getCustomer(ctx.customerId);
      return {
        firstName: c.firstName,
        accountNumber: c.accountNumber,
        homeIsland: ISLANDS[c.homeIsland].name,
        shoppingAddress: await api.getShoppingAddress(c.id),
      };
    },
  }),

  getPackages: defineTool<{ status?: string }, unknown>({
    name: "getPackages",
    description: "List the signed-in customer's packages with plain-language status.",
    inputSchema: {
      type: "object",
      properties: { status: { type: "string", description: "Optional status filter", enum: Object.keys(STATUS) } },
      additionalProperties: false,
    },
    access: "read",
    async handler(input, ctx) {
      const pkgs = await api.getPackages(ctx.customerId);
      return pkgs
        .filter((p) => !input.status || p.status === input.status)
        .map((p) => ({
          id: p.id,
          merchant: p.merchant,
          itemName: p.itemName,
          weight: p.weight,
          status: p.status,
          statusTitle: STATUS[p.status].title,
          explain: STATUS[p.status].explain,
          next: STATUS[p.status].next,
          where: STATUS[p.status].where,
        }));
    },
  }),

  getPackage: defineTool<{ packageId: string }, unknown>({
    name: "getPackage",
    description: "Get one of the signed-in customer's packages by id.",
    inputSchema: {
      type: "object",
      properties: { packageId: { type: "string" } },
      required: ["packageId"],
      additionalProperties: false,
    },
    access: "read",
    async handler(input, ctx) {
      const p = await api.getPackage(input.packageId, { customerId: ctx.customerId });
      return { ...p, statusTitle: STATUS[p.status].title, explain: STATUS[p.status].explain, next: STATUS[p.status].next };
    },
  }),

  getShipment: defineTool<{ packageId: string }, unknown>({
    name: "getShipment",
    description: "Get the trip (flight or boat) a customer's package is traveling on.",
    inputSchema: {
      type: "object",
      properties: { packageId: { type: "string" } },
      required: ["packageId"],
      additionalProperties: false,
    },
    access: "read",
    async handler(input, ctx) {
      const p = await api.getPackage(input.packageId, { customerId: ctx.customerId });
      if (!p.shipmentId) return { traveling: false };
      const s = await api.getShipment(p.shipmentId);
      return { traveling: true, label: s.label, mode: s.mode, arrivesAt: s.arrivesAt, status: s.status };
    },
  }),

  calculateShipping: defineTool<{ destination: IslandId; weight: number; mode?: ShippingMode }, unknown>({
    name: "calculateShipping",
    description: "Estimate the shipping cost (DEMO estimate, not an official price).",
    inputSchema: {
      type: "object",
      properties: {
        destination: { type: "string", enum: islandIds },
        weight: { type: "number", description: "Pounds" },
        mode: { type: "string", enum: ["air", "sea"] },
      },
      required: ["destination", "weight"],
      additionalProperties: false,
    },
    access: "read",
    async handler(input) {
      return api.calculateShipping({ destination: input.destination, weight: input.weight, mode: input.mode ?? "air" });
    },
  }),

  getLocations: defineTool<{ island?: IslandId }, unknown>({
    name: "getLocations",
    description: "List The Link's warehouse and pickup locations.",
    inputSchema: {
      type: "object",
      properties: { island: { type: "string", enum: islandIds } },
      additionalProperties: false,
    },
    access: "read",
    async handler(input) {
      const all = await api.getLocations();
      return input.island ? all.filter((l) => l.island === input.island || l.kind === "us_warehouse") : all;
    },
  }),

  getShippingRules: defineTool<Record<string, never>, unknown>({
    name: "getShippingRules",
    description: "Get the current (demo) pricing rules and disclaimers.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    access: "read",
    async handler() {
      return api.getShippingRules();
    },
  }),

  createQuote: defineTool<{ destination: IslandId; weight: number; mode: ShippingMode }, unknown>({
    name: "createQuote",
    description: "Save a shipping quote for the signed-in customer (DEMO).",
    inputSchema: {
      type: "object",
      properties: {
        destination: { type: "string", enum: islandIds },
        weight: { type: "number" },
        mode: { type: "string", enum: ["air", "sea"] },
      },
      required: ["destination", "weight", "mode"],
      additionalProperties: false,
    },
    access: "write",
    async handler(input, ctx) {
      return api.createQuote({ ...input, customerId: ctx.customerId });
    },
  }),

  createSupportTicket: defineTool<{ subject: string; message: string; packageId?: string }, unknown>({
    name: "createSupportTicket",
    description: "Open a support request for the signed-in customer.",
    inputSchema: {
      type: "object",
      properties: { subject: { type: "string" }, message: { type: "string" }, packageId: { type: "string" } },
      required: ["subject", "message"],
      additionalProperties: false,
    },
    access: "write",
    async handler(input, ctx) {
      return api.createSupportTicket({ ...input, customerId: ctx.customerId, channel: ctx.channel });
    },
  }),

  escalateToHuman: defineTool<{ reason: string; packageId?: string }, unknown>({
    name: "escalateToHuman",
    description: "Hand the conversation to a person on The Link team.",
    inputSchema: {
      type: "object",
      properties: { reason: { type: "string" }, packageId: { type: "string" } },
      required: ["reason"],
      additionalProperties: false,
    },
    access: "write",
    async handler(input, ctx) {
      return api.escalateToHuman({ ...input, customerId: ctx.customerId, channel: ctx.channel });
    },
  }),
} satisfies Record<string, ToolDefinition>;

export type ToolName = keyof typeof tools;

export type ToolCallTrace = { tool: ToolName; input: unknown; ok: boolean; ms: number };

/** Run a tool by name with validation-by-registry and a trace for observability. */
export async function runTool<T = unknown>(
  name: ToolName,
  input: Record<string, unknown>,
  ctx: ToolContext,
  trace?: ToolCallTrace[],
): Promise<T> {
  const tool = tools[name];
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  for (const key of tool.inputSchema.required ?? []) {
    if (input[key] === undefined) throw new Error(`${name}: missing "${key}"`);
  }
  const started = Date.now();
  try {
    const out = (await tool.handler(input, ctx)) as T;
    trace?.push({ tool: name, input, ok: true, ms: Date.now() - started });
    return out;
  } catch (e) {
    trace?.push({ tool: name, input, ok: false, ms: Date.now() - started });
    throw e;
  }
}

/** Manifest in MCP `tools/list` shape. */
export function toolManifest() {
  return Object.values(tools).map((t) => ({
    name: t.name,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: { readOnlyHint: t.access === "read" },
  }));
}
