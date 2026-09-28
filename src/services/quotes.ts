/** QUOTES — saved shipping estimates (DEMO pricing from the rates engine). */
import { nowIso } from "@/data/clock";
import { db, mutate, nextSeq } from "@/data/store";
import { calculateShipping } from "@/domain/rates";
import type { Actor, DestinationId, Quote, ServiceLevel } from "@/domain/types";
import { BusinessError } from "./_shared";
import { getDestination } from "./locations";

export function estimate(input: { destinationId: DestinationId; service: ServiceLevel; actualWeight: number; length?: number; width?: number; height?: number }) {
  if (!(input.actualWeight > 0)) throw new BusinessError("Enter a weight above 0.");
  return calculateShipping(input, getDestination(input.destinationId), input.service);
}

export function createQuote(actor: Actor, input: Parameters<typeof estimate>[0]) {
  const e = estimate(input);
  return mutate((s) => {
    const q: Quote = { id: `Q-${nextSeq("q", 500)}`, customerId: actor.customerId, destinationId: input.destinationId, service: input.service, actualWeight: input.actualWeight, billableWeight: e.billableWeight, total: e.total, createdAt: nowIso() };
    s.quotes.push(q);
    return { quote: q, estimate: e };
  });
}

export const listQuotes = (customerId: string) => db().quotes.filter((q) => q.customerId === customerId);
