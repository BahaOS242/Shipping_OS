import { NextResponse } from "next/server";
import { withOperator } from "@/server/pilot";
import { snapshot, operation } from "@/server/operations";
import {
  failure,
  readBody,
  requireOrigin,
  sessionToken,
} from "@/server/pilot-http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const q = new URL(request.url).searchParams.get("q") ?? "";
    const result = await withOperator(await sessionToken(), (db, s) =>
      snapshot(db, s, q),
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
