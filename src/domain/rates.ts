/**
 * RATES ENGINE — the only place prices and billable weight are calculated.
 *
 * DEMO rate card: believable placeholders, not Shipping OS's official prices.
 * Rules are keyed by service + zone so carriers/routes can vary later.
 */
import type { Destination, ServiceLevel, Zone } from "./types";

export type RateRule = {
  perLb: number;
  minimum: number;
  /** cubic inches per dimensional pound */
  dimDivisor: number;
  transit: string;
  zoneSurcharge: Record<Zone, { flat: number; perLb: number }>;
  maxPieceWeight: number;
  maxLength: number;
};

export const RATE_CARD: Record<ServiceLevel, RateRule> = {
  air: {
    perLb: 2.5,
    minimum: 12.5,
    dimDivisor: 166,
    transit: "3–5 days",
    zoneSurcharge: { hub: { flat: 0, perLb: 0 }, family_island: { flat: 10, perLb: 0.75 } },
    maxPieceWeight: 150,
    maxLength: 60,
  },
  ocean: {
    perLb: 1.1,
    minimum: 25,
    dimDivisor: 250,
    transit: "10–14 days",
    zoneSurcharge: { hub: { flat: 0, perLb: 0 }, family_island: { flat: 15, perLb: 0.35 } },
    maxPieceWeight: 2000,
    maxLength: 240,
  },
};

export const RATES_ARE_SIMULATED = true;

export const DISCLAIMERS = [
  "Demo estimate — not an official price.",
  "Your final price depends on the package's real weight and size.",
  "Government import taxes (customs duty and VAT) are not included.",
];

const round2 = (n: number) => Math.round(n * 100) / 100;
/** Carriers bill in whole pounds (demo rule: round up to next 0.5 lb). */
const roundUpHalf = (n: number) => Math.ceil(n * 2) / 2;

export type Dimensions = { length?: number; width?: number; height?: number };

export function calculateDimensionalWeight(d: Dimensions, service: ServiceLevel): number | undefined {
  if (!d.length || !d.width || !d.height) return undefined;
  return roundUpHalf((d.length * d.width * d.height) / RATE_CARD[service].dimDivisor);
}

export type BillableWeight = { actual: number; dimensional?: number; billable: number; basis: "actual" | "dimensional" };

/** Billable weight = the greater of real weight and size-based weight. */
export function calculateBillableWeight(pkg: Dimensions & { actualWeight?: number }, service: ServiceLevel): BillableWeight {
  const actual = pkg.actualWeight ?? 0;
  const dimensional = calculateDimensionalWeight(pkg, service);
  const dimWins = dimensional !== undefined && dimensional > actual;
  return { actual, dimensional, billable: roundUpHalf(dimWins ? dimensional! : Math.max(actual, 0.5)), basis: dimWins ? "dimensional" : "actual" };
}

export type CostLine = { label: string; amount: number; kind: "shipping" | "island_delivery" };

export type ShippingEstimate = {
  service: ServiceLevel;
  destinationName: string;
  billableWeight: number;
  basis: BillableWeight["basis"];
  lines: CostLine[];
  total: number;
  transit: string;
  simulated: true;
};

/**
 * calculateShippingCost — works for one package or several traveling together
 * (packages sent together share one minimum charge).
 */
export function calculateShippingCost(
  input: { weights: BillableWeight[] } | { billableWeight: number },
  destination: Destination,
  service: ServiceLevel,
): ShippingEstimate {
  const rule = RATE_CARD[service];
  const billable = "weights" in input ? roundUpHalf(input.weights.reduce((s, w) => s + w.billable, 0)) : roundUpHalf(input.billableWeight);
  const basis = "weights" in input && input.weights.some((w) => w.basis === "dimensional") ? "dimensional" : "actual";
  const base = Math.max(rule.minimum, billable * rule.perLb);
  const lines: CostLine[] = [
    {
      kind: "shipping",
      label: billable * rule.perLb < rule.minimum ? `${service === "air" ? "Air" : "Ocean"} — minimum charge` : `${service === "air" ? "Air" : "Ocean"} — ${billable} lb × $${rule.perLb.toFixed(2)}`,
      amount: round2(base),
    },
  ];
  const sur = rule.zoneSurcharge[destination.zone];
  if (sur.flat || sur.perLb) {
    lines.push({ kind: "island_delivery", label: `Onward trip to ${destination.name}`, amount: round2(sur.flat + sur.perLb * billable) });
  }
  return {
    service,
    destinationName: destination.name,
    billableWeight: billable,
    basis,
    lines,
    total: round2(lines.reduce((s, l) => s + l.amount, 0)),
    transit: rule.transit,
    simulated: true,
  };
}

/** Convenience for the calculator: raw inputs → estimate. */
export function calculateShipping(
  args: { actualWeight: number; length?: number; width?: number; height?: number },
  destination: Destination,
  service: ServiceLevel,
) {
  const bw = calculateBillableWeight(args, service);
  return { ...calculateShippingCost({ weights: [bw] }, destination, service), actualWeight: bw.actual, dimensionalWeight: bw.dimensional };
}

export function isOversized(pkg: Dimensions & { actualWeight?: number }, service: ServiceLevel) {
  const rule = RATE_CARD[service];
  const longest = Math.max(pkg.length ?? 0, pkg.width ?? 0, pkg.height ?? 0);
  return longest > rule.maxLength || (pkg.actualWeight ?? 0) > rule.maxPieceWeight;
}

export const kgToLbs = (kg: number) => round2(kg * 2.20462);
export const fmtLb = (n?: number) => (n === undefined ? "—" : `${Number.isInteger(n) ? n : n.toFixed(1)} lb`);
export const fmtUsd = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD" });
