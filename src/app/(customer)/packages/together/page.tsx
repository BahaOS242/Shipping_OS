import type { Metadata } from "next";
import Link from "next/link";
import { ConsolidateFlow } from "@/components/packages/ConsolidateFlow";
import { ButtonLink } from "@/components/ui/Button";
import { getConsolidationCandidates } from "@/lib/api/link-api";
import { getSessionCustomerId } from "@/lib/auth";

export const metadata: Metadata = { title: "Put my packages together" };

export default async function TogetherPage() {
  const packages = await getConsolidationCandidates(await getSessionCustomerId());
  return (
    <>
      <Link href="/packages" className="mb-4 inline-flex min-h-11 items-center gap-2 font-semibold text-sea-700 hover:underline">
        <span aria-hidden>←</span> My Packages
      </Link>
      {packages.length >= 2 ? (
        <ConsolidateFlow packages={packages} />
      ) : (
        <div className="mx-auto max-w-lg py-10 text-center">
          <h1 className="text-3xl font-black">You need 2 or more packages at our warehouse</h1>
          <ButtonLink href="/packages" className="mt-6">Back to My Packages</ButtonLink>
        </div>
      )}
    </>
  );
}
