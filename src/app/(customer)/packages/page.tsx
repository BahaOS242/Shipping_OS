import type { Metadata } from "next";
import { PackagesView } from "@/components/packages/PackagesView";
import { ButtonLink } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { getPackages } from "@/lib/api/link-api";
import { getSessionCustomerId } from "@/lib/auth";

export const metadata: Metadata = { title: "My Packages" };

export default async function PackagesPage() {
  const packages = await getPackages(await getSessionCustomerId());
  return (
    <>
      <PageHeader title="My Packages" sub="Here's where your stuff is." />
      <PackagesView packages={packages} />
      <div className="mt-10 grid gap-3 sm:grid-cols-2">
        <ButtonLink href="/help" variant="secondary" icon="💬">
          Ask about a package
        </ButtonLink>
        <ButtonLink href="/cost" variant="secondary" icon="💰">
          How much will it cost?
        </ButtonLink>
      </div>
    </>
  );
}
