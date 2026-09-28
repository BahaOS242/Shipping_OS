import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceDetail } from "@/components/invoices/InvoiceDetail";
import { getInvoice } from "@/lib/api/invoices";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Invoice" };

export default async function AdminInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await getInvoice(id).catch(() => null);
  if (!inv) notFound();
  return (
    <div className="space-y-4">
      <Link href="/admin/invoices" className="inline-flex min-h-11 items-center gap-2 font-semibold text-sea-700 hover:underline print:hidden">
        ← Invoices
      </Link>
      <InvoiceDetail key={inv.id} initial={inv} />
    </div>
  );
}
