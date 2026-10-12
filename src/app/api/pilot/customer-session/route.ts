import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hashToken, PilotError } from "@/server/pilot";
import { withCustomer } from "@/server/customer-tracking";
import { failure, readBody, requireOrigin } from "@/server/pilot-http";
import { customerCookieName } from "@/server/customer-http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const body = await readBody(request);
    if (!body || typeof body.token !== "string")
      throw new PilotError(400, "Enter your private customer access code.");
    const customer = await withCustomer(body.token, async (_db, c) => c);
    const response = NextResponse.json(
      { name: customer.display_name },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(customerCookieName, body.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      expires: new Date(customer.expires_at),
    });
    return response;
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    requireOrigin(request);
    const token = (await cookies()).get(customerCookieName)?.value;
    if (token) {
      try {
        await withCustomer(token, (db) =>
          db.query("DELETE FROM customer_sessions WHERE token_hash=$1", [
            hashToken(token),
          ]),
        );
      } catch (error) {
        if (!(error instanceof PilotError && error.status === 401)) throw error;
      }
    }
    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(customerCookieName, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return failure(error);
  }
}
