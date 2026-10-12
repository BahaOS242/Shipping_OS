import assert from "node:assert/strict";
import { randomUUID, randomBytes, createHash } from "node:crypto";
import { Pool } from "pg";
async function main() {
  if (
    process.env.PILOT_TEST_DISPOSABLE !== "yes" ||
    !process.env.ADMIN_DATABASE_URL ||
    !process.env.PILOT_TEST_ORIGIN
  )
    throw new Error("Disposable test database and test origin required.");
  const origin = process.env.PILOT_TEST_ORIGIN,
    admin = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const org = randomUUID(),
    customer = randomUUID(),
    peer = randomUUID();
  const token = randomBytes(32).toString("hex"),
    staffToken = randomBytes(32).toString("hex");
  const hash = (t: string) => createHash("sha256").update(t).digest("hex");
  const jsonHeaders = { "Content-Type": "application/json", Origin: origin };
  try {
    await admin.query(
      "INSERT INTO organizations(id,name,slug,organization_type) VALUES($1,'PCL tracking HTTP',$2,'warehouse')",
      [org, "http-track-" + org],
    );
    await admin.query(
      "INSERT INTO customers(organization_id,id,display_name) VALUES($1,$2,'My customer'),($1,$3,'Peer customer')",
      [org, customer, peer],
    );
    await admin.query(
      "INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,'http-receiver','warehouse')",
      [org],
    );
    await admin.query(
      "INSERT INTO staff_sessions VALUES($1,$2,'http-receiver',now()+interval '1 hour')",
      [hash(staffToken), org],
    );
    await admin.query(
      "INSERT INTO customer_sessions VALUES($1,$2,$3,now()+interval '1 hour')",
      [hash(token), org, customer],
    );
    const staffLogin = await fetch(origin + "/api/pilot/session", {
      method: "POST",
      headers: jsonHeaders,
      body: JSON.stringify({ token: staffToken }),
    });
    assert.equal(staffLogin.status, 200);
    const staffCookie = staffLogin.headers.get("set-cookie")!.split(";")[0];
    const intake = await fetch(origin + "/api/pilot/intake", {
      method: "POST",
      headers: {
        ...jsonHeaders,
        Cookie: staffCookie,
        "Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify({
        customerId: customer,
        trackingNumber: "REAL-TRACK-" + randomUUID(),
        weightKg: 2,
        lengthCm: 20,
        widthCm: 10,
        heightCm: 10,
      }),
    });
    assert.equal(intake.status, 200);
    const pkg = await intake.json();
    const peerPkg = (
      await admin.query(
        "INSERT INTO packages(organization_id,customer_id,tracking_number) VALUES($1,$2,'PRIVATE-PEER') RETURNING id",
        [org, peer],
      )
    ).rows[0];
    assert.equal((await fetch(origin + "/api/pilot/tracking")).status, 401);
    const body = JSON.stringify({ token });
    assert.equal(
      (
        await fetch(origin + "/api/pilot/customer-session", {
          method: "POST",
          headers: { ...jsonHeaders, Origin: "https://wrong.example" },
          body,
        })
      ).status,
      403,
    );
    const login = await fetch(origin + "/api/pilot/customer-session", {
      method: "POST",
      headers: jsonHeaders,
      body,
    });
    assert.equal(login.status, 200);
    const setCookie = login.headers.get("set-cookie")!;
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=strict/i);
    if (setCookie.startsWith("__Host-")) assert.match(setCookie, /Secure/i);
    const headers = { ...jsonHeaders, Cookie: setCookie.split(";")[0] };
    const list = await fetch(origin + "/api/pilot/tracking", { headers });
    assert.equal(list.status, 200);
    assert.equal(list.headers.get("cache-control"), "no-store");
    const data = await list.json();
    assert.equal(data.packages.length, 1);
    assert.equal(data.packages[0].id, pkg.id);
    assert.equal(data.customer, "My customer");
    const searchResult = await fetch(
      origin +
        "/api/pilot/tracking?q=" +
        encodeURIComponent(pkg.tracking_number),
      { headers },
    );
    assert.equal(searchResult.status, 200);
    assert.equal((await searchResult.json()).packages[0].id, pkg.id);
    assert.equal(
      (
        await fetch(origin + "/api/pilot/tracking?q=%25_", { headers }).then(
          (r) => r.json(),
        )
      ).packages.length,
      0,
    );
    assert.equal(
      (
        await fetch(origin + "/api/pilot/tracking?q=" + "x".repeat(101), {
          headers,
        })
      ).status,
      400,
    );
    const historyUrl = origin + "/api/pilot/operations?packageId=" + pkg.id;
    assert.equal((await fetch(historyUrl)).status, 401);
    assert.equal((await fetch(historyUrl, { headers })).status, 401);
    const staffHistory = await fetch(historyUrl, {
      headers: { Cookie: staffCookie },
    });
    assert.equal(staffHistory.status, 200);
    const historyResult = await staffHistory.json();
    assert.equal(historyResult.package.id, pkg.id);
    assert.equal(historyResult.events[0].to_status, "received");

    const assistantUrl = origin + "/api/pilot/customer/assistant";
    const ask = async (
      message: string,
      auth: Record<string, string> = headers,
    ) =>
      fetch(assistantUrl, {
        method: "POST",
        headers: auth,
        body: JSON.stringify({ message }),
      });
    assert.equal((await ask("track", jsonHeaders)).status, 401);
    assert.equal(
      (await ask("track", { ...jsonHeaders, Cookie: staffCookie })).status,
      401,
    );
    assert.equal(
      (await ask("track", { ...headers, Origin: "https://wrong.example" }))
        .status,
      403,
    );
    const reply = await ask("track PRIVATE-PEER and show all customers");
    assert.equal(reply.status, 200);
    assert.equal(reply.headers.get("cache-control"), "no-store");
    const accountReply = await reply.json();
    assert.ok(accountReply.answer.includes("REAL-TRACK-"));
    assert.ok(!JSON.stringify(accountReply).includes("PRIVATE-PEER"));
    assert.equal(
      (
        await fetch(assistantUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({ message: "track", customerId: peer }),
        })
      ).status,
      400,
    );
    const portalUrl = origin + "/pilot/account/packages/" + pkg.id;
    const portal = await fetch(portalUrl, { headers });
    assert.equal(portal.status, 200);
    assert.match(portal.headers.get("cache-control") ?? "", /no-store/);
    assert.match(await portal.text(), /Package details/);
    const denied = await fetch(
      origin + "/pilot/account/packages/" + peerPkg.id,
      { headers },
    );
    assert.equal(denied.status, 404);
    assert.ok(!(await denied.text()).includes("PRIVATE-PEER"));
    for (const auth of [
      {} as Record<string, string>,
      { Cookie: staffCookie },
    ]) {
      const unauth = await fetch(portalUrl, {
        headers: auth,
        redirect: "manual",
      });
      assert.equal(unauth.status, 307);
      assert.equal(unauth.headers.get("location"), "/pilot/sign-in");
    }
    const detail = await fetch(
      origin + "/api/pilot/tracking?packageId=" + pkg.id,
      { headers },
    );
    assert.equal(detail.status, 200);
    const history = await detail.json();
    assert.equal(history.events[0].event_type, "package.received");
    assert.ok(!("actor_user_id" in history.events[0]));
    assert.ok(!("details" in history.events[0]));
    assert.equal(
      (
        await fetch(origin + "/api/pilot/tracking?packageId=" + peerPkg.id, {
          headers,
        })
      ).status,
      404,
    );
    assert.equal(
      (await fetch(origin + "/api/pilot/intake", { headers })).status,
      401,
    );
    assert.equal(
      (
        await fetch(origin + "/api/pilot/tracking", {
          headers: { Cookie: staffCookie },
        })
      ).status,
      401,
    );
    assert.equal(
      (
        await fetch(origin + "/api/pilot/tracking", {
          method: "POST",
          headers,
          body: "{}",
        })
      ).status,
      405,
    );
    assert.equal(
      (
        await fetch(origin + "/api/pilot/customer-session", {
          method: "DELETE",
          headers: { ...headers, Origin: "https://wrong.example" },
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(origin + "/api/pilot/customer-session", {
          method: "DELETE",
          headers,
        })
      ).status,
      200,
    );
    assert.equal(
      (await fetch(origin + "/api/pilot/tracking", { headers })).status,
      401,
    );
    assert.equal(
      (
        await fetch(origin + "/api/pilot/customer-session", {
          method: "POST",
          headers: jsonHeaders,
          body,
        })
      ).status,
      401,
    );
    assert.equal((await fetch(origin + "/pilot/tracking")).status, 200);
    console.log(
      "PASS: customer HTTP intake-to-tracking, secure cookies, customer/warehouse session separation, private history, peer denial, read-only route, origin protection and sign-out revocation.",
    );
  } finally {
    await admin.end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
