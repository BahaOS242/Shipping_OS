import { INVOICE_STATUS, type InvoiceDisplayStatus } from "@/lib/invoices";

/** Icon + word, never color alone. */
export function InvoiceStatusBadge({ status, daysLate, size = "md" }: { status: InvoiceDisplayStatus; daysLate?: number; size?: "md" | "lg" }) {
  const s = INVOICE_STATUS[status];
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full font-bold ring-1 ${s.cls} ${size === "lg" ? "px-4 py-1.5 text-base" : "px-2.5 py-0.5 text-xs"}`}>
      <span aria-hidden>{s.icon}</span>
      {s.label}
      {status === "overdue" && daysLate ? <span className="font-semibold">· {daysLate}d</span> : null}
    </span>
  );
}
