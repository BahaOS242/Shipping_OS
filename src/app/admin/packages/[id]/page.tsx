import Link from "next/link";
import { notFound } from "next/navigation";
import { StaffActions } from "@/components/admin/StaffActions";
import { StatusBadge } from "@/components/packages/StatusBadge";
import { staff } from "@/lib/api/link-api";
import { ISLANDS, fmtLbs } from "@/lib/pricing";
import { STATUS } from "@/lib/status";

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function AdminPackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await staff.getPackage(id).catch(() => null);
  if (!p) notFound();
  const tickets = (await staff.listTickets()).filter((t) => t.customerId === p.customerId);

  const suggestion = p.needsAttention
    ? `Hi ${p.customer.firstName}, this is Shanice from The Link. About your ${p.merchant} package (${p.itemName}): ${p.needsAttention} I'm handling it personally and will update you today.`
    : `Hi ${p.customer.firstName}, this is Shanice from The Link. Your ${p.merchant} package (${p.itemName}) — ${STATUS[p.status].title.toLowerCase()}. ${STATUS[p.status].next} Anything else I can help with?`;

  const facts = [
    { k: "Customer", v: `${p.customer.firstName} ${p.customer.lastName}`, sub: `${p.customer.accountNumber} · ${p.customer.type === "business" ? p.customer.businessName : "Personal"}` },
    { k: "Package", v: `${p.merchant} — ${p.itemName}`, sub: p.inboundTracking ? `Store tracking ${p.inboundTracking}` : p.id.toUpperCase() },
    { k: "Weight", v: fmtLbs(p.weight), sub: p.declaredValue ? `Value $${p.declaredValue.toFixed(2)}` : undefined },
    { k: "Destination", v: ISLANDS[p.destination].name, sub: p.mode === "air" ? "✈️ Air" : "🚢 Sea" },
    { k: "Trip", v: p.shipment?.label ?? "Not assigned yet", sub: p.shipment ? `Arrives ${when(p.shipment.arrivesAt)}` : undefined },
    { k: "Phone", v: p.customer.phone, sub: "WhatsApp" },
  ];

  return (
    <div className="space-y-6">
      <Link href="/admin" className="inline-flex min-h-11 items-center gap-2 font-semibold text-sea-700 hover:underline">
        ← Dashboard
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-ink-mute">Package {p.id.toUpperCase()}</p>
          <h1 className="text-3xl font-black tracking-tight">
            {p.merchant} · {p.itemName}
          </h1>
        </div>
        <StatusBadge status={p.status} size="lg" />
      </div>

      {p.needsAttention && (
        <div className="rounded-2xl bg-coral-50 p-4 font-bold text-coral-700 ring-1 ring-coral-100">⚑ Needs attention: {p.needsAttention}</div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          <section className="grid grid-cols-2 gap-3">
            {facts.map((f) => (
              <div key={f.k} className="rounded-2xl bg-white p-4 ring-1 ring-[#e3e7ec]">
                <p className="text-sm font-semibold text-ink-mute">{f.k}</p>
                <p className="mt-0.5 font-bold">{f.v}</p>
                {f.sub && <p className="text-sm text-ink-soft">{f.sub}</p>}
              </div>
            ))}
          </section>

          <section className="rounded-2xl bg-white p-5 ring-1 ring-[#e3e7ec]">
            <h2 className="text-lg font-extrabold">Timeline</h2>
            <ol className="mt-4 space-y-4 border-l-2 border-[#e3e7ec] pl-5">
              {[...p.history].reverse().map((e, i) => (
                <li key={i} className="relative">
                  <span aria-hidden className={`absolute -left-[27px] top-1 h-3 w-3 rounded-full ${i === 0 ? "bg-sun-400 ring-4 ring-sun-100" : "bg-sea-500"}`} />
                  <p className="font-bold">
                    {STATUS[e.status].icon} {STATUS[e.status].title}
                  </p>
                  <p className="text-ink-soft">{e.note}</p>
                  <p className="text-sm text-ink-mute">{when(e.at)}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="rounded-2xl bg-white p-5 ring-1 ring-[#e3e7ec]">
            <h2 className="text-lg font-extrabold">Notes</h2>
            <p className="text-sm text-ink-mute">Internal — never shown to the customer or the AI.</p>
            <ul className="mt-3 space-y-1">
              {(p.staffNotes ?? ["No notes yet."]).map((n) => (
                <li key={n} className="rounded-lg bg-sun-50 px-3 py-2">📝 {n}</li>
              ))}
            </ul>
          </section>
        </div>

        <StaffActions packageId={p.id} customerId={p.customerId} customerFirstName={p.customer.firstName} suggestion={suggestion} tickets={tickets} />
      </div>
    </div>
  );
}
