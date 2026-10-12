import { withOperator } from "@/server/pilot";
import { sessionToken, failure } from "@/server/pilot-http";
import { exportRows } from "@/server/exports";
import { id } from "@/server/operations";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams,
      kind = q.get("kind") ?? "inventory",
      shipment = q.get("shipment");
    const csv = await withOperator(await sessionToken(), (db, s) =>
      exportRows(db, s, kind, shipment ? id(shipment) : null),
    );
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="shipping-os-${kind}.csv"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
