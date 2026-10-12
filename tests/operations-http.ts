import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { Pool } from "pg";
async function main() {
  if (
    process.env.PILOT_TEST_DISPOSABLE !== "yes" ||
    !process.env.ADMIN_DATABASE_URL ||
    !process.env.PILOT_TEST_ORIGIN
  )
    throw new Error("Disposable server required.");
  const db = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL }),
    origin = process.env.PILOT_TEST_ORIGIN,
    org = randomUUID(),
    customer = randomUUID(),
    staff = randomBytes(32).toString("hex");
  let count = 0;
  const hash = (s: string) => createHash("sha256").update(s).digest("hex");
  const status = async (r: Response, expected: number) => {
    assert.equal(r.status, expected, await r.clone().text());
    count++;
    return r;
  };
  const headers = { "Content-Type": "application/json", Origin: origin };
  try {
    await db.query(
      "INSERT INTO organizations(id,name,slug,organization_type) VALUES($1,'HTTP Operations',$2,'warehouse')",
      [org, "ops-http-" + org],
    );
    await db.query(
      "INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,'manager','manager')",
      [org],
    );
    await db.query(
      "INSERT INTO staff_sessions VALUES($1,$2,'manager',now()+interval '1 hour')",
      [hash(staff), org],
    );
    await db.query(
      "INSERT INTO customers(organization_id,id,display_name,email) VALUES($1,$2,'HTTP customer','http@example.com')",
      [org, customer],
    );
    await status(await fetch(origin + "/api/pilot/operations"), 401);
    await status(await fetch(origin + "/api/pilot/customer/workspace"), 401);
    const signed = await status(
      await fetch(origin + "/api/pilot/session", {
        method: "POST",
        headers,
        body: JSON.stringify({ token: staff }),
      }),
      200,
    );
    const cookie = signed.headers.get("set-cookie")!.split(";")[0];
    const op = async (
      action: string,
      data: object,
      id?: unknown,
      key = randomUUID(),
    ) =>
      fetch(origin + "/api/pilot/operations", {
        method: "POST",
        headers: { ...headers, Cookie: cookie, "Idempotency-Key": key },
        body: JSON.stringify({ action, data, id }),
      });
    await status(
      await fetch(origin + "/api/pilot/operations", {
        method: "POST",
        headers: { ...headers, Cookie: cookie, Origin: "https://bad.example" },
        body: "{}",
      }),
      403,
    );
    const access = await (
      await status(
        await op("customer.access", { revoke: false }, customer),
        200,
      )
    ).json();
    const login = await status(
      await fetch(origin + "/api/pilot/customer-session", {
        method: "POST",
        headers,
        body: JSON.stringify({ token: access.token }),
      }),
      200,
    );
    const customerCookie = login.headers.get("set-cookie")!.split(";")[0];
    assert.match(
      login.headers.get("set-cookie")!,
      /HttpOnly.*Secure|Secure.*HttpOnly/,
    );
    count++;
    const own = { ...headers, Cookie: customerCookie };
    const cu = async (
      action: string,
      data: object,
      id?: unknown,
      key = randomUUID(),
    ) =>
      fetch(origin + "/api/pilot/customer/workspace", {
        method: "POST",
        headers: { ...own, "Idempotency-Key": key },
        body: JSON.stringify({ action, data, id }),
      });
    await status(
      await fetch(origin + "/api/pilot/operations", { headers: own }),
      401,
    );
    const key = randomUUID(),
      data = {
        trackingNumber: "HTTP-" + randomUUID(),
        merchant: "Store",
        description: "Parcel",
        destination: "Nassau",
        service: "air",
      };
    const pre = await (
      await status(await cu("prealert", data, undefined, key), 200)
    ).json();
    assert.equal(
      (
        await (
          await status(await cu("prealert", data, undefined, key), 200)
        ).json()
      ).id,
      pre.id,
    );
    count++;
    await status(
      await cu("prealert", { ...data, description: "Changed" }, undefined, key),
      409,
    );
    const receipt = await (
      await status(
        await cu("record.create", {
          kind: "receipt",
          payload: {
            description: "Invoice",
            amountCents: 1000,
            currency: "BSD",
            packageId: pre.id,
          },
        }),
        200,
      )
    ).json();
    const file = new FormData();
    file.set(
      "file",
      new File(["%PDF-1.7\nTest"], "invoice.pdf", { type: "application/pdf" }),
    );
    file.set("recordId", receipt.id);
    file.set("packageId", pre.id);
    const upload = await (
      await status(
        await fetch(origin + "/api/pilot/customer/files", {
          method: "POST",
          headers: { Origin: origin, Cookie: customerCookie },
          body: file,
        }),
        200,
      )
    ).json();
    const download = await status(
      await fetch(origin + "/api/pilot/customer/files?id=" + upload.id, {
        headers: { Cookie: customerCookie },
      }),
      200,
    );
    assert.match(download.headers.get("content-disposition")!, /attachment/);
    assert.equal(await download.text(), "%PDF-1.7\nTest");
    count += 2;
    await status(
      await fetch(origin + "/api/pilot/customer/files?id=" + upload.id),
      401,
    );
    await status(
      await fetch(origin + "/api/pilot/customer/password", {
        method: "POST",
        headers,
        body: JSON.stringify({ password: "Correct password 123" }),
      }),
      401,
    );
    const password = "Correct password 123";
    await status(
      await fetch(origin + "/api/pilot/customer/password", {
        method: "POST",
        headers: own,
        body: JSON.stringify({ password }),
      }),
      200,
    );
    const identity = {
      organization: "ops-http-" + org,
      email: "http@example.com",
      password,
    };
    await status(
      await fetch(origin + "/api/pilot/identity", {
        method: "POST",
        headers,
        body: JSON.stringify({ ...identity, password: "wrong" }),
      }),
      401,
    );
    const logged = await status(
      await fetch(origin + "/api/pilot/identity", {
        method: "POST",
        headers,
        body: JSON.stringify(identity),
      }),
      200,
    );
    const second = logged.headers.get("set-cookie")!.split(";")[0];
    await status(
      await fetch(origin + "/api/pilot/customer/workspace", {
        headers: { Cookie: second },
      }),
      200,
    );
    await status(
      await fetch(origin + "/api/pilot/customer/password", {
        method: "POST",
        headers: own,
        body: JSON.stringify({ password: "New correct password 456" }),
      }),
      200,
    );
    await status(
      await fetch(origin + "/api/pilot/customer/workspace", {
        headers: { Cookie: second },
      }),
      401,
    );
    const exportResponse = await status(
      await fetch(origin + "/api/pilot/export?kind=inventory", {
        headers: { Cookie: cookie },
      }),
      200,
    );
    assert.ok((await exportResponse.text()).includes(data.trackingNumber.toUpperCase()));
    count++;
    const foreign = await db.query(
      "INSERT INTO customers(organization_id,display_name) VALUES($1,'Different customer') RETURNING id",
      [org],
    );
    const other = await (
      await status(
        await op("customer.access", { revoke: false }, foreign.rows[0].id),
        200,
      )
    ).json();
    const otherLogin = await status(
      await fetch(origin + "/api/pilot/customer-session", {
        method: "POST",
        headers,
        body: JSON.stringify({ token: other.token }),
      }),
      200,
    );
    const otherCookie = otherLogin.headers.get("set-cookie")!.split(";")[0];
    await status(
      await fetch(origin + "/api/pilot/customer/files?id=" + upload.id, {
        headers: { Cookie: otherCookie },
      }),
      404,
    );
    await status(await op("customer.access", { revoke: true }, customer), 200);
    await status(
      await fetch(origin + "/api/pilot/customer/workspace", { headers: own }),
      401,
    );
    console.log(
      `PASS: ${count} operations HTTP assertions: authorization/origin, replay/conflicts, binary documents and isolation, password login/reset/session revocation, export.`,
    );
  } finally {
    await db.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
