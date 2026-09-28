import { invoicesToCsv, listInvoices, type InvoiceFilter } from "@/lib/api/invoices";
import { StaffAuthError, requireStaff } from "@/lib/staff-auth";

/** CSV for the accountant. Same filters as the list. */
export async function GET(req: Request) {
  try {
    await requireStaff(req);
  } catch (e) {
    if (e instanceof StaffAuthError) return new Response(e.message, { status: 401 });
    throw e;
  }
  const sp = new URL(req.url).searchParams;
  const rows = await listInvoices({ status: (sp.get("status") as InvoiceFilter) ?? undefined, q: sp.get("q") ?? undefined, sort: "oldest" });
  return new Response(invoicesToCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="the-link-invoices-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
