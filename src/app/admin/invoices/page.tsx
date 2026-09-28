import type { Metadata } from "next";
import Link from "next/link";
import { InvoiceStatusBadge } from "@/components/invoices/InvoiceStatusBadge";
import { invoiceSummary, listInvoices, type InvoiceFilter, type InvoiceSort } from "@/lib/api/invoices";
import { AGING_LABEL, fmtDay, fmtUsd, type AgingBucket } from "@/lib/invoices";
import { ISLANDS } from "@/lib/pricing";
import type { IslandId } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invoices" };

const TABS: { key: InvoiceFilter; label: string }[] = [
  { key: "open", label: "Needs payment" },
  { key: "overdue", label: "Overdue" },
  { key: "part_paid", label: "Part paid" },
  { key: "unpaid", label: "Unpaid" },
  { key: "draft", label: "Drafts" },
  { key: "paid", label: "Paid" },
  { key: "void", label: "Void" },
  { key: "all", label: "All" },
];

const SORTS: { key: InvoiceSort; label: string }[] = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "most_late", label: "Most late first" },
  { key: "balance", label: "Biggest balance" },
];

const AGING_COLOR: Record<AgingBucket, string> = {
  not_due: "bg-sea-400",
  "1_30": "bg-sun-400",
  "31_60": "bg-coral-500/70",
  "61_plus": "bg-coral-700",
};

