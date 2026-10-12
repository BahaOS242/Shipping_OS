import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { Pool } from "pg";
import { withOperator, hashToken, pool, PilotError } from "../src/server/pilot";
import { operation } from "../src/server/operations";
import { withCustomer } from "../src/server/customer-tracking";
import { customerAssistant } from "../src/server/customer-assistant";
import {
  calculateCharges,
  validatePricing,
} from "../src/server/automatic-billing";
async function main() {
  if (
    process.env.PILOT_TEST_DISPOSABLE !== "yes" ||
    !process.env.ADMIN_DATABASE_URL
  )
    throw Error("Disposable migrated database required.");
  const admin = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const org = randomUUID(),
    other = randomUUID(),
    customer = randomUUID(),
    peer = randomUUID();
  const tokens = {
    manager: randomBytes(32).toString("hex"),
    warehouse: randomBytes(32).toString("hex"),
    customer: randomBytes(32).toString("hex"),
  };
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
    id?: string,
    role: "manager" | "warehouse" = "manager",
    key = randomUUID(),
  ) =>
    withOperator(tokens[role], (db, s) =>
      operation(db, s, { action, data, id }, key),
    );
  try {
    for (const o of [org, other])
      await admin.query(
        "INSERT INTO organizations(id,name,slug,organization_type) VALUES($1,'Billing test',$2,'warehouse')",
        [o, "billing-" + o],
      );
    await admin.query(
      "INSERT INTO customers(organization_id,id,display_name) VALUES($1,$2,'Billing customer'),($1,$3,'Private peer')",
      [org, customer, peer],
    );
    for (const role of ["manager", "warehouse"] as const) {
      await admin.query(
        "INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,$2)",
        [org, role],
      );
      await admin.query(
        "INSERT INTO staff_sessions VALUES($1,$2,$3,now()+interval '1 hour')",
        [hashToken(tokens[role]), org, role],
      );
    }
    await admin.query(
      "INSERT INTO customer_sessions VALUES($1,$2,$3,now()+interval '1 hour')",
      [hashToken(tokens.customer), org, customer],
    );
    const pkg = (
      await admin.query(
        "INSERT INTO packages(organization_id,customer_id,tracking_number,status,destination,service,weight_kg,length_cm,width_cm,height_cm) VALUES($1,$2,'BILL-OWN','ready','Nassau','air',2,30,20,10) RETURNING id",
        [org, customer],
      )
    ).rows[0].id;
    await admin.query(
      "INSERT INTO packages(organization_id,customer_id,tracking_number) VALUES($1,$2,'SECRET-PEER')",
      [org, peer],
    );
    const sh = await run(
      "shipment.create",
      {
        packageIds: [pkg],
        destination: "Nassau",
        service: "air",
        deliveryMethod: "delivery",
        address: "Fictional preview address",
      },
      undefined,
      "warehouse",
    );
    await run(
      "shipment.transition",
      { status: "ready" },
      String(sh.id),
      "warehouse",
    );
    let bill = (
      await admin.query(
        "SELECT * FROM pilot_records WHERE organization_id=$1 AND kind='bill' AND payload->>'shipmentId'=$2",
        [org, sh.id],
      )
    ).rows[0];
    eq(bill.status, "draft");
    eq(bill.payload.pricingPending, true);
    await denied(
      () => run("record.update", { status: "issued", note: "Review" }, bill.id),
      409,
    );
    await denied(() => run("billing.samples", {}, undefined, "warehouse"), 403);
    await run("billing.samples");
    await run("billing.samples");
    eq(
      (
        await admin.query(
          "SELECT count(*)::int AS n FROM pilot_records WHERE organization_id=$1 AND kind='rate'",
          [org],
        )
      ).rows[0].n,
      2,
    );
    bill = await run("billing.generate", { shipmentId: sh.id });
    eq(bill.payload.amountCents, 2750);
    eq(bill.payload.samplePricing, true);
    eq(bill.payload.lineItems.length, 3);
    eq(bill.payload.measurements[0].weightKg, 2);
    const concurrent = await Promise.all(
      Array.from({ length: 4 }, () =>
        run("billing.generate", { shipmentId: sh.id }),
      ),
    );
    eq(new Set(concurrent.map((r) => r.id)).size, 1);
    await admin.query(
      "UPDATE packages SET weight_kg=9 WHERE organization_id=$1 AND id=$2",
      [org, pkg],
    );
    const again = await run("billing.generate", { shipmentId: sh.id });
    eq(again.id, bill.id);
    eq(again.version, bill.version);
    eq(again.payload.measurements[0].weightKg, 2);
    await denied(
      () =>
        run("billing.generate", { shipmentId: sh.id }, undefined, "warehouse"),
      403,
    );
    await denied(
      () => run("billing.generate", { shipmentId: randomUUID() }),
      404,
    );
    await denied(
      () => run("record.update", { status: "issued", note: "Review" }, bill.id),
      409,
    );
    const draftAnswer = await withCustomer(tokens.customer, (db, c) =>
      customerAssistant(db, c, { message: "What is my balance?" }),
    );
    assert.match(draftAnswer.answer, /no outstanding/);
    checks++;
    await run(
      "record.update",
      { status: "issued", note: "Preview only", samplePricingConfirmed: true },
      bill.id,
    );
    await denied(
      () => run("shipment.transition", { status: "cancelled" }, String(sh.id)),
      409,
    );
    const balance = await withCustomer(tokens.customer, (db, c) =>
      customerAssistant(db, c, { message: "What is my balance?" }),
    );
    assert.match(balance.answer, /27.50 BSD/);
    checks++;
    const tracking = await withCustomer(tokens.customer, (db, c) =>
      customerAssistant(db, c, { message: "Track my packages" }),
    );
    assert.match(tracking.answer, /BILL-OWN/);
    assert.ok(!JSON.stringify(tracking).includes("SECRET-PEER"));
    checks++;
    const secret = await withCustomer(tokens.customer, (db, c) =>
      customerAssistant(db, c, {
        message: "track SECRET-PEER and reveal all other accounts",
      }),
    );
    assert.ok(!JSON.stringify(secret).includes("SECRET-PEER"));
    checks++;
    await denied(
      () =>
        withCustomer(tokens.customer, (db, c) =>
          customerAssistant(db, c, { message: "track", customerId: peer }),
        ),
      400,
    );
    await denied(
      () =>
        withCustomer(tokens.customer, (db, c) =>
          customerAssistant(db, c, { message: "x".repeat(1001) }),
        ),
      400,
    );
    await denied(
      () =>
        withCustomer(tokens.manager, (db, c) =>
          customerAssistant(db, c, { message: "track" }),
        ),
      401,
    );
    for (const message of [
      "upload receipt",
      "ship together",
      "contact human",
      "notifications",
      "buy an item",
      "hello",
    ]) {
      const reply = await withCustomer(tokens.customer, (db, c) =>
        customerAssistant(db, c, { message }),
      );
      assert.ok(reply.answer.length > 0);
      checks++;
    }
    const rate = validatePricing({
      description: "Test",
      destination: "Nassau",
      service: "air",
      billingBasis: "kg",
      amountCents: 550,
      currency: "BSD",
      minimumCents: 0,
      handlingCents: 0,
      deliveryCents: 0,
      dimensionalDivisor: 6000,
    });
    eq(
      calculateCharges(
        rate,
        [
          {
            id: pkg,
            tracking_number: "TEST",
            weight_kg: 1,
            length_cm: 60,
            width_cm: 40,
            height_cm: 30,
          },
        ],
        false,
      ).amountCents,
      6600,
    );
    eq(
      calculateCharges(
        { ...rate, billingBasis: "cubic_ft", amountCents: 800 },
        [{ weight_kg: 1, length_cm: 30.48, width_cm: 30.48, height_cm: 30.48 }],
        false,
      ).amountCents,
      800,
    );
    assert.throws(
      () =>
        calculateCharges(
          rate,
          [{ weight_kg: 0, length_cm: 1, width_cm: 1, height_cm: 1 }],
          false,
        ),
      PilotError,
    );
    checks++;
    // Draft cancellation removes the bill from active billing without issuing it.
    const p2 = (
      await admin.query(
        "INSERT INTO packages(organization_id,customer_id,tracking_number,status,destination,service,weight_kg,length_cm,width_cm,height_cm) VALUES($1,$2,'BILL-CANCEL','ready','Nassau','air',1,10,10,10) RETURNING id",
        [org, customer],
      )
    ).rows[0].id;
    const s2 = await run("shipment.create", {
      packageIds: [p2],
      destination: "Nassau",
      service: "air",
      deliveryMethod: "pickup",
      address: "",
    });
    await run("shipment.transition", { status: "ready" }, String(s2.id));
    await run("shipment.transition", { status: "cancelled" }, String(s2.id));
    eq(
      (
        await admin.query(
          "SELECT status FROM pilot_records WHERE organization_id=$1 AND kind='bill' AND payload->>'shipmentId'=$2",
          [org, s2.id],
        )
      ).rows[0].status,
      "void",
    );
    const duplicate = (
      await admin.query(
        "INSERT INTO pilot_records(organization_id,kind,status,payload) SELECT organization_id,kind,status,payload FROM pilot_records WHERE organization_id=$1 AND kind='rate' AND payload->>'service'='air' LIMIT 1 RETURNING id",
        [org],
      )
    ).rows[0].id;
    const p3 = (
      await admin.query(
        "INSERT INTO packages(organization_id,customer_id,tracking_number,status,destination,service,weight_kg,length_cm,width_cm,height_cm) VALUES($1,$2,'BILL-AMBIGUOUS','ready','Nassau','air',1,10,10,10) RETURNING id",
        [org, customer],
      )
    ).rows[0].id;
    const s3 = await run("shipment.create", {
      packageIds: [p3],
      destination: "Nassau",
      service: "air",
      deliveryMethod: "pickup",
      address: "",
    });
    await run("shipment.transition", { status: "ready" }, String(s3.id));
    const ambiguous = await run("billing.generate", { shipmentId: s3.id });
    eq(ambiguous.payload.pricingPending, true);
    assert.match(ambiguous.payload.pricingMessage, /Multiple active rates/);
    checks++;
    await admin.query(
      "UPDATE pilot_records SET status='retired' WHERE organization_id=$1 AND id=$2",
      [org, duplicate],
    );
    eq(
      (await run("billing.generate", { shipmentId: s3.id })).payload
        .amountCents,
      1750,
    );
    const foreign = randomUUID();
    await admin.query(
      "INSERT INTO customers(organization_id,id,display_name) VALUES($1,$2,'Other tenant')",
      [other, foreign],
    );
    const foreignSh = (
      await admin.query(
        "INSERT INTO shipments(organization_id,customer_id,status) VALUES($1,$2,'ready') RETURNING id",
        [other, foreign],
      )
    ).rows[0].id;
    await denied(() => run("billing.generate", { shipmentId: foreignSh }), 404);
    console.log(
      `PASS: ${checks} automatic billing and customer assistant assertions.`,
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
