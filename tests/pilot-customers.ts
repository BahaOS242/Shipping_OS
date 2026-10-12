import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { Pool } from "pg";
import {
  hashToken,
  PilotError,
  pool,
  withStaff,
  receive,
  validateIntake,
} from "../src/server/pilot";
import { withCustomer } from "../src/server/customer-tracking";
import {
  createCustomer,
  listCustomers,
  validateCustomer,
} from "../src/server/pilot-customers";
async function main() {
  if (
    process.env.PILOT_TEST_DISPOSABLE !== "yes" ||
    !process.env.ADMIN_DATABASE_URL
  )
    throw new Error("Use a disposable migrated database.");
  const admin = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const org = [randomUUID(), randomUUID()],
    token = [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")];
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
        "INSERT INTO organizations(id,name,slug,organization_type) VALUES($1,'Customer test',$2,'warehouse')",
        [org[i], "manage-" + org[i]],
      );
      await admin.query(
        "INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,'receiver','warehouse')",
        [org[i]],
      );
      await admin.query(
        "INSERT INTO staff_sessions VALUES($1,$2,'receiver',now()+interval '1 hour')",
        [hashToken(token[i]), org[i]],
      );
    }
    const input = validateCustomer({
      displayName: "  Customer   Name ",
      email: "CUSTOMER@EXAMPLE.COM",
      phone: "+12425550123",
    });
    assert.equal(input.displayName, "Customer Name");
    assert.equal(input.email, "customer@example.com");
    checks++;
    const key = randomUUID(),
      customer = await withStaff(token[0], (db, s) =>
        createCustomer(db, s, input, key),
      );
    assert.equal(customer.display_name, "Customer Name");
    checks++;
    const replay = await withStaff(token[0], (db, s) =>
      createCustomer(db, s, input, key),
    );
    assert.equal(customer.id, replay.id);
    checks++;
    await rejects(
      () =>
        withStaff(token[0], (db, s) =>
          createCustomer(db, s, { ...input, displayName: "Other" }, key),
        ),
      409,
    );
    const concurrentKey = randomUUID(),
      concurrent = await Promise.all(
        [0, 1, 2].map(() =>
          withStaff(token[0], (db, s) =>
            createCustomer(
              db,
              s,
              { displayName: "Concurrent", email: null, phone: null },
              concurrentKey,
            ),
          ),
        ),
      );
    assert.ok(concurrent.every((c) => c.id === concurrent[0].id));
    checks++;
    const audit = await admin.query(
      "SELECT count(*) FROM audit_events WHERE entity_id=$1 AND event_type='customer.created'",
      [customer.id],
    );
    assert.equal(audit.rows[0].count, "1");
    checks++;
    const email = await withStaff(token[0], (db, s) =>
      listCustomers(db, s, "CUSTOMER@EXAMPLE", null),
    );
    assert.equal(email.customers[0].id, customer.id);
    checks++;
    const phone = await withStaff(token[0], (db, s) =>
      listCustomers(db, s, "5550123", null),
    );
    assert.equal(phone.customers[0].id, customer.id);
    checks++;
    const other = await withStaff(token[1], (db, s) =>
      listCustomers(db, s, "Customer Name", null),
    );
    assert.equal(other.customers.length, 0);
    checks++;
    await withStaff(token[0], (db, s) =>
      createCustomer(
        db,
        s,
        validateCustomer({ displayName: "Literal %_ name" }),
        randomUUID(),
      ),
    );
    const literal = await withStaff(token[0], (db, s) =>
      listCustomers(db, s, "%_", null),
    );
    assert.equal(literal.customers.length, 1);
    checks++;
    for (let i = 0; i < 31; i++)
      await admin.query(
        "INSERT INTO customers(organization_id,display_name) VALUES($1,$2)",
        [org[0], "Paging " + String(i).padStart(2, "0")],
      );
    const first = await withStaff(token[0], (db, s) =>
      listCustomers(db, s, "Paging", null),
    );
    assert.equal(first.customers.length, 25);
    assert.ok(first.nextCursor);
    const second = await withStaff(token[0], (db, s) =>
      listCustomers(db, s, "Paging", first.nextCursor),
    );
    assert.equal(second.customers.length, 6);
    assert.equal(second.nextCursor, null);
    assert.equal(
      new Set([...first.customers, ...second.customers].map((c) => c.id)).size,
      31,
    );
    checks++;
    await rejects(
      () => withStaff(token[0], (db, s) => listCustomers(db, s, "", "invalid")),
      400,
    );
    const pkg = await withStaff(token[0], (db, s) =>
      receive(
        db,
        s,
        validateIntake({
          customerId: customer.id,
          trackingNumber: "NEW-CUSTOMER-" + randomUUID(),
          weightKg: 1,
          lengthCm: 10,
          widthCm: 10,
          heightCm: 10,
        }),
        randomUUID(),
      ),
    );
    assert.equal(pkg.customer_id, customer.id);
    checks++;
    const customerToken = randomBytes(32).toString("hex");
    await admin.query(
      "INSERT INTO customer_sessions VALUES($1,$2,$3,now()+interval '1 hour')",
      [hashToken(customerToken), org[0], customer.id],
    );
    await assert.rejects(
      () =>
        withCustomer(customerToken, (db) =>
          db.query(
            "INSERT INTO customers(organization_id,display_name) VALUES($1,'FORGED')",
            [org[0]],
          ),
        ),
      (e: unknown) => (e as { code: string }).code === "42501",
    );
    checks++;
    const rollbackName = "Rollback-" + randomUUID();
    await assert.rejects(() =>
      withStaff(token[0], async (db, s) => {
        await createCustomer(
          db,
          s,
          validateCustomer({ displayName: rollbackName }),
          randomUUID(),
        );
        throw new Error("rollback");
      }),
    );
    const rollback = await admin.query(
      "SELECT count(*) FROM customers WHERE display_name=$1",
      [rollbackName],
    );
    assert.equal(rollback.rows[0].count, "0");
    checks++;
    for (const bad of [
      { displayName: "" },
      { displayName: "Name", organizationId: org[1] },
      { displayName: "Name", email: "wrong" },
      { displayName: "Name", phone: "555" },
      { displayName: "Name\nother" },
      [],
    ]) {
      assert.throws(() => validateCustomer(bad), PilotError);
      checks++;
    }
    console.log(
      `PASS: ${checks} customer management assertions (creation/audit, replay, concurrency, isolation, contact search, literal search, pagination, intake, customer write denial and rollback).`,
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
