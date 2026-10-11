import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { Pool } from "pg";
async function main() {
  if (
    process.env.PILOT_TEST_DISPOSABLE !== "yes" ||
    !process.env.ADMIN_DATABASE_URL ||
    !process.env.PILOT_TEST_ORIGIN
  )
    throw new Error(
      "Disposable test database and PILOT_TEST_ORIGIN are required.",
    );
  const origin = process.env.PILOT_TEST_ORIGIN;
  const admin = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const tenant = randomUUID(),
    customer = randomUUID(),
    token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  try {
    await admin.query(
      "INSERT INTO organizations(id,name,slug,organization_type) VALUES ($1,'PCL Imports test',$2,'freight_forwarder')",
      [tenant, "http-" + tenant],
    );
    await admin.query(
      "INSERT INTO organization_members(organization_id,user_id,role) VALUES ($1,'http-staff','warehouse')",
      [tenant],
    );
    await admin.query(
      "INSERT INTO customers(organization_id,id,display_name) VALUES ($1,$2,'HTTP customer')",
      [tenant, customer],
    );
    await admin.query(
      "INSERT INTO staff_sessions VALUES ($1,$2,'http-staff',now()+interval '1 hour')",
      [hash, tenant],
    );
    assert.equal((await fetch(origin + "/api/pilot/intake")).status, 401);
    const loginBody = JSON.stringify({ token });
    assert.equal(
      (
        await fetch(origin + "/api/pilot/session", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "https://wrong.example",
          },
          body: loginBody,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(origin + "/api/pilot/session", {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: origin },
          body: "null",
        })
      ).status,
      400,
    );
    const login = await fetch(origin + "/api/pilot/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: loginBody,
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie")!;
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=strict/i);
    if (cookie.startsWith("__Host-")) assert.match(cookie, /Secure/i);
    const headers = {
      "Content-Type": "application/json",
      Origin: origin,
      Cookie: cookie.split(";")[0],
      "Idempotency-Key": randomUUID(),
    };
    const body = JSON.stringify({
      customerId: customer,
      trackingNumber: "HTTP-" + randomUUID(),
      weightKg: 1,
      lengthCm: 10,
      widthCm: 10,
      heightCm: 10,
    });
    assert.equal(
      (
        await fetch(origin + "/api/pilot/intake", {
          method: "POST",
          headers: { ...headers, Origin: "https://wrong.example" },
          body,
        })
      ).status,
      403,
    );
    const receipt = await fetch(origin + "/api/pilot/intake", {
      method: "POST",
      headers,
      body,
    });
    assert.equal(receipt.status, 200);
    const pkg = await receipt.json();
    const replay = await fetch(origin + "/api/pilot/intake", {
      method: "POST",
      headers,
      body,
    });
    assert.equal((await replay.json()).id, pkg.id);
    const inventory = await fetch(origin + "/api/pilot/intake", { headers });
    assert.equal(inventory.status, 200);
    assert.equal(inventory.headers.get("cache-control"), "no-store");
    const items = await inventory.json();
    assert.equal(items.customers.length, 1);
    assert.equal(items.packages[0].id, pkg.id);
    assert.equal(
      (
        await fetch(origin + "/api/pilot/session", {
          method: "DELETE",
          headers,
        })
      ).status,
      200,
    );
    assert.equal(
      (await fetch(origin + "/api/pilot/intake", { headers })).status,
      401,
    );
    assert.equal(
      (
        await fetch(origin + "/api/pilot/session", {
          method: "POST",
          headers,
          body: loginBody,
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await admin.query(
          "SELECT count(*) FROM staff_sessions WHERE token_hash=$1",
          [hash],
        )
      ).rows[0].count,
      "0",
    );
    assert.equal((await fetch(origin + "/pilot")).status, 200);
    assert.equal((await fetch(origin + "/dashboard")).status, 200);
    console.log(
      "PASS: HTTP login, cookie protections, origin rejection, intake persistence/replay, tenant inventory, sign-out revocation, pilot/demo routes.",
    );
  } finally {
    await admin.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
