import { NextResponse } from "next/server";
import { withStaff } from "@/server/pilot";
import {
  createCustomer,
  listCustomers,
  validateCustomer,
} from "@/server/pilot-customers";
import {
  failure,
  readBody,
  requireOrigin,
  sessionToken,
} from "@/server/pilot-http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const data = await withStaff(await sessionToken(), (db, s) =>
      listCustomers(db, s, params.get("q") ?? "", params.get("cursor")),
    );
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const input = validateCustomer(await readBody(request));
    const customer = await withStaff(await sessionToken(), (db, s) =>
      createCustomer(
        db,
        s,
        input,
        request.headers.get("idempotency-key") ?? "",
      ),
    );
    return NextResponse.json(customer, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
