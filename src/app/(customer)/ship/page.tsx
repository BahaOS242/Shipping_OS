import type { Metadata } from "next";
import { ShipWizard } from "@/components/shipping/ShipWizard";
import { getShoppingAddress } from "@/lib/api/link-api";
import { getSessionCustomerId } from "@/lib/auth";
import { ISLANDS } from "@/lib/pricing";
import type { IslandId } from "@/lib/types";

export const metadata: Metadata = { title: "Ship Something" };

export default async function ShipPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const to = sp.to && sp.to in ISLANDS ? (sp.to as IslandId) : undefined;
  const weight = sp.weight ? Number(sp.weight) || undefined : undefined;
  const address = await getShoppingAddress(await getSessionCustomerId());
  return <ShipWizard address={address} initial={{ to, weight }} />;
}
