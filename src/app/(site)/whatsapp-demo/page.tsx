"use client";

import { WhatsAppDemo } from "@/components/chat/WhatsAppDemo";
import { CustomerView } from "@/components/customer/CustomerView";
import { DemoBadge } from "@/components/ui/DemoBadge";

export default function WhatsAppPage() {
  return (
    <CustomerView title="WhatsApp demo">
      {(me) => (
        <div className="space-y-6">
          <header>
            <DemoBadge>Simulated WhatsApp</DemoBadge>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Chat on WhatsApp</h1>
            <p className="mt-1 text-xl text-ink-soft">Ask anything. Package updates arrive here automatically.</p>
          </header>
          <WhatsAppDemo me={me} />
        </div>
      )}
    </CustomerView>
  );
}
