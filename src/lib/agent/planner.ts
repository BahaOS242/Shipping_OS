/**
 * PLANNER — decides what the customer wants.
 *
 * Demo: a deterministic keyword planner (predictable for live demos).
 * Production: an LLM planner (e.g. Claude with tool use) implementing the same
 * `Planner` interface. The LLM would only ever choose an Intent / tool calls;
 * execution still goes through the controlled tool registry.
 */
import { findIsland } from "../pricing";
import type { IslandId } from "../types";
import type { AgentContext, AgentInput } from "./types";

export type Intent =
  | { name: "greet" }
  | { name: "find_package"; merchant?: string; packageId?: string }
  | { name: "quote"; weight?: number; destination?: IslandId }
  | { name: "how_it_works" }
  | { name: "address" }
  | { name: "consolidate" }
  | { name: "locations"; island?: IslandId }
  | { name: "human"; reason?: string }
  | { name: "thanks" }
  | { name: "open_link"; href: string }
  | { name: "fallback"; text: string };

export interface Planner {
  plan(input: AgentInput, context: AgentContext): Promise<Intent>;
}

const MERCHANTS = ["amazon", "walmart", "target", "home depot", "best buy", "shein", "wayfair", "lowe's", "lowes", "macy's", "uline", "grainger"];

export function parseWeight(text: string): number | undefined {
  const m = text.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(lbs?|pounds?|kg|kilos?)?/);
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return m[2]?.startsWith("k") ? Math.round(n * 2.20462 * 10) / 10 : n;
}

export const rulePlanner: Planner = {
  async plan(input, context) {
    if (input.kind === "action") return fromAction(input.id, context);

    const text = input.text.trim();
    const t = text.toLowerCase();
    const island = findIsland(t);
    const weight = parseWeight(t);

    // Follow-ups to a question we just asked.
    if (context.awaiting === "destination" && island) return { name: "quote", weight: context.weight, destination: island };
    if (context.awaiting === "weight" && weight) return { name: "quote", weight, destination: context.destination };

    if (/\b(human|person|agent|someone|staff|call me|representative|real person)\b/.test(t)) return { name: "human", reason: text };
    if (/(cost|price|how much|quote|rate|charge|fee)/.test(t)) return { name: "quote", weight, destination: island };
    if (/(together|combine|consolidat)/.test(t)) return { name: "consolidate" };
    if (/(address|where do i send|ship it to|suite|box number)/.test(t)) return { name: "address" };
    if (/(pick ?up|location|open|hours|office|where are you)/.test(t)) return { name: "locations", island };
    if (/(don['’]?t know|not sure|how (does|do) (this|it|you) work|confused|explain|new here|how it works)/.test(t))
      return { name: "how_it_works" };

    const merchant = MERCHANTS.find((m) => t.includes(m));
    if (merchant || /(where|package|parcel|stuff|order|track|status|arriv|keyboard|box)/.test(t))
      return { name: "find_package", merchant };

    if (/^(hi|hey|hello|good (morning|afternoon|evening)|yo)\b/.test(t)) return { name: "greet" };
    if (/(thank|thanks|thx|appreciate)/.test(t)) return { name: "thanks" };

    return { name: "fallback", text };
  },
};

function fromAction(id: string, context: AgentContext): Intent {
  if (id.startsWith("link:")) return { name: "open_link", href: id.slice(5) };
  const [kind, a, b] = id.split(":");
  switch (kind) {
    case "menu":
      return { name: "greet" };
    case "find_package":
      return { name: "find_package" };
    case "package":
      return { name: "find_package", packageId: a };
    case "quote":
      return { name: "quote", weight: a ? parseFloat(a) : undefined, destination: (b as IslandId) || undefined };
    case "dest":
      return { name: "quote", weight: context.weight, destination: a as IslandId };
    case "weight":
      return { name: "quote", weight: parseFloat(a), destination: context.destination };
    case "how_it_works":
      return { name: "how_it_works" };
    case "human":
      return { name: "human", reason: "Customer asked to talk to a person" };
    case "address":
      return { name: "address" };
    case "consolidate":
      return { name: "consolidate" };
    default:
      return { name: "fallback", text: id };
  }
}
