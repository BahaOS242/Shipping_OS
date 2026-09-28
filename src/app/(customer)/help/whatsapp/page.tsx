import type { Metadata } from "next";
import { WhatsAppDemo } from "@/components/chat/WhatsAppDemo";
import { DemoBadge } from "@/components/ui/DemoBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { getCustomer } from "@/lib/api/link-api";
import { getSessionCustomerId } from "@/lib/auth";

export const metadata: Metadata = { title: "Chat on WhatsApp" };

export default async function WhatsAppPage() {
  const customer = await getCustomer(await getSessionCustomerId());
  return (
    <>
      <PageHeader
        back={{ href: "/help", label: "Help" }}
        eyebrow={<DemoBadge>Simulated WhatsApp</DemoBadge>}
        title="Chat on WhatsApp"
        sub="Ask anything. We answer in seconds — and a person can jump in anytime."
      />
      <WhatsAppDemo customerId={customer.id} phone={customer.phone} name={`${customer.firstName} ${customer.lastName}`} />
    </>
  );
}
