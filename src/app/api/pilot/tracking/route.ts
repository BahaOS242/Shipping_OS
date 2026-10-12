import { NextResponse } from "next/server";
import { withCustomer, tracking } from "@/server/customer-tracking";
import { customerToken } from "@/server/customer-http";
import { failure } from "@/server/pilot-http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const packageId = new URL(request.url).searchParams.get("packageId");
    const data = await withCustomer(await customerToken(), (db, customer) =>
      tracking(db, customer, packageId),
    );
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return failure(error);
  }
}
