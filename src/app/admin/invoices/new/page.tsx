import type { Metadata } from "next";
import Link from "next/link";
import { NewInvoiceForm } from "@/components/invoices/NewInvoiceForm";
import { staff } from "@/lib/api/link-api";
import { uninvoicedPackages } from "@/lib/api/invoices";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage() {
  const [customers, packages] = await Promise.all([staff.listCustomers(), uninvoicedPackages()]);
  return (
    <div className="space-y-4">
      <Link href="/admin/invoices" className="inline-flex min-h-11 items-center gap-2 font-semibold text-sea-700 hover:underline">
        ← Invoices
      </Link>
      <h1 className="text-3xl font-black tracking-tight">New invoice</h1>
      <NewInvoiceForm
        customers={customers.map(({ id, firstName, lastName, accountNumber, businessName }) => ({ id, firstName, lastName, accountNumber, businessName }))}
        packages={packages.map(({ id, customerId, merchant, itemName, weight, declaredValue, destination, mode, status }) => ({ id, customerId, merchant, itemName, weight, declaredValue, destination, mode, status }))}
      />
    </div>
  );
}
