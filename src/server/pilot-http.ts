import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { PilotError } from "./pilot";
export const cookieName =
  process.env.NODE_ENV === "production"
    ? "__Host-pilot_session"
    : "pilot_session";
export async function sessionToken() {
  return (await cookies()).get(cookieName)?.value;
}
export function requireOrigin(request: Request) {
  const origin = process.env.PILOT_ORIGIN;
  if (!origin) throw new PilotError(503, "Pilot origin is not configured.");
  if (request.headers.get("origin") !== origin)
    throw new PilotError(403, "Request origin is not allowed.");
}
export async function readBody(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    throw new PilotError(415, "JSON is required.");
  const reader = request.body?.getReader();
  if (!reader) throw new PilotError(400, "Request body is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8192) {
      await reader.cancel();
      throw new PilotError(413, "Request is too large.");
    }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(body);
  } catch {
    throw new PilotError(400, "Invalid JSON.");
  }
}
export function failure(error: unknown) {
  if (error instanceof PilotError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  if ((error as { code?: string })?.code === "23505")
    return NextResponse.json(
      {
        error: "This tracking number was just received. Refresh the inventory.",
      },
      { status: 409 },
    );
  console.error(
    "Pilot request failed",
    error instanceof Error ? error.name : "unknown",
  );
  return NextResponse.json(
    { error: "Unable to complete the request. Please retry." },
    { status: 503 },
  );
}
