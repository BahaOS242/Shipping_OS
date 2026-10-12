import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { Pool } from "pg";
import {
  hashToken,
  PilotError,
  pool,
  receive,
  validateIntake,
  withStaff,
} from "../src/server/pilot";
import { withCustomer, tracking } from "../src/server/customer-tracking";
async function main() {
  if (
    process.env.PILOT_TEST_DISPOSABLE !== "yes" ||
    !process.env.ADMIN_DATABASE_URL
  )
    throw new Error("Use a disposable migrated database.");
  const admin = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const org = [randomUUID(), randomUUID()],
    cus = [randomUUID(), randomUUID(), randomUUID()];
  const tokens = Array.from({ length: 5 }, () =>
    randomBytes(32).toString("hex"),
  );
  let checks = 0;
  async function rejects(fn: () => Promise<unknown>, status: number) {
    await assert.rejects(
      fn,
      (e: unknown) => e instanceof PilotError && e.status === status,
    );
    checks++;
  }
  try {
    for (let i = 0; i < 2; i++)
      await admin.query(
        "INSERT INTO organizations(id,name,slug,organization_type) VALUES($1,'Tracking test',$2,'warehouse')",
        [org[i], "tracking-" + org[i]],
      );
    for (let i = 0; i < 3; i++) {
      await admin.query(
        "INSERT INTO customers(organization_id,id,display_name) VALUES($1,$2,$3)",
        [org[i === 2 ? 1 : 0], cus[i], "Customer " + i],
      );
      await admin.query(
        "INSERT INTO customer_sessions VALUES($1,$2,$3,now()+interval '1 hour')",
        [hashToken(tokens[i]), org[i === 2 ? 1 : 0], cus[i]],
      );
    }
    await admin.query(
      "INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,'tracking-staff','warehouse'),($1,'','warehouse')",
      [org[0]],
    );
    await admin.query(
      "INSERT INTO staff_sessions VALUES($1,$2,'tracking-staff',now()+interval '1 hour')",
      [hashToken(tokens[3]), org[0]],
    );
    await admin.query(
      "INSERT INTO customer_sessions VALUES($1,$2,$3,now()-interval '1 hour')",
      [hashToken(tokens[4]), org[0], cus[0]],
    );
    const input = validateIntake({
      customerId: cus[0],
      trackingNumber: "TRACK-" + randomUUID(),
      weightKg: 1,
      lengthCm: 10,
      widthCm: 10,
      heightCm: 10,
    });
    const pkg = await withStaff(tokens[3], (db, s) =>
      receive(db, s, input, randomUUID()),
    );
    const peerPkg = (
      await admin.query(
        "INSERT INTO packages(organization_id,customer_id,tracking_number) VALUES($1,$2,'PEER') RETURNING id",
        [org[0], cus[1]],
      )
    ).rows[0];
    const otherPkg = (
      await admin.query(
        "INSERT INTO packages(organization_id,customer_id,tracking_number) VALUES($1,$2,'OTHER') RETURNING id",
        [org[1], cus[2]],
      )
    ).rows[0];
    const own = await withCustomer(tokens[0], (db, c) => tracking(db, c, null));
    assert.ok(
      own.packages !== undefined &&
        own.packages.length === 1 &&
        own.packages[0].id === pkg.id,
    );
    checks++;
    const detail = await withCustomer(tokens[0], (db, c) =>
      tracking(db, c, pkg.id),
    );
    assert.ok(detail.events !== undefined && detail.events.length === 1);
    assert.ok(detail.events);
    assert.ok(!("actor_user_id" in detail.events[0]));
    checks++;
    await rejects(
      () => withCustomer(tokens[0], (db, c) => tracking(db, c, peerPkg.id)),
      404,
    );
    await rejects(
      () => withCustomer(tokens[0], (db, c) => tracking(db, c, otherPkg.id)),
      404,
    );
    await rejects(
      () => withCustomer(tokens[0], (db, c) => tracking(db, c, "invalid")),
      400,
    );
    const direct = await withCustomer(tokens[0], async (db) => ({
      packages: (await db.query("SELECT * FROM packages")).rows,
      customers: (await db.query("SELECT * FROM customers")).rows,
      events: (await db.query("SELECT * FROM package_events")).rows,
      audit: (await db.query("SELECT * FROM audit_events")).rows,
    }));
    assert.equal(direct.packages.length, 1);
    assert.equal(direct.customers.length, 1);
    assert.equal(direct.events.length, 1);
    assert.equal(direct.audit.length, 0);
    checks++;
    const update = await withCustomer(tokens[0], (db) =>
      db.query("UPDATE packages SET status='delivered'"),
    );
    assert.equal(update.rowCount, 0);
    checks++;
    await assert.rejects(
      () =>
        withCustomer(tokens[0], (db) =>
          db.query(
            "INSERT INTO packages(organization_id,customer_id,tracking_number,status) VALUES($1,$2,'FORGED','received')",
            [org[0], cus[0]],
          ),
        ),
      (e: unknown) => (e as { code: string }).code === "42501",
    );
    checks++;
    await rejects(() => withStaff(tokens[0], async () => true), 401);
    await rejects(() => withCustomer(tokens[3], async () => true), 401);
    await rejects(() => withCustomer(tokens[4], async () => true), 401);
    await rejects(() => withCustomer(undefined, async () => true), 401);
    const staff = await withStaff(
      tokens[3],
      async (db) => (await db.query("SELECT * FROM packages")).rows,
    );
    assert.equal(staff.length, 2);
    checks++;
    const peer = await withCustomer(tokens[1], (db, c) =>
      tracking(db, c, null),
    );
    assert.ok(
      peer.packages !== undefined &&
        peer.packages.length === 1 &&
        peer.packages[0].id === peerPkg.id,
    );
    checks++;
    const ctx = await pool().query(
      "SELECT current_setting('app.customer_id',true) AS customer,current_setting('app.actor_type',true) AS actor",
    );
    assert.ok(!ctx.rows[0].customer && !ctx.rows[0].actor);
    checks++;
    await withCustomer(tokens[0], (db) =>
      db.query("DELETE FROM customer_sessions WHERE token_hash=$1", [
        hashToken(tokens[0]),
      ]),
    );
    await rejects(() => withCustomer(tokens[0], async () => true), 401);
    console.log(
      `PASS: ${checks} customer tracking assertions (receipt visibility, same-tenant/cross-tenant isolation, read-only access, actor separation, expiry and revocation).`,
    );
  } finally {
    await admin.end();
    await pool().end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
