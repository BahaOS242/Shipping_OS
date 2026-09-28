import { handle } from "@/lib/api/http";
import { getInvoice, voidInvoice } from "@/lib/api/invoices";
import { requireStaff } from "@/lib/staff-auth";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireStaff(req);
    const { id } = await params;
    const { reason } = (await req.json()) as { reason: string };
    await voidInvoice(id, reason ?? "");
    return { invoice: await getInvoice(id) };
  });
}
