import type { IslandId, Island, QuoteLine, ShippingMode, ShippingRules } from "./types";

export const ISLANDS: Record<IslandId, Island> = {
  nassau: { id: "nassau", name: "Nassau", zone: "hub" },
  abaco: { id: "abaco", name: "Abaco", zone: "family_island" },
  exuma: { id: "exuma", name: "Exuma", zone: "family_island" },
  grand_bahama: { id: "grand_bahama", name: "Grand Bahama", zone: "family_island" },
  eleuthera: { id: "eleuthera", name: "Eleuthera", zone: "family_island" },
  andros: { id: "andros", name: "Andros", zone: "family_island" },
  long_island: { id: "long_island", name: "Long Island", zone: "family_island" },
  bimini: { id: "bimini", name: "Bimini", zone: "family_island" },
  cat_island: { id: "cat_island", name: "Cat Island", zone: "family_island" },
};

/** The three islands we show as big buttons; everything else is "Another island". */
export const MAIN_ISLANDS: IslandId[] = ["nassau", "abaco", "exuma"];
export const OTHER_ISLANDS: IslandId[] = ["grand_bahama", "eleuthera", "andros", "long_island", "bimini", "cat_island"];

/**
 * DEMO pricing rules.
 *
 * Believable placeholders shaped like a per-pound air/sea tariff with a
 * family-island add-on. NOT The Link's official live pricing.
 * In production these come from getShippingRules() backed by the rates table.
 */
export const DEMO_SHIPPING_RULES: ShippingRules = {
  currency: "USD",
  isDemo: true,
  air: { perLb: 2.5, minimum: 12.5, days: "3–5 days" },
  sea: { perLb: 1.1, minimum: 25, days: "10–14 days" },
  familyIsland: { perLbSurcharge: 0.75, flatFee: 10 },
  handlingPerPackage: 0,
  disclaimers: [
    "This is a demo estimate, not an official price.",
    "Your final price may change depending on the package's size and weight.",
    "Government import taxes (customs duty and VAT) are not included.",
  ],
};

export type EstimateInput = {
  destination: IslandId;
  /** Pounds. */
  weight: number;
  mode: ShippingMode;
  packageCount?: number;
};

export type Estimate = {
  lines: QuoteLine[];
  total: number;
  transitDays: string;
  isDemo: true;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function estimateShipping(input: EstimateInput, rules: ShippingRules = DEMO_SHIPPING_RULES): Estimate {
  const weight = Math.max(0.1, input.weight);
  const rate = rules[input.mode];
  const island = ISLANDS[input.destination];
  const lines: QuoteLine[] = [];

  const base = Math.max(rate.minimum, weight * rate.perLb);
  const minApplied = weight * rate.perLb < rate.minimum;
  lines.push({
    label: minApplied
      ? `${input.mode === "air" ? "Flying" : "Boat"} — smallest price`
      : `${input.mode === "air" ? "Flying" : "Boat"} — ${fmtLbs(weight)} × $${rate.perLb.toFixed(2)}`,
    amount: round2(base),
  });

  if (island.zone === "family_island") {
    lines.push({
      label: `Extra trip to ${island.name}`,
      amount: round2(rules.familyIsland.flatFee + weight * rules.familyIsland.perLbSurcharge),
    });
  }

  if (rules.handlingPerPackage > 0 && (input.packageCount ?? 1) > 0) {
    lines.push({ label: "Handling", amount: round2(rules.handlingPerPackage * (input.packageCount ?? 1)) });
  }

  return {
    lines,
    total: round2(lines.reduce((sum, l) => sum + l.amount, 0)),
    transitDays: rate.days,
    isDemo: true,
  };
}

export function fmtLbs(n: number) {
  return `${Number.isInteger(n) ? n : n.toFixed(1)} lbs`;
}

export function fmtMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

export function kgToLbs(kg: number) {
  return round2(kg * 2.20462);
}

/** Find an island mentioned in free text ("send it to abaco"). */
export function findIsland(text: string): IslandId | undefined {
  const t = text.toLowerCase();
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
