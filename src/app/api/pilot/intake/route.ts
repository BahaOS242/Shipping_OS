import { NextResponse } from "next/server";
import { receive, validateIntake, withStaff } from "@/server/pilot";
import {
  failure,
  readBody,
  requireOrigin,
  sessionToken,
} from "@/server/pilot-http";
export const runtime = "nodejs";
export async function GET() {
  try {
    const data = await withStaff(await sessionToken(), async (db, staff) => ({
      organization: staff.name,
      customers: (
        await db.query(
          "SELECT id,display_name FROM customers WHERE organization_id=$1 ORDER BY display_name LIMIT 500",
          [staff.organization_id],
        )
      ).rows,
      packages: (
        await db.query(
          "SELECT p.id,p.tracking_number,p.status,p.weight_kg,p.created_at,c.display_name FROM packages p JOIN customers c ON c.organization_id=p.organization_id AND c.id=p.customer_id WHERE p.organization_id=$1 ORDER BY p.updated_at DESC LIMIT 50",
          [staff.organization_id],
        )
      ).rows,
    }));
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const input = validateIntake(await readBody(request));
    const result = await withStaff(await sessionToken(), (db, staff) =>
      receive(db, staff, input, request.headers.get("idempotency-key") ?? ""),
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
