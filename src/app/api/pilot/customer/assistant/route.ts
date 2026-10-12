import { NextResponse } from "next/server";
import { withCustomer } from "@/server/customer-tracking";
import { customerToken } from "@/server/customer-http";
import { failure, readBody, requireOrigin } from "@/server/pilot-http";
import { customerAssistant } from "@/server/customer-assistant";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const body = await readBody(request);
    return NextResponse.json(
      await withCustomer(await customerToken(), (db, c) =>
        customerAssistant(db, c, body),
      ),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
