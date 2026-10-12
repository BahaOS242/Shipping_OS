import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { Pool } from "pg";
import {
  withOperator,
  withStaff,
  pool,
  hashToken,
  PilotError,
  receive,
  validateIntake,
} from "../src/server/pilot";
import { operation, snapshot, packageHistory } from "../src/server/operations";
import {
  createCustomer,
  validateCustomer,
} from "../src/server/pilot-customers";
import {
  withCustomer,
  tracking as customerTracking,
} from "../src/server/customer-tracking";
import {
  customerOperation,
  customerSnapshot,
} from "../src/server/customer-workspace";
import { exportRows, csvCell } from "../src/server/exports";
import { addFile } from "../src/server/attachments";
import { register, login, rateLimit } from "../src/server/identity";
import { deliverBatch } from "../src/server/notification-worker";
async function main() {
  if (
    process.env.PILOT_TEST_DISPOSABLE !== "yes" ||
    !process.env.ADMIN_DATABASE_URL ||
    !process.env.WORKER_DATABASE_URL
  )
    throw new Error("Disposable database and restricted worker required.");
  const admin = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL }),
    worker = new Pool({ connectionString: process.env.WORKER_DATABASE_URL });
  const org = [randomUUID(), randomUUID()],
    tokens: Record<string, string> = {};
  let checks = 0;
  const eq = (a: unknown, b: unknown) => {
    assert.deepEqual(a, b);
    checks++;
  };
  const denied = async (fn: () => Promise<unknown>, status: number) => {
    await assert.rejects(
      fn,
      (e: unknown) => e instanceof PilotError && e.status === status,
    );
    checks++;
  };
  const run = (
    action: string,
    data: object = {},
    id?: unknown,
    role = "manager",
    version?: number,
    key = randomUUID(),
  ) =>
    withOperator(tokens[role], (db, s) =>
      operation(
        db,
        s,
        {
          action,
          data,
          ...(id ? { id } : {}),
          ...(version ? { version } : {}),
        },
        key,
      ),
    );
  try {
    for (const o of org)
      await admin.query(
        "INSERT INTO organizations(id,name,slug,organization_type) VALUES($1,'Operations test',$2,'warehouse')",
        [o, "ops-" + o],
      );
    for (const role of [
      "manager",
      "warehouse",
      "customs",
      "accounting",
      "support",
      "driver",
      "foreign",
    ]) {
      const t = randomBytes(32).toString("hex");
      tokens[role] = t;
      const o = role === "foreign" ? org[1] : org[0];
      await admin.query(
        "INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,$3)",
        [o, role, role === "foreign" ? "manager" : role],
      );
      await admin.query(
        "INSERT INTO staff_sessions VALUES($1,$2,$3,now()+interval '1 hour')",
        [hashToken(t), o, role],
      );
    }
    const customer = await withStaff(tokens.manager, (db, s) =>
      createCustomer(
        db,
        s,
        validateCustomer({
          displayName: "Pilot Customer",
          email: "pilot@example.com",
        }),
        randomUUID(),
      ),
    );
    const other = await withStaff(tokens.manager, (db, s) =>
      createCustomer(
        db,
        s,
        validateCustomer({
          displayName: "Other Customer",
          email: "other@example.com",
        }),
        randomUUID(),
      ),
    );
    await denied(() => withStaff(tokens.driver, async () => {}), 403);
    await denied(
      () => run("customer.archive", {}, customer.id, "warehouse"),
      403,
    );
    await denied(
      () =>
        run(
          "customer.update",
          {
            displayName: "Changed",
            email: "pilot@example.com",
            phone: null,
            emailNotifications: true,
          },
          customer.id,
          "foreign",
        ),
      404,
    );
    const c = await run(
      "customer.update",
      {
        displayName: "Pilot Customer",
        email: "pilot@example.com",
        phone: null,
        emailNotifications: true,
      },
      customer.id,
      "manager",
      1,
    );
    eq(c.version, 2);
    await denied(
      () =>
        run(
          "customer.update",
          {
            displayName: "Lost edit",
            email: "pilot@example.com",
            phone: null,
            emailNotifications: true,
          },
          customer.id,
          "manager",
          1,
        ),
      409,
    );
    const accessKey = randomUUID(),
      access = await run(
        "customer.access",
        { revoke: false },
        customer.id,
        "manager",
        undefined,
        accessKey,
      );
    assert.equal(typeof access.token, "string");
    checks++;
    const replay = await run(
      "customer.access",
      { revoke: false },
      customer.id,
      "manager",
      undefined,
      accessKey,
    );
    eq(replay.token, undefined);
    eq(replay.codeAlreadyIssued, true);
    let ct = access.token as string;
    const cust = (
      action: string,
      data: object = {},
      id?: unknown,
      key = randomUUID(),
    ) =>
      withCustomer(ct, (db, s) =>
        customerOperation(db, s, { action, data, ...(id ? { id } : {}) }, key),
      );
    const prekey = randomUUID(),
      pre = await cust(
        "prealert",
        {
          trackingNumber: "OP-" + randomUUID(),
          merchant: "Shop",
          description: "Shoes",
          destination: "Nassau",
          service: "air",
        },
        undefined,
        prekey,
      );
    eq(
      (await withCustomer(ct, (db, s) => customerSnapshot(db, s))).packages
        .length,
      1,
    );
    await denied(
      () => cust("record.create", { kind: "bill", payload: {} }),
      403,
    );
    await denied(
      () =>
        cust("record.create", {
          kind: "receipt",
          payload: {
            description: "Invoice",
            amountCents: 1000,
            currency: "USD",
            packageId: randomUUID(),
          },
        }),
      404,
    );
    const tracking = (
      await admin.query("SELECT tracking_number FROM packages WHERE id=$1", [
        pre.id,
      ])
    ).rows[0].tracking_number;
    const intake = await withStaff(tokens.warehouse, (db, s) =>
      receive(
        db,
        s,
        validateIntake({
          customerId: customer.id,
          trackingNumber: tracking,
          weightKg: 2,
          lengthCm: 20,
          widthCm: 20,
          heightCm: 10,
        }),
        randomUUID(),
      ),
    );
    eq(intake.status, "received");
    const history = await withOperator(tokens.warehouse, (db, s) =>
      packageHistory(db, s, intake.id),
    );
    eq(history.package.id, intake.id);
    eq(history.events[0].to_status, "received");
    await denied(
      () =>
        withOperator(tokens.foreign, (db, s) =>
          packageHistory(db, s, intake.id),
        ),
      404,
    );
    await denied(
      () =>
        withOperator(tokens.warehouse, (db, s) =>
          packageHistory(db, s, "invalid"),
        ),
      400,
    );

    let p = await run(
      "package.update",
      {
        bin: "A-01",
        merchant: "Shop",
        itemDescription: "Shoes",
        destination: "Nassau",
        service: "air",
        declaredValueCents: 1000,
        condition: "good",
      },
      pre.id,
      "warehouse",
    );
    await denied(
      () => run("package.transition", { status: "ready" }, p.id, "warehouse"),
      409,
    );
    await run("package.hold", { reason: "Review" }, p.id, "support");
    eq(
      (await withCustomer(ct, (db, c) => customerTracking(db, c, p.id))).package
        .on_hold,
      true,
    );
    await denied(
      () =>
        run("package.transition", { status: "processing" }, p.id, "warehouse"),
      409,
    );
    await run("package.hold", { reason: "" }, p.id, "customs");
    await run(
      "package.transition",
      { status: "processing" },
      p.id,
      "warehouse",
    );
    p = await run("package.transition", { status: "ready" }, p.id, "warehouse");
    const customerReady = await withCustomer(ct, (db, c) =>
      customerTracking(db, c, p.id),
    );
    eq(customerReady.package.status, "ready");
    eq(customerReady.package.on_hold, false);
    eq(customerReady.events?.[0]?.to_status, "ready");
    eq(p.status, "ready");
    const sh = await run(
      "shipment.create",
      {
        packageIds: [p.id],
        destination: "Nassau",
        service: "air",
        deliveryMethod: "delivery",
        address: "Test address",
      },
      undefined,
      "warehouse",
    );
    await denied(
      () =>
        run("shipment.create", {
          packageIds: [p.id],
          destination: "Nassau",
          service: "air",
          deliveryMethod: "pickup",
          address: "",
        }),
      409,
    );
    await denied(
      () =>
        run(
          "shipment.customs",
          { status: "cleared", notes: "Checked" },
          sh.id,
          "customs",
        ),
      409,
    );
    const receipt = await cust("record.create", {
      kind: "receipt",
      payload: {
        description: "Purchase invoice",
        amountCents: 1000,
        currency: "USD",
        packageId: p.id,
      },
    });
    const form = new FormData();
    form.set(
      "file",
      new File(["%PDF-1.7\nTest invoice"], "invoice.pdf", {
        type: "application/pdf",
      }),
    );
    form.set("recordId", receipt.id);
    form.set("packageId", p.id);
    const f = await withCustomer(ct, (db, s) =>
      addFile(db, s.organization_id, s.customer_id, form),
    );
    eq(f.mime_type, "application/pdf");
    const bad = new FormData();
    bad.set("file", new File(["<svg/>"], "fake.png", { type: "image/png" }));
    await denied(
      () =>
        withCustomer(ct, (db, s) =>
          addFile(db, s.organization_id, s.customer_id, bad),
        ),
      400,
    );
    await run(
      "record.update",
      { status: "verified", note: "Original checked" },
      receipt.id,
      "customs",
    );
    await run(
      "shipment.customs",
      { status: "cleared", notes: "Documents verified" },
      sh.id,
      "customs",
    );
    await run("shipment.transition", { status: "ready" }, sh.id, "warehouse");
    await denied(
      () =>
        run("shipment.transition", { status: "in_transit" }, sh.id, "driver"),
      403,
    );
    await run(
      "shipment.transition",
      { status: "in_transit" },
      sh.id,
      "warehouse",
    );
    await run("shipment.transition", { status: "arrived" }, sh.id, "driver");
    await denied(
      () =>
        run(
          "shipment.transition",
          { status: "delivered", receivedBy: "" },
          sh.id,
          "driver",
        ),
      400,
    );
    eq(
      (
        await run(
          "shipment.transition",
          {
            status: "delivered",
            receivedBy: "Customer",
            driver: "Pilot Driver",
          },
          sh.id,
          "driver",
        )
      ).status,
      "delivered",
    );
    eq(
      (await withCustomer(ct, (db, s) => customerSnapshot(db, s))).packages[0]
        .status,
      "delivered",
    );
    await denied(
      () =>
        run(
          "record.create",
          {
            kind: "bill",
            customerId: customer.id,
            payload: {
              description: "Freight",
              amountCents: 2000,
              currency: "BSD",
              dueDate: "2026-12-31",
            },
          },
          undefined,
          "warehouse",
        ),
      403,
    );
    const bill = await run(
      "record.create",
      {
        kind: "bill",
        customerId: customer.id,
        payload: {
          description: "Freight",
          amountCents: 2000,
          currency: "BSD",
          dueDate: "2026-12-31",
        },
      },
      undefined,
      "accounting",
    );
    eq(
      (
        await withCustomer(ct, (db) =>
          db.query("SELECT id FROM pilot_records WHERE id=$1", [bill.id]),
        )
      ).rowCount,
      0,
    );
    await denied(
      () =>
        run(
          "payment.record",
          {
            billId: bill.id,
            amountCents: 1000,
            method: "cash",
            reference: "pending",
          },
          undefined,
          "accounting",
        ),
      409,
    );
    await run(
      "record.update",
      { status: "issued", note: "Invoice issued" },
      bill.id,
      "accounting",
    );
    const paykey = randomUUID(),
      paydata = {
        billId: bill.id,
        amountCents: 1000,
        method: "cash",
        reference: randomUUID(),
      };
    const pay = await run(
      "payment.record",
      paydata,
      undefined,
      "accounting",
      undefined,
      paykey,
    );
    eq(
      (
        await run(
          "payment.record",
          paydata,
          undefined,
          "accounting",
          undefined,
          paykey,
        )
      ).id,
      pay.id,
    );
    await denied(
      () => run("payment.record", paydata, undefined, "accounting"),
      409,
    );
    await denied(
      () =>
        run(
          "payment.record",
          { ...paydata, reference: randomUUID(), amountCents: 1001 },
          undefined,
          "accounting",
        ),
      409,
    );
    eq(
      String(
        (await withCustomer(ct, (db, s) => customerSnapshot(db, s))).bills[0]
          .balance_cents,
      ),
      "1000",
    );
    await denied(
      () =>
        run(
          "record.update",
          { status: "void", note: "Cancel" },
          bill.id,
          "accounting",
        ),
      409,
    );
    await run(
      "payment.refund",
      { reference: randomUUID(), note: "External refund confirmed" },
      pay.id,
      "accounting",
    );
    eq(
      String(
        (await withCustomer(ct, (db, s) => customerSnapshot(db, s))).bills[0]
          .balance_cents,
      ),
      "2000",
    );
    await run(
      "record.update",
      { status: "void", note: "Refund complete" },
      bill.id,
      "accounting",
    );
    const ticket = await cust("record.create", {
      kind: "support",
      payload: { description: "Where is my shipment?", packageId: p.id },
    });
    await cust("record.reply", { message: "Additional details" }, ticket.id);
    await run(
      "record.update",
      { status: "resolved", note: "Delivered today" },
      ticket.id,
      "support",
    );
    await denied(
      () => cust("record.reply", { message: "More" }, ticket.id),
      409,
    );
    for (const kind of ["claim", "procurement", "quote"]) {
      const r = await cust("record.create", {
        kind,
        payload: { description: "Pilot request", packageId: p.id },
      });
      eq(r.kind, kind);
    }
    for (const kind of ["quote", "procurement"]) {
      const request = await cust("record.create", {
        kind,
        payload: { description: "Price required" },
      });
      await run(
        "quote.offer",
        { amountCents: 4500, currency: "BSD", note: "All fees included" },
        request.id,
      );
      await denied(
        () =>
          run(
            "record.update",
            { status: "approved", note: "Unsafe approval" },
            request.id,
          ),
        409,
      );
      await cust("record.accept", { accepted: true }, request.id);
      eq(
        (
          await admin.query("SELECT status FROM pilot_records WHERE id=$1", [
            request.id,
          ])
        ).rows[0].status,
        "approved",
      );
      await denied(
        () => cust("record.accept", { accepted: true }, request.id),
        404,
      );
    }
    const rate = await run("record.create", {
      kind: "rate",
      customerId: null,
      payload: { description: "Pilot rate", amountCents: 500, currency: "BSD" },
    });
    await run(
      "record.update",
      { status: "active", note: "Published" },
      rate.id,
    );
    eq(
      (
        await run(
          "record.update",
          { status: "retired", note: "Replaced" },
          rate.id,
        )
      ).status,
      "retired",
    );
    const voyage = await run("record.create", {
      kind: "voyage",
      customerId: null,
      payload: {
        description: "Pilot sailing",
        departure: "2026-12-31",
        destination: "Nassau",
        service: "ocean",
      },
    });
    for (const status of ["scheduled", "departed", "arrived"])
      await run(
        "record.update",
        { status, note: "Operations confirmed" },
        voyage.id,
      );
    checks++;
    const manifest = await withOperator(tokens.warehouse, (db, s) =>
      exportRows(db, s, "manifest", sh.id),
    );
    assert.ok(manifest.includes(tracking));
    checks++;
    await denied(
      () =>
        withOperator(tokens.driver, (db, s) =>
          exportRows(db, s, "billing", null),
        ),
      403,
    );
    eq(csvCell("=SUM(1,2)"), '"\'=SUM(1,2)"');
    const otherAccess = await run(
      "customer.access",
      { revoke: false },
      other.id,
    );
    await denied(
      () =>
        withCustomer(otherAccess.token as string, (db, s) =>
          customerOperation(
            db,
            s,
            {
              action: "record.reply",
              id: ticket.id,
              data: { message: "Foreign" },
            },
            randomUUID(),
          ),
        ),
      404,
    );
    eq(
      (
        await withCustomer(otherAccess.token as string, (db) =>
          db.query("SELECT id FROM pilot_attachments WHERE id=$1", [f.id]),
        )
      ).rowCount,
      0,
    );
    eq(
      (await withOperator(tokens.foreign, (db, s) => snapshot(db, s))).packages
        .length,
      0,
    );
    const notifications = (
      await withCustomer(ct, (db, s) => customerSnapshot(db, s))
    ).notifications;
    assert.ok(notifications.length > 0);
    checks++;
    await cust("notification.read", {}, notifications[0].id);
    eq(
      (
        await admin.query(
          "SELECT read_at IS NOT NULL AS read FROM pilot_notifications WHERE id=$1",
          [notifications[0].id],
        )
      ).rows[0].read,
      true,
    );
    await cust("profile.preferences", { emailNotifications: false });
    eq(
      (
        await admin.query(
          "SELECT count(*) FROM notification_outbox WHERE organization_id=$1 AND status IN ('pending','failed')",
          [org[0]],
        )
      ).rows[0].count,
      "0",
    );
    const email = "approved-" + randomUUID() + "@example.com",
      password = "Correct password 123";
    await register({
      organization: "ops-" + org[0],
      displayName: "Registered",
      email,
      phone: null,
      password,
    });
    await denied(
      () => login({ organization: "ops-" + org[0], email, password }),
      401,
    );
    const reg = (
      await admin.query("SELECT id FROM pilot_registrations WHERE email=$1", [
        email,
      ])
    ).rows[0];
    await denied(
      () =>
        run(
          "identity.review",
          { status: "approved", identityVerified: false },
          reg.id,
        ),
      400,
    );
    await run(
      "identity.review",
      { status: "approved", identityVerified: true },
      reg.id,
    );
    const signed = await login({
      organization: "ops-" + org[0],
      email,
      password,
    });
    eq(
      (await withCustomer(signed.token, (db, s) => customerSnapshot(db, s)))
        .customer,
      "Registered",
    );
    await denied(
      () =>
        login({ organization: "ops-" + org[0], email, password: "incorrect" }),
      401,
    );
    const limitKey = randomUUID();
    await rateLimit(limitKey, 1);
    await denied(() => rateLimit(limitKey, 1), 429);
    await run("customer.access", { revoke: true }, customer.id);
    await denied(() => withCustomer(ct, async () => {}), 401);
    ct = (await run("customer.access", { revoke: false }, customer.id))
      .token as string;
    await run("customer.merge", { targetId: other.id }, customer.id);
    await denied(() => withCustomer(ct, async () => {}), 401);
    eq(
      (
        await admin.query("SELECT customer_id FROM packages WHERE id=$1", [
          p.id,
        ])
      ).rows[0].customer_id,
      other.id,
    );
    await run("customer.archive", {}, other.id);
    await denied(
      () => withCustomer(otherAccess.token as string, async () => {}),
      401,
    );
    // Synthetic provider callbacks: no email or other external delivery occurs.
    const jobs = [];
    for (let i = 0; i < 3; i++)
      jobs.push(
        (
          await admin.query(
            "INSERT INTO notification_outbox(organization_id,channel,recipient,template_key,payload) VALUES($1,'email','test@example.com','pilot.update',$2) RETURNING id",
            [org[0], JSON.stringify({ title: "Test", message: "Test" })],
          )
        ).rows[0].id,
      );
    await admin.query(
      "UPDATE notification_outbox SET status='cancelled' WHERE id<>ALL($1::uuid[]) AND status IN ('pending','failed','sending')",
      [jobs],
    );
    const seen = new Set<string>();
    const batches = await Promise.all(
      [0, 1].map(() =>
        deliverBatch(
          worker,
          async (j) => {
            assert.ok(!seen.has(j.id));
            seen.add(j.id);
            return "mock-" + j.id;
          },
          2,
        ),
      ),
    );
    eq(
      batches.reduce((n, b) => n + b.sent, 0),
      3,
    );
    eq(seen.size, 3);
    const failed = (
      await admin.query(
        "INSERT INTO notification_outbox(organization_id,channel,recipient,template_key,payload) VALUES($1,'email','test@example.com','pilot.update','{}') RETURNING id",
        [org[0]],
      )
    ).rows[0];
    eq(
      (
        await deliverBatch(worker, async () => {
          throw new Error("secret SMTP response");
        })
      ).failed,
      1,
    );
    const failure = (
      await admin.query(
        "SELECT status,last_error,available_at>now() AS delayed FROM notification_outbox WHERE id=$1",
        [failed.id],
      )
    ).rows[0];
    eq(failure.status, "failed");
    eq(failure.delayed, true);
    assert.ok(!failure.last_error.includes("secret"));
    checks++;
    await run("notification.retry", {}, failed.id);
    eq(
      (
        await admin.query(
          "SELECT attempts,status FROM notification_outbox WHERE id=$1",
          [failed.id],
        )
      ).rows[0],
      { attempts: 0, status: "pending" },
    );
    await admin.query(
      "UPDATE notification_outbox SET status='sending',attempts=8,locked_at=now()-interval '6 minutes' WHERE id=$1",
      [failed.id],
    );
    eq((await deliverBatch(worker, async () => "unused")).claimed, 0);
    eq(
      (
        await admin.query(
          "SELECT status,last_error FROM notification_outbox WHERE id=$1",
          [failed.id],
        )
      ).rows[0],
      { status: "failed", last_error: "Delivery attempts exhausted" },
    );
    await run("notification.retry", {}, failed.id);
    eq((await deliverBatch(worker, async () => "mock-retry")).sent, 1);
    await assert.rejects(() => deliverBatch(pool(), async () => ""));
    checks++;
    console.log(
      `PASS: ${checks} operations assertions: end-to-end shipment, customs documents, billing/refunds, role and tenant isolation, customer workflows, identity, revocation, merge, notification concurrency and backoff.`,
    );
  } finally {
    await admin.end();
    await worker.end();
    await pool().end();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
