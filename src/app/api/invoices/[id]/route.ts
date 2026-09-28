import { handle } from "@/lib/api/http";
import { getInvoice } from "@/lib/api/invoices";
import { requireStaff } from "@/lib/staff-auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireStaff(req);
    return { invoice: await getInvoice((await params).id) };
  });
}
