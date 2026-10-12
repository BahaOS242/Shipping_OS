import { NextResponse } from "next/server";
import { withCustomer } from "@/server/customer-tracking";
import { customerToken } from "@/server/customer-http";
import { hashPassword } from "@/server/identity";
import { failure, readBody, requireOrigin } from "@/server/pilot-http";
import { object, fields } from "@/server/operations";
import { PilotError, hashToken } from "@/server/pilot";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    requireOrigin(request);
    const body = object(await readBody(request));
    fields(body, ["password"]);
    const token = await customerToken();
    await withCustomer(token, async (db, c) => {
      const passwordHash = await hashPassword(body.password);
      const profile = (
        await db.query(
          "SELECT email FROM customers WHERE organization_id=$1 AND id=$2",
          [c.organization_id, c.customer_id],
        )
      ).rows[0];
      if (!profile.email)
        throw new PilotError(
          400,
          "Ask the team to add your verified email first.",
        );
      await db.query(
        "INSERT INTO pilot_accounts(organization_id,customer_id,email,password_hash) VALUES($1,$2,$3,$4) ON CONFLICT(organization_id,customer_id) DO UPDATE SET email=EXCLUDED.email,password_hash=EXCLUDED.password_hash",
        [c.organization_id, c.customer_id, profile.email, passwordHash],
      );
      await db.query(
        "DELETE FROM customer_sessions WHERE organization_id=$1 AND customer_id=$2 AND token_hash<>$3",
        [c.organization_id, c.customer_id, hashToken(token!)],
      );
    });
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return failure(e);
  }
}
