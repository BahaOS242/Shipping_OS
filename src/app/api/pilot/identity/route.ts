import { NextResponse } from "next/server";
import { login, register, rateLimit } from "@/server/identity";
import { failure, readBody, requireOrigin } from "@/server/pilot-http";
import { customerCookieName } from "@/server/customer-http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    await rateLimit("public-identity-global", 200);
    const body = await readBody(request),
      mode = new URL(request.url).searchParams.get("mode");
    if (mode === "register")
      return NextResponse.json(await register(body), {
        headers: { "Cache-Control": "no-store" },
      });
    const result = await login(body);
    const response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
    response.cookies.set(customerCookieName, result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      expires: new Date(result.expiresAt),
    });
    return response;
  } catch (e) {
    return failure(e);
  }
}
