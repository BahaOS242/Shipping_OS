/**
 * PLANNER — decides what the customer wants.
 * Demo: deterministic keyword rules (predictable live demos).
 * Production: an LLM planner (e.g. Claude tool use) behind the same interface,
 * choosing from the same controlled tools.
 */
import type { DestinationId } from "@/domain/types";
import type { AgentContext, AgentInput } from "./types";

export type Intent =
  | { name: "greet" }
  | { name: "find_package"; merchant?: string; packageId?: string }
  | { name: "quote"; weight?: number; destinationId?: DestinationId }
  | { name: "balance" }
  | { name: "billing_problem"; text: string }
  | { name: "delivery" }
  | { name: "storage" }
  | { name: "claim" }
  | { name: "how_it_works" }
  | { name: "address" }
  | { name: "consolidate" }
  | { name: "locations" }
  | { name: "human"; reason: string }
  | { name: "thanks" }
  | { name: "open_link"; href: string }
  | { name: "fallback"; text: string };

export interface Planner {
  plan(input: AgentInput, context: AgentContext): Intent;
}

const MERCHANTS = ["amazon", "walmart", "target", "home depot", "best buy", "shein", "wayfair", "lowe's", "lowes", "macy's", "uline", "grainger", "asos"];

export function findDestination(t: string): DestinationId | undefined {
  if (/\bnassau\b|new providence/.test(t)) return "nassau";
  if (/\babaco\b|marsh harbour/.test(t)) return "abaco";
  if (/\bexuma\b|george town/.test(t)) return "exuma";
  if (/grand bahama|freeport/.test(t)) return "grand_bahama";
  if (/eleuthera/.test(t)) return "eleuthera";
  if (/andros/.test(t)) return "andros";
  if (/long island/.test(t)) return "long_island";
  if (/bimini/.test(t)) return "bimini";
  if (/cat island/.test(t)) return "cat_island";
  return undefined;
}

export function parseWeight(t: string) {
  const m = t.match(/(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilos?)?/);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  if (!(n > 0)) return undefined;
  return m[2]?.startsWith("k") ? Math.round(n * 2.20462 * 10) / 10 : n;
}

export const rulePlanner: Planner = {
  plan(input, context) {
    if (input.kind === "action") return fromAction(input.id, context);
    const text = input.text.trim();
    const t = text.toLowerCase().replace(/’/g, "'");
    const dest = findDestination(t);
    const weight = parseWeight(t);
    const pkgId = t.match(/tl-pkg-\d+/)?.[0]?.toUpperCase();

    if (context.awaiting === "destination" && dest) return { name: "quote", weight: context.weight, destinationId: dest };
    if (context.awaiting === "weight" && weight) return { name: "quote", weight, destinationId: context.destinationId };

    if (/(charged twice|double charge|overcharg|wrong (bill|charge|amount)|refund)/.test(t)) return { name: "billing_problem", text };
    if (/\b(human|person|agent|someone|staff|representative|real person|call me)\b/.test(t)) return { name: "human", reason: text };
    if (/(owe|balance|my bill|bills|invoice|pay (my|now)|due)/.test(t)) return { name: "balance" };
    if (/(damaged|broken|missing item|claim|smashed)/.test(t)) return { name: "claim" };
    if (/(cost|price|how much|quote|rate|fee)/.test(t)) return { name: "quote", weight, destinationId: dest };
    if (/(together|combine|consolidat)/.test(t)) return { name: "consolidate" };
    if (/(storage|how long.*(hold|keep)|waiting fee)/.test(t)) return { name: "storage" };
    if (/(deliver|delivery|driver|out for)/.test(t) && !/(where('s| is) my)/.test(t)) return { name: "delivery" };
    if (/(address|where do i send|suite|box number)/.test(t)) return { name: "address" };
    if (/(pick ?up|location|open|hours|office)/.test(t)) return { name: "locations" };
    if (/(don't know|dont know|not sure|how (does|do) (this|it|you) work|confused|explain|new here|how it works)/.test(t)) return { name: "how_it_works" };
    const merchant = MERCHANTS.find((m) => t.includes(m));
    if (pkgId || merchant || /(where|package|parcel|stuff|order|track|status|arriv|box)/.test(t)) return { name: "find_package", merchant, packageId: pkgId };
    if (/^(hi|hey|hello|good (morning|afternoon|evening))\b/.test(t)) return { name: "greet" };
    if (/(thank|thanks|thx)/.test(t)) return { name: "thanks" };
    return { name: "fallback", text };
  },
};

function fromAction(id: string, context: AgentContext): Intent {
  if (id.startsWith("link:")) return { name: "open_link", href: id.slice(5) };
  const [kind, a, b] = id.split(":");
  switch (kind) {
    case "menu": return { name: "greet" };
    case "find_package": return { name: "find_package" };
    case "package": return { name: "find_package", packageId: a };
    case "quote": return { name: "quote", weight: a ? parseFloat(a) : undefined, destinationId: (b as DestinationId) || context.destinationId };
    case "balance": return { name: "balance" };
    case "how_it_works": return { name: "how_it_works" };
    case "human": return { name: "human", reason: "Customer asked to talk to a person" };
    case "address": return { name: "address" };
    default: return { name: "fallback", text: id };
  }
}
