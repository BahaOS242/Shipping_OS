"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ChatAssistant } from "@/components/chat/ChatAssistant";
import { CustomerView } from "@/components/customer/CustomerView";
import { ButtonLink } from "@/components/ui/Button";
import * as svc from "@/services";

export default function AssistantPage() {
  return <Suspense><Inner /></Suspense>;
}

function Inner() {
  const sp = useSearchParams();
  const pkgId = sp.get("package");
  return (
    <CustomerView title="Shipping OS Assistant">
      {(me) => {
        const p = pkgId ? svc.findPackage(pkgId) : undefined;
        return (
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
            <div>
              <h1 className="mb-4 text-4xl font-black tracking-tight">Shipping OS Assistant</h1>
              <ChatAssistant key={p?.id ?? "a"} tall customerId={me.id} autoAsk={p && p.customerId === me.id ? { id: `package:${p.id}`, label: `Where is my ${p.merchant} package?` } : undefined} />
            </div>
            <aside className="space-y-4 lg:pt-14">
              <div className="rounded-[var(--radius-card)] bg-white p-6 ring-1 ring-sand-200">
                <h2 className="text-xl font-extrabold">What it can do</h2>
                <ul className="mt-3 space-y-2 text-ink-soft">
                  <li>📦 Find your packages and shipments</li>
                  <li>💰 Estimate costs with the real rate rules (demo prices)</li>
                  <li>🧾 Tell you your balance and bills</li>
                  <li>🚚 Check delivery and pickup</li>
                  <li>🙋 Hand you to a real person</li>
                </ul>
              </div>
              <div className="rounded-[var(--radius-card)] bg-ink p-6 text-white">
                <h2 className="text-xl font-extrabold">What it can&apos;t do</h2>
                <p className="mt-2 text-white/80">It never makes up statuses, prices or balances — every answer comes from Shipping OS&apos;s records through safe, read-only tools. It can&apos;t take payments, give refunds or approve customs. Only people can.</p>
              </div>
              <ButtonLink href="/whatsapp-demo" variant="whatsapp" full icon="💬">Try it on WhatsApp</ButtonLink>
            </aside>
          </div>
        );
      }}
    </CustomerView>
  );
}
