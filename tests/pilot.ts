// Requires a disposable, already migrated database. Never point this at real data.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { Pool } from "pg";
import {
  hashToken,
  PilotError,
  pool,
  receive,
  validateIntake,
  withStaff,
} from "../src/server/pilot";
async function main() {
  if (
    process.env.PILOT_TEST_DISPOSABLE !== "yes" ||
    !process.env.ADMIN_DATABASE_URL
  )
    throw new Error(
      "Set PILOT_TEST_DISPOSABLE=yes with a dedicated test database.",
    );
  const admin = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const tenants = [randomUUID(), randomUUID()],
    customers = [randomUUID(), randomUUID()];
  const tokens = [
    randomBytes(32).toString("hex"),
    randomBytes(32).toString("hex"),
    randomBytes(32).toString("hex"),
    randomBytes(32).toString("hex"),
  ];
  let checks = 0;
  async function rejects(fn: () => Promise<unknown>, status: number) {
    await assert.rejects(
      fn,
      (e: unknown) => e instanceof PilotError && e.status === status,
    );
    checks++;
  }
  try {
    for (let i = 0; i < 2; i++) {
      await admin.query(
        "INSERT INTO organizations(id,name,slug,organization_type) VALUES ($1,$2,$3,'warehouse')",
        [tenants[i], "Pilot test " + i, "test-" + tenants[i]],
      );
      await admin.query(
        "INSERT INTO organization_members VALUES ($1,'receiver','warehouse',now()),($1,'customer','customer',now())",
        [tenants[i]],
      );
      await admin.query(
        "INSERT INTO customers(organization_id,id,display_name) VALUES ($1,$2,$3)",
        [tenants[i], customers[i], "Customer " + i],
      );
      await admin.query(
        "INSERT INTO staff_sessions VALUES ($1,$2,'receiver',now()+interval '1 hour')",
        [hashToken(tokens[i]), tenants[i]],
      );
    }
    await admin.query(
      "INSERT INTO staff_sessions VALUES ($1,$2,'customer',now()+interval '1 hour'),($3,$2,'receiver',now()-interval '1 hour')",
      [hashToken(tokens[2]), tenants[0], hashToken(tokens[3])],
    );
    const input = validateIntake({
      customerId: customers[0],
      trackingNumber: " test-123 ",
      weightKg: 2,
      lengthCm: 10,
      widthCm: 20,
      heightCm: 30,
    });
    const key = randomUUID();
    const saved = await withStaff(tokens[0], (db, s) =>
      receive(db, s, input, key),
    );
    assert.equal(saved.status, "received");
    checks++;
    const replay = await withStaff(tokens[0], (db, s) =>
      receive(db, s, input, key),
    );
    assert.equal(replay.id, saved.id);
    checks++;
    const count = await admin.query(
      "SELECT (SELECT count(*) FROM package_events WHERE package_id=$1) AS events,(SELECT count(*) FROM audit_events WHERE entity_id=$1) AS audits",
      [saved.id],
    );
    assert.equal(count.rows[0].events, "1");
    assert.equal(count.rows[0].audits, "1");
    checks++;
    await rejects(
      () =>
        withStaff(tokens[0], (db, s) =>
          receive(db, s, { ...input, weightKg: 3 }, key),
        ),
      409,
    );
    await rejects(
      () =>
        withStaff(tokens[0], (db, s) => receive(db, s, input, randomUUID())),
      409,
    );
    await rejects(
      () =>
        withStaff(tokens[0], (db, s) =>
          receive(
            db,
            s,
            {
              ...input,
              customerId: customers[1],
              trackingNumber: "FOREIGN-123",
            },
            randomUUID(),
          ),
        ),
      404,
    );
    const visible = await withStaff(
      tokens[1],
      async (db) => (await db.query("SELECT * FROM packages")).rows,
    );
    assert.equal(visible.length, 0);
    checks++;
    await assert.rejects(
      () =>
        withStaff(tokens[0], (db) =>
          db.query(
            "INSERT INTO packages(organization_id,customer_id,tracking_number) VALUES ($1,$2,'ILLEGAL')",
            [tenants[1], customers[1]],
          ),
        ),
      (e: unknown) => (e as { code: string }).code === "42501",
    );
    checks++;
    await rejects(() => withStaff(tokens[2], async () => true), 403);
    await rejects(() => withStaff(tokens[3], async () => true), 401);
    await rejects(() => withStaff("0".repeat(64), async () => true), 401);
    await rejects(() => withStaff(undefined, async () => true), 401);
    const context = await pool().query(
      "SELECT current_setting('app.organization_id',true) AS tenant",
    );
    assert.ok(!context.rows[0].tenant);
    checks++;
    const sameTracking = await withStaff(tokens[1], (db, s) =>
      receive(db, s, { ...input, customerId: customers[1] }, randomUUID()),
    );
    assert.notEqual(sameTracking.id, saved.id);
    checks++;
    const retryKey = randomUUID(),
      concurrentInput = { ...input, trackingNumber: "CONCURRENT" };
    const concurrent = await Promise.all(
      [0, 1, 2].map(() =>
        withStaff(tokens[0], (db, s) =>
          receive(db, s, concurrentInput, retryKey),
        ),
      ),
    );
    assert.ok(concurrent.every((p) => p.id === concurrent[0].id));
    checks++;
    await admin.query(
      "INSERT INTO packages(organization_id,customer_id,tracking_number) VALUES ($1,$2,'PREALERT')",
      [tenants[0], customers[0]],
    );
    const expected = await withStaff(tokens[0], (db, s) =>
      receive(db, s, { ...input, trackingNumber: "PREALERT" }, randomUUID()),
    );
    assert.equal(expected.status, "received");
    checks++;
    const races = await Promise.allSettled(
      [0, 1].map(() =>
        withStaff(tokens[0], (db, s) =>
          receive(db, s, { ...input, trackingNumber: "RACE" }, randomUUID()),
        ),
      ),
    );
    assert.equal(races.filter((r) => r.status === "fulfilled").length, 1);
    checks++;
    const failed = await admin.query(
      "SELECT count(*) FROM operation_requests WHERE organization_id=$1 AND status!='completed'",
      [tenants[0]],
    );
    assert.equal(failed.rows[0].count, "0");
    checks++;
    await admin.query("DELETE FROM staff_sessions WHERE token_hash=$1", [
      hashToken(tokens[0]),
    ]);
    await rejects(() => withStaff(tokens[0], async () => true), 401);
    for (const bad of [
      { ...input, weightKg: 0 },
      { ...input, heightCm: 0.0001 },
      { ...input, organizationId: tenants[1] },
      { ...input, trackingNumber: "<script>" },
    ]) {
      assert.throws(() => validateIntake(bad), PilotError);
      checks++;
    }
    console.log(
      `PASS: ${checks} PostgreSQL pilot assertions (persistence, replay, concurrency, RLS, revocation, rollback, validation).`,
    );
  } finally {
    await admin.end();
    await pool().end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
