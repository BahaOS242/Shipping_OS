"use client";

import { useLive } from "@/data/useLive";
import Link from "next/link";
import { useState } from "react";
import { OpsPage } from "@/components/ops/OpsPage";
import { Input } from "@/components/ui/Field";
import { Pill } from "@/components/ui/Pill";
import { Section } from "@/components/ui/Section";
import { Ago } from "@/components/ui/Time";
import { fmtUsd } from "@/domain/rates";
import * as svc from "@/services";

export default function CustomersPage() {
  useLive();
  const [q, setQ] = useState("");
  const list = svc.listCustomers().filter((c) => !q || [svc.customerName(c), c.accountNumber, c.phone, c.email].join(" ").toLowerCase().includes(q.toLowerCase()));
  return (
    <OpsPage title="Customers" sub={`${svc.listCustomers().length} customers · DEMO DATA`}>
      <label htmlFor="cq" className="sr-only">Filter customers</label>
      <Input id="cq" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by name, account, phone…" className="max-w-md" />
      <Section pad={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-ink-mute"><tr><th className="px-5 py-3">Customer</th><th className="px-3 py-3">Island</th><th className="px-3 py-3 text-right">Packages</th><th className="px-3 py-3 text-right">Balance</th><th className="px-3 py-3">Open issues</th><th className="px-5 py-3">Last activity</th></tr></thead>
            <tbody className="divide-y divide-[#eef1f4]">
              {list.map((c) => {
                const st = svc.customerStats(c.id);
                return (
                  <tr key={c.id} className="relative hover:bg-[#f7f9fa]">
                    <td className="px-5 py-3"><Link href={`/customers/${c.id}`} className="font-bold after:absolute after:inset-0">{svc.customerName(c)}</Link><span className="block text-xs text-ink-mute">{c.accountNumber}{c.type === "business" ? " · 🏢 Business" : ""}</span></td>
                    <td className="px-3 py-3">{svc.getDestination(c.homeDestination).name}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{st.activePackages} / {st.packages}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{st.balance ? <strong>{fmtUsd(st.balance)}</strong> : "—"}</td>
                    <td className="px-3 py-3">{st.openIssues ? <Pill tone="bad" icon="⚠">{st.openIssues}</Pill> : "—"}</td>
                    <td className="px-5 py-3 text-ink-soft"><Ago iso={st.lastActivity} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>
    </OpsPage>
  );
}
