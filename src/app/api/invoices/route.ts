import { handle } from "@/lib/api/http";
import { createInvoiceFromPackages, invoiceSummary, listInvoices, type InvoiceFilter, type InvoiceSort } from "@/lib/api/invoices";
import { requireStaff } from "@/lib/staff-auth";
import type { IslandId } from "@/lib/types";

/** Staff: list/organize invoices. ?status=open|overdue|…&q=&island=&customerId=&sort= */
export async function GET(req: Request) {
  return handle(async () => {
    await requireStaff(req);
    const sp = new URL(req.url).searchParams;
    const [invoices, summary] = await Promise.all([
      listInvoices({
        status: (sp.get("status") as InvoiceFilter) ?? undefined,
        q: sp.get("q") ?? undefined,
        island: (sp.get("island") as IslandId) ?? undefined,
        customerId: sp.get("customerId") ?? undefined,
        sort: (sp.get("sort") as InvoiceSort) ?? undefined,
      }),
      invoiceSummary(),
    ]);
    return { summary, invoices };
  });
}

/** Staff: create a draft invoice from arrived packages. */
export async function POST(req: Request) {
  return handle(async () => {
    const staff = await requireStaff(req);
    const body = (await req.json()) as { customerId: string; packageIds: string[]; mode?: "air" | "sea" };
    return { invoice: await createInvoiceFromPackages({ ...body, createdBy: staff.name }) };
  });
}
