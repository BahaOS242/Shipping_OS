import { NextResponse } from "next/server";
import { withCustomer } from "@/server/customer-tracking";
import { customerToken } from "@/server/customer-http";
import { failure, readBody, requireOrigin } from "@/server/pilot-http";
import {
  customerSnapshot,
  customerOperation,
} from "@/server/customer-workspace";
export const runtime = "nodejs";
export async function GET() {
  try {
    return NextResponse.json(
      await withCustomer(await customerToken(), customerSnapshot),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const body = await readBody(request);
    return NextResponse.json(
      await withCustomer(await customerToken(), (db, c) =>
        customerOperation(
          db,
          c,
          body,
          request.headers.get("idempotency-key") ?? "",
        ),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
