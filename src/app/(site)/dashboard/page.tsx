"use client";

import Link from "next/link";
import { ShoppingAddressCard } from "@/components/account/ShoppingAddressCard";
import { BigStat } from "@/components/customer/DashboardCards";
import { CustomerView } from "@/components/customer/CustomerView";
import { Money } from "@/components/customer/Money";
import { Activity } from "@/components/domain/Activity";
import { MerchantMark } from "@/components/domain/MerchantMark";
import { PackageCard } from "@/components/domain/PackageCard";
import { ShipmentPill } from "@/components/domain/Status";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Section } from "@/components/ui/Section";
import { customerPrice } from "@/domain/billing";
import { fmtUsd } from "@/domain/rates";
import type { Customer } from "@/domain/types";
import * as svc from "@/services";
import { useAction } from "@/components/ui/Toast";

export default function DashboardPage() {
  return <CustomerView title="My Link">{(me) => (me.type === "business" ? <BusinessDashboard me={me} /> : <PersonalDashboard me={me} />)}</CustomerView>;
}

function PersonalDashboard({ me }: { me: Customer }) {
  const pkgs = svc.listPackages({ customerId: me.id });
  const active = pkgs.filter((p) => p.status !== "delivered");
  const shipments = svc.listShipments({ customerId: me.id }).filter((s) => s.status !== "completed");
  const bal = svc.customerBalance(me.id);
  const actions = svc.customerActions(me.id);
  const candidates = svc.consolidationCandidates(me.id);

  return (
    <div className="space-y-8">
      <header className="animate-rise">
        <p className="text-lg font-semibold text-sea-700">Hi {me.firstName} 👋</p>
        <h1 className="text-4xl font-black tracking-tight sm:text-5xl">Here&apos;s everything in one place.</h1>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BigStat href="/packages" icon="📦" label="My Packages" value={active.length} sub={`${pkgs.length - active.length} delivered`} />
        <BigStat href="/shipments" icon="🚢" label="My Shipments" value={shipments.length} sub="on the way or getting ready" />
        <BigStat href="/payments" icon="💰" label="My Balance" value={fmtUsd(bal.balance)} sub={bal.overdue ? `${fmtUsd(bal.overdue)} overdue` : bal.balance ? "Demo payments only" : "All paid up ✓"} tone="money" />
        <BigStat href="#action-needed" icon="⚠️" label="Action Needed" value={actions.length} sub={actions.length ? "Tap to see" : "Nothing to do 🎉"} tone={actions.length ? "alert" : "default"} />
      </div>

      {actions.length > 0 && (
        <section id="action-needed" aria-labelledby="an" className="scroll-mt-28">
          <h2 id="an" className="mb-3 text-2xl font-extrabold">What to do next</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {actions.map((a) => (
              <li key={a.id}>
                <Link href={a.href} className={`flex items-center gap-4 rounded-2xl bg-white p-4 ring-2 transition hover:-translate-y-0.5 ${a.urgency === 3 ? "ring-coral-100" : "ring-sun-300/60"}`}>
                  <span aria-hidden className="text-3xl">{a.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg font-extrabold">{a.title}</span>
                    <span className="block text-ink-soft">{a.body}</span>
                  </span>
                  <span className="shrink-0 rounded-xl bg-ink px-3 py-2 text-sm font-bold text-white">{a.cta}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {candidates.length >= 2 && (
        <section className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-sea-700 p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-sun-300">💡 Save money</p>
            <h2 className="mt-1 text-2xl font-extrabold">Put my packages together</h2>
            <p className="text-sea-100">You have {candidates.length} packages at our warehouse. Send them as one shipment.</p>
          </div>
          <ButtonLink href="/packages/together" variant="gold" icon="📦" className="shrink-0">Put These Together</ButtonLink>
        </section>
      )}

      <section aria-labelledby="pk">
        <div className="mb-3 flex items-end justify-between">
          <h2 id="pk" className="text-2xl font-extrabold">My Packages</h2>
          <Link href="/packages/new" className="font-bold text-sea-700">+ Tell us a package is coming</Link>
        </div>
        {active.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{active.map((p) => <PackageCard key={p.id} pkg={p} />)}</div>
        ) : (
          <EmptyState icon="📭" title="No packages on the move" action={<ButtonLink href="/profile">Get my U.S. address</ButtonLink>}>Shop at any U.S. store using your The Link address.</EmptyState>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <Section title="Latest updates" action={<Link href="/notifications" className="text-sm font-bold text-sea-700">All notifications →</Link>}>
          <Activity events={svc.timeline({ customerId: me.id }, { customerView: true }).slice(-8)} customer />
        </Section>
        <ShoppingAddressCard address={svc.shoppingAddress(me)} compact />
      </div>
    </div>
  );
}

function BusinessDashboard({ me }: { me: Customer }) {
  const run = useAction();
  const pkgs = svc.listPackages({ customerId: me.id });
  const ships = svc.listShipments({ customerId: me.id });
  const bal = svc.customerBalance(me.id);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const thisMonth = svc.listBills({ customerId: me.id }).filter((b) => b.lifecycle === "issued" && new Date(b.issuedAt!).getTime() >= monthStart).reduce((a, b) => a + b.total, 0);
  const suppliers = [...new Set(pkgs.map((p) => p.merchant))];
  const procurements = svc.listProcurements(me.id);
  const actions = svc.customerActions(me.id);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-sea-700">🏢 Business account · {me.accountNumber}</p>
          <h1 className="text-4xl font-black tracking-tight">{me.businessName}</h1>
          <p className="text-lg text-ink-soft">Your logistics team, without hiring one.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/packages/together" size="md" icon="➕">New Shipment</ButtonLink>
          <ButtonLink href="/invoices" size="md" variant="secondary" icon="🧾">Upload Invoice</ButtonLink>
          <ButtonLink href="/shipments" size="md" variant="secondary" icon="🚢">Track Cargo</ButtonLink>
          <ButtonLink href="/payments" size="md" variant="secondary" icon="📑">View Statements</ButtonLink>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <BigStat href="/shipments" icon="📂" label="Open shipments" value={ships.filter((s) => s.status !== "completed").length} />
        <BigStat href="/shipments" icon="🚢" label="In transit" value={ships.filter((s) => s.status === "departed").length} />
        <BigStat href="/packages" icon="🏭" label="Received (at warehouse)" value={pkgs.filter((p) => p.status === "received").length} />
        <BigStat href="/payments" icon="📅" label="This month" value={fmtUsd(thisMonth)} sub={`Balance ${fmtUsd(bal.balance)}`} tone="money" />
      </div>

      {actions.length > 0 && (
        <Section title={`Needs your attention (${actions.length})`}>
          <ul className="divide-y divide-[#eef1f4]">
            {actions.map((a) => (
              <li key={a.id}><Link href={a.href} className="flex items-center justify-between gap-3 py-3"><span><span aria-hidden>{a.icon}</span> <strong>{a.title}</strong> <span className="text-ink-soft">— {a.body}</span></span><span className="shrink-0 font-bold text-sea-700">{a.cta} →</span></Link></li>
            ))}
          </ul>
        </Section>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Cargo" action={<Link href="/shipments" className="text-sm font-bold text-sea-700">All shipments →</Link>} pad={false}>
          <ul className="divide-y divide-[#eef1f4]">
            {ships.slice(0, 6).map((s) => (
              <li key={s.id}>
                <Link href={`/shipments/${s.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[#f7f9fa]">
                  <span><span className="font-bold">{s.id}</span> <span className="text-ink-soft">· {s.packageIds.length} pcs · {s.service === "ocean" ? "🚢 Ocean" : "✈️ Air"}</span></span>
                  <ShipmentPill status={s.status} />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
        <Section title="Suppliers">
          <ul className="grid grid-cols-2 gap-3">
            {suppliers.map((m) => (
              <li key={m} className="flex items-center gap-3 rounded-xl bg-[#f7f9fa] p-3">
                <MerchantMark merchant={m} size="sm" />
                <span><span className="block font-bold">{m}</span><span className="text-xs text-ink-mute">{pkgs.filter((p) => p.merchant === m).length} shipments received</span></span>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section title="🛒 Buy for me (procurement)" id="buy-for-me" action={<Link href="/buy-for-me" className="text-sm font-bold text-sea-700">+ New request</Link>}>
        {procurements.length === 0 ? (
          <p className="text-ink-soft">Tell us what you need — we find it, buy it, ship it and deliver it. <Link href="/buy-for-me" className="font-bold text-sea-700 underline">Start a request</Link></p>
        ) : (
          <ul className="space-y-3">
            {procurements.map((p) => {
              const price = p.costs ? customerPrice(p.costs, p.marginRate) : undefined;
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f7f9fa] p-4">
                  <span>
                    <span className="block font-bold">{p.product ?? p.request}</span>
                    <span className="text-sm text-ink-soft">{p.id} · {p.supplier ?? "Finding a supplier"} · status: <strong>{svc.syncProcurementStatus(p)}</strong></span>
                  </span>
                  {price && <span className="text-right"><span className="block text-xs text-ink-mute">All-in price (demo)</span><Money n={price.price} className="text-xl font-black" /></span>}
                  {p.status === "quoted" && <button onClick={() => run(() => svc.approveProcurement(svc.currentActor(), p.id), "Approved — we'll buy it for you.")} className="min-h-11 rounded-xl bg-sea-600 px-4 font-bold text-white">Approve price</button>}
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Recent activity"><Activity events={svc.timeline({ customerId: me.id }, { customerView: true }).slice(-10)} customer /></Section>
    </div>
  );
}
