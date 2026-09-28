import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getCustomerInvoice } from "@/lib/api/invoices";
import { getSessionCustomerId } from "@/lib/auth";
import { INVOICE_RULES, PAYMENT_METHOD_LABEL, fmtDay, fmtUsd } from "@/lib/invoices";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your bill" };

export default async function BillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await getCustomerInvoice(await getSessionCustomerId(), id).catch(() => null);
  if (!inv) notFound();
  const owes = inv.balance > 0;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/account#bills" className="mb-4 inline-flex min-h-11 items-center gap-2 font-semibold text-sea-700 hover:underline">
        ← My Link
      </Link>
      <p className="text-lg font-semibold text-ink-mute">Your bill</p>
      <h1 className="flex flex-wrap items-center gap-3 text-3xl font-black tracking-tight sm:text-4xl">
        {inv.number} <InvoiceStatusBadge status={inv.status} size="lg" />
      </h1>

      <section className={`mt-6 rounded-[var(--radius-card)] p-6 sm:p-8 ${owes ? "bg-ink text-white" : "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-200"}`}>
        {owes ? (
          <>
            <p className="text-sm font-bold uppercase tracking-wider text-white/70">You need to pay</p>
            <p className="mt-1 text-5xl font-black text-sun-300">{fmtUsd(inv.balance)}</p>
            <p className="mt-2 text-lg text-white/80">
              {inv.status === "overdue" ? `This was due on ${fmtDay(inv.dueAt)}.` : `Please pay by ${fmtDay(inv.dueAt)}.`}
            </p>
          </>
        ) : inv.status === "void" ? (
          <p className="text-2xl font-black">This bill was cancelled. You don&apos;t need to pay it.</p>
        ) : (
          <p className="text-2xl font-black">✓ Paid. Thank you!</p>
        )}
      </section>

      <Card className="mt-5 p-6">
        <h2 className="text-xl font-extrabold">What you&apos;re paying for</h2>
        <ul className="mt-3 divide-y divide-sand-200 text-lg">
          {inv.lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-4 py-3">
              <span>{l.description}</span>
              <span className="shrink-0 tabular-nums">{fmtUsd(l.amount)}</span>
            </li>
          ))}
          <li className="flex justify-between gap-4 py-3 text-ink-soft">
            <span>VAT ({INVOICE_RULES.vatRate * 100}%, on our charges)</span>
            <span className="tabular-nums">{fmtUsd(inv.vat)}</span>
          </li>
          <li className="flex justify-between gap-4 py-3 text-xl font-black">
            <span>Total</span>
            <span className="tabular-nums">{fmtUsd(inv.total)}</span>
          </li>
        </ul>
        {inv.payments.length > 0 && (
          <div className="mt-2 rounded-2xl bg-emerald-50 p-4 text-emerald-900">
            {inv.payments.map((p) => (
              <p key={p.id}>
                ✓ You paid {fmtUsd(p.amount)} by {PAYMENT_METHOD_LABEL[p.method].toLowerCase()} on {fmtDay(p.at)}
              </p>
            ))}
          </div>
        )}
        <p className="mt-4 text-sm text-ink-mute">
          “Customs duty” is money we collect for the government. Demo amounts only.
        </p>
      </Card>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {owes && (
          <Button size="xl" variant="gold" full disabled title="Payments are turned off in this demo">
            💳 Pay now (demo — off)
          </Button>
        )}
        <ButtonLink href="/help" size="xl" variant={owes ? "secondary" : "primary"} full icon="💬">
          Questions? Ask The Link
        </ButtonLink>
      </div>
      {owes && <p className="mt-3 text-center text-ink-soft">You can also pay in person at any pickup center.</p>}
    </div>
  );
}
