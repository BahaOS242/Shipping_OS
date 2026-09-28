"use server";

import { createQuote } from "@/lib/api/link-api";
import { getSessionCustomerId } from "@/lib/auth";
import { ISLANDS } from "@/lib/pricing";
import type { IslandId, ShippingMode } from "@/lib/types";

/** Web → Link API directly (no AI involved). DEMO: saves to in-memory store. */
export async function createQuoteAction(input: { destination: IslandId; weight: number; mode: ShippingMode }) {
  if (!(input.destination in ISLANDS) || !(input.weight > 0) || !["air", "sea"].includes(input.mode)) {
    throw new Error("Invalid quote");
  }
  const quote = await createQuote({ ...input, customerId: await getSessionCustomerId() });
  return { id: quote.id, total: quote.total, transitDays: quote.transitDays };
}
