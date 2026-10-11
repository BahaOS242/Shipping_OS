import { NextResponse } from "next/server";
import { hashToken, PilotError, withStaff } from "@/server/pilot";
import {
  cookieName,
  failure,
  readBody,
  requireOrigin,
  sessionToken,
} from "@/server/pilot-http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const body = await readBody(request);
    if (!body || typeof body.token !== "string")
      throw new PilotError(400, "Enter a staff access code.");
    const staff = await withStaff(body.token, async (_db, s) => s);
    const response = NextResponse.json({ name: staff.name });
    response.cookies.set(cookieName, body.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      expires: new Date(staff.expires_at),
    });
    return response;
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE(request: Request) {
  try {
    requireOrigin(request);
    const token = await sessionToken();
    if (token) {
      try {
        await withStaff(token, (db) =>
          db.query("DELETE FROM staff_sessions WHERE token_hash=$1", [
            hashToken(token),
          ]),
        );
      } catch (error) {
        if (!(error instanceof PilotError && error.status === 401)) throw error;
      }
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(cookieName, "", {
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
