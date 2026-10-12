import { NextResponse } from "next/server";
import { withOperator } from "@/server/pilot";
import { snapshot, operation, packageHistory } from "@/server/operations";
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
    const q = params.get("q") ?? "";
    const packageId = params.get("packageId");
    const result = await withOperator(await sessionToken(), async (db, s) =>
      packageId
        ? await packageHistory(db, s, packageId)
        : await snapshot(db, s, q),
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const body = await readBody(request);
    const result = await withOperator(await sessionToken(), (db, s) =>
      operation(db, s, body, request.headers.get("idempotency-key") ?? ""),
    );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