type SP = { status?: string; q?: string; island?: string; sort?: string };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const status = (TABS.some((t) => t.key === sp.status) ? sp.status : "open") as InvoiceFilter;
  const sort = (SORTS.some((s) => s.key === sp.sort) ? sp.sort : status === "overdue" || status === "open" ? "most_late" : "newest") as InvoiceSort;
  const island = sp.island && sp.island in ISLANDS ? (sp.island as IslandId) : undefined;
  const [rows, summary] = await Promise.all([listInvoices({ status, q: sp.q, island, sort }), invoiceSummary()]);

  const href = (patch: Partial<SP>) => {
    const next = new URLSearchParams(Object.entries({ status, q: sp.q, island, sort: sp.sort, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/admin/invoices?${next}`;
  };
  const agingTotal = Object.values(summary.aging).reduce((s, a) => s + a.amount, 0) || 1;
  const pageTotal = rows.reduce((s, r) => s + r.balance, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-ink-mute">Billing</p>
          <h1 className="text-3xl font-black tracking-tight">Invoices</h1>
        </div>
        <div className="flex gap-2">
          <a href={`/api/invoices/export?status=${status}${sp.q ? `&q=${encodeURIComponent(sp.q)}` : ""}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 font-bold ring-1 ring-[#e3e7ec] hover:ring-sea-400">
            ⬇ Export CSV
          </a>
          <Link href="/admin/invoices/new" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sea-600 px-4 font-bold text-white hover:bg-sea-700">
            + New invoice
          </Link>
        </div>
      </div>

      {/* Money at a glance */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Waiting to be paid", value: fmtUsd(summary.outstanding), sub: `${summary.counts.open} invoices`, icon: "💵" },
          { label: "Overdue", value: fmtUsd(summary.overdue), sub: `${summary.counts.overdue} invoices`, icon: "⚑", alert: true },
          { label: "Collected (30 days)", value: fmtUsd(summary.collectedLast30Days), sub: "All payment methods", icon: "✓" },
          { label: "Drafts to send", value: String(summary.counts.draft), sub: "Not sent to customers yet", icon: "✎" },
        ].map((t) => (
          <div key={t.label} className={`rounded-2xl p-5 ring-1 ${t.alert ? "bg-coral-50 ring-coral-100" : "bg-white ring-[#e3e7ec]"}`}>
            <p className="flex items-center gap-2 text-sm font-bold text-ink-soft">
              <span aria-hidden>{t.icon}</span> {t.label}
            </p>
            <p className={`mt-2 text-2xl font-black tabular-nums sm:text-3xl ${t.alert ? "text-coral-700" : ""}`}>{t.value}</p>
            <p className="text-sm text-ink-mute">{t.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0 space-y-4">
          {/* Aging */}
          <section className="rounded-2xl bg-white p-5 ring-1 ring-[#e3e7ec]">
            <h2 className="font-extrabold">How late is the money?</h2>
            <div className="mt-3 flex h-4 overflow-hidden rounded-full bg-[#eef1f4]" aria-hidden>
              {(Object.keys(summary.aging) as AgingBucket[]).map((b) => (
                <span key={b} className={AGING_COLOR[b]} style={{ width: `${(summary.aging[b].amount / agingTotal) * 100}%` }} />
              ))}
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              {(Object.keys(summary.aging) as AgingBucket[]).map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span aria-hidden className={`mt-1 h-3 w-3 shrink-0 rounded-sm ${AGING_COLOR[b]}`} />
                  <span>
                    <span className="block font-semibold text-ink-soft">{AGING_LABEL[b]}</span>
                    <span className="font-bold tabular-nums">{fmtUsd(summary.aging[b].amount)}</span>
                    <span className="text-ink-mute"> · {summary.aging[b].count}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {/* Filters */}
          <nav aria-label="Filter by status" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
            {TABS.map((t) => {
              const active = t.key === status;
              return (
                <Link
                  key={t.key}
                  href={href({ status: t.key, sort: undefined })}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-bold ring-1 ${
                    active ? "bg-ink text-white ring-ink" : "bg-white text-ink-soft ring-[#e3e7ec] hover:ring-sea-400"
                  }`}
                >
                  {t.label}
                  <span className={`rounded-full px-1.5 text-xs ${active ? "bg-white/20" : "bg-[#eef1f4]"}`}>{summary.counts[t.key]}</span>
                </Link>
              );
            })}
          </nav>

          <form className="flex flex-wrap gap-2" action="/admin/invoices">
            <input type="hidden" name="status" value={status} />
            <label htmlFor="q" className="sr-only">Search</label>
            <input id="q" name="q" defaultValue={sp.q} placeholder="Search invoice #, name or account" className="min-h-11 min-w-0 flex-1 basis-56 rounded-xl bg-white px-3 ring-1 ring-[#e3e7ec] focus:outline-none focus:ring-2 focus:ring-sea-500" />
            <label htmlFor="island" className="sr-only">Island</label>
            <select id="island" name="island" defaultValue={island ?? ""} className="min-h-11 rounded-xl bg-white px-3 ring-1 ring-[#e3e7ec]">
              <option value="">All islands</option>
              {Object.values(ISLANDS).map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
            <label htmlFor="sort" className="sr-only">Sort</label>
            <select id="sort" name="sort" defaultValue={sort} className="min-h-11 rounded-xl bg-white px-3 ring-1 ring-[#e3e7ec]">
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
            <button className="min-h-11 rounded-xl bg-ink px-4 font-bold text-white">Apply</button>
          </form>

          {/* List */}
          <section className="rounded-2xl bg-white ring-1 ring-[#e3e7ec]">
            <div className="flex items-center justify-between border-b border-[#e3e7ec] px-5 py-3 text-sm text-ink-soft">
              <span>
                <strong className="text-ink">{rows.length}</strong> invoice{rows.length === 1 ? "" : "s"}
              </span>
              {pageTotal > 0 && (
                <span>
                  Balance due <strong className="tabular-nums text-ink">{fmtUsd(pageTotal)}</strong>
                </span>
              )}
            </div>
            {rows.length === 0 ? (
              <p className="px-5 py-10 text-center text-ink-mute">No invoices match. Try another filter.</p>
            ) : (
              <>
                <table className="hidden w-full text-left md:table">
                  <thead className="text-sm text-ink-mute">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Invoice</th>
                      <th className="px-3 py-3 font-semibold">Customer</th>
                      <th className="px-3 py-3 font-semibold">Due</th>
                      <th className="px-3 py-3 text-right font-semibold">Total</th>
                      <th className="px-3 py-3 text-right font-semibold">Balance</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#eef1f4]">
                    {rows.map((r) => (
                      <tr key={r.id} className="relative hover:bg-[#f7f9fa]">
                        <td className="px-5 py-3">
                          <Link href={`/admin/invoices/${r.id}`} className="font-bold after:absolute after:inset-0">
                            {r.number}
                          </Link>
                          <span className="block text-xs text-ink-mute">{ISLANDS[r.destination].name}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-semibold">{r.customer.businessName ?? `${r.customer.firstName} ${r.customer.lastName}`}</span>
                          <span className="block text-xs text-ink-mute">{r.customer.accountNumber}</span>
                        </td>
                        <td className="px-3 py-3 text-sm">{fmtDay(r.dueAt)}</td>
                        <td className="px-3 py-3 text-right tabular-nums">{fmtUsd(r.total)}</td>
                        <td className="px-3 py-3 text-right font-bold tabular-nums">{r.balance > 0 ? fmtUsd(r.balance) : "—"}</td>
                        <td className="px-5 py-3">
                          <InvoiceStatusBadge status={r.status} daysLate={r.daysLate} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <ul className="divide-y divide-[#eef1f4] md:hidden">
                  {rows.map((r) => (
                    <li key={r.id}>
                      <Link href={`/admin/invoices/${r.id}`} className="block px-5 py-3.5">
                        <span className="flex items-center justify-between gap-3">
                          <span className="font-bold">{r.number}</span>
                          <InvoiceStatusBadge status={r.status} daysLate={r.daysLate} />
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-ink-soft">{r.customer.businessName ?? `${r.customer.firstName} ${r.customer.lastName}`}</span>
                          <span className="shrink-0 font-bold tabular-nums">{r.balance > 0 ? `${fmtUsd(r.balance)} due` : fmtUsd(r.total)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>

        <aside className="min-w-0 space-y-4">
          <section className="rounded-2xl bg-white ring-1 ring-[#e3e7ec]">
            <h2 className="border-b border-[#e3e7ec] px-5 py-3 font-extrabold">Who owes the most</h2>
            <ul className="divide-y divide-[#eef1f4]">
              {summary.topBalances.map((t) => (
                <li key={t.customerId}>
                  <Link href={`/admin/invoices?status=open&q=${encodeURIComponent(t.name.replace(" (demo)", ""))}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-[#f7f9fa]">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{t.name}</span>
                      <span className="text-xs text-ink-mute">{t.count} open</span>
                    </span>
                    <span className="font-bold tabular-nums">{fmtUsd(t.amount)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <p className="px-1 text-sm text-ink-mute">
            Demo amounts. VAT 10% on The Link&apos;s charges; customs duty is a placeholder rate. No real payments are taken.
          </p>
        </aside>
      </div>
    </div>
  );
}
