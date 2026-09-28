import { handle } from "@/lib/api/http";
import { getInvoice, issueInvoice } from "@/lib/api/invoices";
import { requireStaff } from "@/lib/staff-auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireStaff(req);
    const { id } = await params;
    await issueInvoice(id);
    return { invoice: await getInvoice(id) };
  });
}
