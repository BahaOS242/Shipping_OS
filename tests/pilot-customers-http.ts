import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { Pool } from "pg";
async function main() {
  if (
    process.env.PILOT_TEST_DISPOSABLE !== "yes" ||
    !process.env.ADMIN_DATABASE_URL ||
    !process.env.PILOT_TEST_ORIGIN
  )
    throw new Error("Use a disposable database and test origin.");
  const origin = process.env.PILOT_TEST_ORIGIN,
    admin = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const org = randomUUID(),
    token = randomBytes(32).toString("hex"),
    hash = (v: string) => createHash("sha256").update(v).digest("hex");
  try {
    await admin.query(
      "INSERT INTO organizations(id,name,slug,organization_type) VALUES($1,'HTTP customer management',$2,'warehouse')",
      [org, "customers-http-" + org],
    );
    await admin.query(
      "INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,'receiver','warehouse')",
      [org],
    );
    await admin.query(
      "INSERT INTO staff_sessions VALUES($1,$2,'receiver',now()+interval '1 hour')",
      [hash(token), org],
    );
    assert.equal((await fetch(origin + "/api/pilot/customers")).status, 401);
    const login = await fetch(origin + "/api/pilot/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ token }),
    });
    assert.equal(login.status, 200);
    const headers = {
        "Content-Type": "application/json",
        Origin: origin,
        Cookie: login.headers.get("set-cookie")!.split(";")[0],
        "Idempotency-Key": randomUUID(),
      },
      body = JSON.stringify({
        displayName: "New warehouse customer",
        email: "NEW@EXAMPLE.COM",
        phone: "+12425550123",
      });
    assert.equal(
      (
        await fetch(origin + "/api/pilot/customers", {
          method: "POST",
          headers: { ...headers, Origin: "https://wrong.example" },
          body,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(origin + "/api/pilot/customers", {
          method: "POST",
          headers,
          body: JSON.stringify({
            displayName: "Injected",
            organizationId: org,
          }),
        })
      ).status,
      400,
    );
    const created = await fetch(origin + "/api/pilot/customers", {
      method: "POST",
      headers,
      body,
    });
    assert.equal(created.status, 200);
    const customer = await created.json();
    assert.equal(customer.email, "new@example.com");
    const retry = await fetch(origin + "/api/pilot/customers", {
      method: "POST",
      headers,
      body,
    });
    assert.equal((await retry.json()).id, customer.id);
    const directory = await fetch(
      origin + "/api/pilot/customers?q=new%40example",
      { headers },
    );
    assert.equal(directory.headers.get("cache-control"), "no-store");
    assert.equal((await directory.json()).customers[0].id, customer.id);
    const receipt = await fetch(origin + "/api/pilot/intake", {
      method: "POST",
      headers: { ...headers, "Idempotency-Key": randomUUID() },
      body: JSON.stringify({
        customerId: customer.id,
        trackingNumber: "NEW-CLIENT-" + randomUUID(),
        weightKg: 1,
        lengthCm: 10,
        widthCm: 10,
        heightCm: 10,
      }),
    });
    assert.equal(receipt.status, 200);
    const customerToken = randomBytes(32).toString("hex");
    await admin.query(
      "INSERT INTO customer_sessions VALUES($1,$2,$3,now()+interval '1 hour')",
      [hash(customerToken), org, customer.id],
    );
    const customerLogin = await fetch(origin + "/api/pilot/customer-session", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin },
      body: JSON.stringify({ token: customerToken }),
    });
    const customerCookie = customerLogin.headers
      .get("set-cookie")!
      .split(";")[0];
    assert.equal(
      (
        await fetch(origin + "/api/pilot/customers", {
          headers: { Cookie: customerCookie },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(origin + "/api/pilot/customers", {
          method: "POST",
          headers: { ...headers, Cookie: customerCookie },
          body,
        })
      ).status,
      401,
    );
    assert.equal((await fetch(origin + "/pilot/customers")).status, 200);
    console.log(
      "PASS: customer HTTP creation, replay, search, new-customer intake, origin/tenant-input rejection and customer-session denial.",
    );
  } finally {
    await admin.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
