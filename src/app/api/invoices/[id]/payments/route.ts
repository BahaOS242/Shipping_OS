import { handle } from "@/lib/api/http";
import { getInvoice, recordPayment } from "@/lib/api/invoices";
import { requireStaff } from "@/lib/staff-auth";
import type { PaymentMethod } from "@/lib/types";

/** Staff records a payment (DEMO — no money moves). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const staff = await requireStaff(req);
    const { id } = await params;
    const body = (await req.json()) as { amount: number; method: PaymentMethod; reference?: string };
    await recordPayment(id, { ...body, recordedBy: staff.name });
    return { invoice: await getInvoice(id) };
  });
}
