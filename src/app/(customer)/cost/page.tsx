import type { Metadata } from "next";
import { ShippingCalculator } from "@/components/shipping/ShippingCalculator";
import { PageHeader } from "@/components/ui/PageHeader";
import { ISLANDS } from "@/lib/pricing";
import type { IslandId, ShippingMode } from "@/lib/types";

export const metadata: Metadata = { title: "How much will it cost?" };

export default async function CostPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const to = sp.to && sp.to in ISLANDS ? (sp.to as IslandId) : undefined;
  const weight = sp.weight ? Number(sp.weight) || undefined : undefined;
  const mode = sp.mode === "air" || sp.mode === "sea" ? (sp.mode as ShippingMode) : undefined;
  return (
    <>
      <PageHeader title="How much will it cost?" sub="Three quick questions. No sign-up needed." />
      <ShippingCalculator initial={{ to, weight, mode }} />
    </>
  );
}
