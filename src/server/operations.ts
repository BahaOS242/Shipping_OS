import "server-only";
import { generateBill, validatePricing } from "./automatic-billing";
import { randomBytes } from "node:crypto";
import type { PoolClient } from "pg";
import { PilotError, hashToken, type Staff } from "./pilot";
import { validateCustomer } from "./pilot-customers";
export const STAFF_ROLES = [
  "owner",
  "admin",
  "manager",
  "warehouse",
  "customs",
  "accounting",
  "support",
  "driver",
];
const management = ["owner", "admin", "manager"];
const warehouse = [...management, "warehouse"];
const accounting = [...management, "accounting"];
const support = [...management, "support"];
const customs = [...management, "customs"];
const delivery = [...warehouse, "driver"];
export function permit(s: Staff, roles: string[]) {
  if (!roles.includes(s.role))
    throw new PilotError(403, "Your staff role cannot perform this action.");
}
export function object(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v))
    throw new PilotError(400, "Details must be an object.");
  return v as Record<string, unknown>;
}
export function fields(v: Record<string, unknown>, names: string[]) {
  if (Object.keys(v).some((k) => !names.includes(k)))
    throw new PilotError(400, "Unexpected field.");
}
export function text(v: unknown, max = 500, required = false): string {
  if (
    typeof v !== "string" ||
    v.length > max ||
    /[\p{Cc}\p{Cf}]/u.test(v.replace(/\n/g, ""))
  )
    throw new PilotError(400, "Enter valid text.");
  const s = v.trim();
  if (required && !s)
    throw new PilotError(400, "Required details are missing.");
  return s;
}
export function id(v: unknown): string {
  if (
    typeof v !== "string" ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
  )
    throw new PilotError(400, "Invalid record reference.");
  return v.toLowerCase();
}
function integer(v: unknown, min = 0, max = 100000000) {
  if (typeof v !== "number" || !Number.isSafeInteger(v) || v < min || v > max)
    throw new PilotError(400, "Enter a valid whole-number amount.");
  return v;
}
function choice(v: unknown, values: string[]) {
  if (typeof v !== "string" || !values.includes(v))
    throw new PilotError(400, "Choose a valid option.");
  return v;
}
export async function audit(
  db: PoolClient,
  s: Staff,
  type: string,
  entity: string,
  entityId: string,
  details: object = {},
) {
  await db.query(
    "INSERT INTO audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,details) VALUES($1,$2,$3,$4,$5,$6)",
    [
      s.organization_id,
      s.user_id,
      entity,
      entityId,
      type,
      JSON.stringify(details),
    ],
  );
}
export async function notify(
  db: PoolClient,
  tenant: string,
  customer: string,
  title: string,
  message: string,
) {
  await db.query(
    "INSERT INTO pilot_notifications(organization_id,customer_id,title,message) VALUES($1,$2,$3,$4)",
    [tenant, customer, title, message],
  );
  const c = (
    await db.query(
      "SELECT email,email_notifications FROM customers WHERE organization_id=$1 AND id=$2",
      [tenant, customer],
    )
  ).rows[0];
  if (c?.email && c.email_notifications)
    await db.query(
      "INSERT INTO notification_outbox(organization_id,channel,recipient,template_key,payload) VALUES($1,'email',$2,'pilot.update',$3)",
      [
        tenant,
        c.email,
        JSON.stringify({ title, message, customerId: customer }),
      ],
    );
}
async function locked(
  db: PoolClient,
  tenant: string,
  table:
    | "packages"
    | "shipments"
    | "pilot_records"
    | "customers"
    | "pilot_registrations",
  recordId: unknown,
  version?: unknown,
) {
  const row = (
    await db.query(
      `SELECT * FROM ${table} WHERE organization_id=$1 AND id=$2 FOR UPDATE`,
      [tenant, id(recordId)],
    )
  ).rows[0];
  if (!row) throw new PilotError(404, "Record not found.");
  if (version !== undefined && integer(version, 1) !== row.version)
    throw new PilotError(409, "This record changed. Refresh before saving.");
  return row;
}
export async function packageHistory(
  db: PoolClient,
  staff: Staff,
  packageId: string,
) {
  const reference = id(packageId);
  const result = await db.query(
    "SELECT p.id,p.tracking_number,p.status,p.hold_reason,c.display_name FROM packages p JOIN customers c ON c.organization_id=p.organization_id AND c.id=p.customer_id WHERE p.organization_id=$1 AND p.id=$2",
    [staff.organization_id, reference],
  );
  if (!result.rowCount) throw new PilotError(404, "Package not found.");
  const events = await db.query(
    "SELECT id,event_type,from_status,to_status,occurred_at FROM package_events WHERE organization_id=$1 AND package_id=$2 ORDER BY occurred_at DESC,id DESC LIMIT 100",
    [staff.organization_id, reference],
  );
  return { package: result.rows[0], events: events.rows };
}
export async function snapshot(db: PoolClient, s: Staff, q: string = "") {
  if (q.length > 100) throw new PilotError(400, "Search is too long.");
  const term = "%" + q.trim().replace(/[\\%_]/g, "\\$&") + "%";
  const packages = (
    await db.query(
      "SELECT p.*,c.display_name FROM packages p JOIN customers c ON c.organization_id=p.organization_id AND c.id=p.customer_id WHERE p.organization_id=$1 AND (p.tracking_number ILIKE $2 OR p.id::text ILIKE $2 OR c.display_name ILIKE $2 OR p.bin ILIKE $2) ORDER BY p.updated_at DESC,p.id DESC LIMIT 100",
      [s.organization_id, term],
    )
  ).rows;
  const shipments = (
    await db.query(
      "SELECT s.*,c.display_name,coalesce((SELECT jsonb_agg(sp.package_id) FROM shipment_packages sp WHERE sp.organization_id=s.organization_id AND sp.shipment_id=s.id),'[]') AS package_ids FROM shipments s JOIN customers c ON c.organization_id=s.organization_id AND c.id=s.customer_id WHERE s.organization_id=$1 ORDER BY s.updated_at DESC LIMIT 100",
      [s.organization_id],
    )
  ).rows;
  const records = (
    await db.query(
      "SELECT r.*,c.display_name FROM pilot_records r LEFT JOIN customers c ON c.organization_id=r.organization_id AND c.id=r.customer_id WHERE r.organization_id=$1 ORDER BY r.updated_at DESC LIMIT 300",
      [s.organization_id],
    )
  ).rows;
  const summaries = (
    await db.query(
      "SELECT status,count(*)::integer AS count FROM packages WHERE organization_id=$1 GROUP BY status",
      [s.organization_id],
    )
  ).rows;
  const recentAudit = management.includes(s.role)
    ? (
        await db.query(
          "SELECT id,actor_user_id,event_type,entity_type,entity_id,created_at FROM audit_events WHERE organization_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100",
          [s.organization_id],
        )
      ).rows
    : [];
  const outbox = management.includes(s.role)
    ? (
        await db.query(
          "SELECT id,channel,template_key,status,attempts,last_error,created_at FROM notification_outbox WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100",
          [s.organization_id],
        )
      ).rows
    : [];
  const customers = (
    await db.query(
      "SELECT id,display_name,email,phone,email_notifications,version,archived_at FROM customers WHERE organization_id=$1 AND (display_name ILIKE $2 OR email ILIKE $2 OR id::text ILIKE $2) ORDER BY lower(display_name),id LIMIT 100",
      [s.organization_id, term],
    )
  ).rows;
  const files = (
    await db.query(
      "SELECT id,customer_id,package_id,record_id,name,mime_type,created_at FROM pilot_attachments WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 200",
      [s.organization_id],
    )
  ).rows;
  const balances = (
    await db.query(
      "SELECT payload->>'currency' AS currency,sum((payload->>'amountCents')::bigint-coalesce((SELECT sum((p.payload->>'amountCents')::bigint) FROM pilot_records p WHERE p.organization_id=b.organization_id AND p.kind='payment' AND p.status='recorded' AND p.payload->>'billId'=b.id::text),0))::text AS outstanding_cents FROM pilot_records b WHERE organization_id=$1 AND kind='bill' AND status='issued' GROUP BY payload->>'currency'",
      [s.organization_id],
    )
  ).rows;
  const registrations = management.includes(s.role)
    ? (
        await db.query(
          "SELECT id,email,display_name,phone,status,created_at FROM pilot_registrations WHERE organization_id=$1 ORDER BY created_at DESC LIMIT 100",
          [s.organization_id],
        )
      ).rows
    : [];
  return {
    organization: s.name,
    role: s.role,
    customers,
    packages,
    shipments,
    records,
    files,
    registrations,
    summary: summaries,
    balances,
    audit: recentAudit,
    outbox,
  };
}
export async function operation(
  db: PoolClient,
  s: Staff,
  raw: unknown,
  key: string,
) {
  const input = object(raw);
  fields(input, ["action", "id", "version", "data"]);
  const action = text(input.action, 80, true),
    data = object(input.data ?? {}),
    tenant = s.organization_id;
  if (!/^[A-Za-z0-9-]{16,100}$/.test(key))
    throw new PilotError(400, "A request key is required.");
  const requestHash = hashToken(JSON.stringify({ user: s.user_id, input }));
  await db.query(
    "INSERT INTO operation_requests(organization_id,idempotency_key,operation_type,request_hash) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
    [tenant, key, action, requestHash],
  );
  const op = (
    await db.query(
      "SELECT * FROM operation_requests WHERE organization_id=$1 AND idempotency_key=$2 FOR UPDATE",
      [tenant, key],
    )
  ).rows[0];
  if (op.request_hash !== requestHash || op.operation_type !== action)
    throw new PilotError(
      409,
      "Request key already used for different details.",
    );
  if (op.status === "completed")
    return action === "customer.access"
      ? { ...op.result, codeAlreadyIssued: true }
      : op.result;
  let result: Record<string, unknown> = {};
  let privateToken: string | undefined;
  if (action === "identity.review") {
    permit(s, management);
    fields(data, ["status", "identityVerified", "customerId"]);
    const registration = await locked(
      db,
      tenant,
      "pilot_registrations",
      input.id,
    );
    if (registration.status !== "pending")
      throw new PilotError(409, "Registration was already reviewed.");
    const state = choice(data.status, ["approved", "rejected"]);
    let customerId: string | null = null;
    if (state === "approved") {
      if (data.identityVerified !== true)
        throw new PilotError(
          400,
          "Verify the customer identity before approving access.",
        );
      if (data.customerId) {
        const c = await locked(db, tenant, "customers", data.customerId);
        if (c.archived_at) throw new PilotError(409, "Customer is archived.");
        customerId = c.id;
      } else
        customerId = (
          await db.query(
            "INSERT INTO customers(organization_id,display_name,email,phone) VALUES($1,$2,$3,$4) RETURNING id",
            [
              tenant,
              registration.display_name,
              registration.email,
              registration.phone,
            ],
          )
        ).rows[0].id;
      await db.query(
        "INSERT INTO pilot_accounts(organization_id,customer_id,email,password_hash) VALUES($1,$2,$3,$4)",
        [tenant, customerId, registration.email, registration.password_hash],
      );
    }
    result = (
      await db.query(
        "UPDATE pilot_registrations SET status=$3,customer_id=$4 WHERE organization_id=$1 AND id=$2 RETURNING id,status,customer_id",
        [tenant, registration.id, state, customerId],
      )
    ).rows[0];
    await audit(db, s, action, "registration", registration.id, {
      status: state,
    });
  } else if (action === "notification.retry") {
    permit(s, management);
    fields(data, []);
    const row = (
      await db.query(
        "SELECT id,status FROM notification_outbox WHERE organization_id=$1 AND id=$2 FOR UPDATE",
        [tenant, id(input.id)],
      )
    ).rows[0];
    if (!row) throw new PilotError(404, "Notification not found.");
    if (row.status !== "failed")
      throw new PilotError(409, "Only failed notifications can be retried.");
    await db.query(
      "UPDATE notification_outbox SET status='pending',attempts=0,last_error=NULL,available_at=now(),locked_at=NULL,lock_token=NULL WHERE organization_id=$1 AND id=$2",
      [tenant, row.id],
    );
    await audit(db, s, action, "notification", row.id);
    result = { id: row.id, retryQueued: true };
  } else if (action === "customer.update") {
    permit(s, [...warehouse, "support"]);
    fields(data, ["displayName", "email", "phone", "emailNotifications"]);
    const c = await locked(db, tenant, "customers", input.id, input.version);
    if (c.archived_at)
      throw new PilotError(409, "Archived customers cannot be edited.");
    const validated = validateCustomer({
      displayName: data.displayName,
      email: data.email,
      phone: data.phone,
    });
    if (typeof data.emailNotifications !== "boolean")
      throw new PilotError(400, "Choose email notification preference.");
    result = (
      await db.query(
        "UPDATE customers SET display_name=$3,email=$4,phone=$5,email_notifications=$6,version=version+1 WHERE organization_id=$1 AND id=$2 RETURNING id,display_name,email,phone,email_notifications,version",
        [
          tenant,
          c.id,
          validated.displayName,
          validated.email,
          validated.phone,
          data.emailNotifications,
        ],
      )
    ).rows[0];
    if (c.email !== validated.email || !data.emailNotifications)
      await db.query(
        "UPDATE notification_outbox SET status='cancelled' WHERE organization_id=$1 AND payload->>'customerId'=$2 AND status IN ('pending','failed')",
        [tenant, c.id],
      );
    await audit(db, s, action, "customer", c.id);
  } else if (action === "customer.archive") {
    permit(s, management);
    fields(data, []);
    const c = await locked(db, tenant, "customers", input.id, input.version);
    await db.query(
      "DELETE FROM customer_sessions WHERE organization_id=$1 AND customer_id=$2",
      [tenant, c.id],
    );
    result = (
      await db.query(
        "UPDATE customers SET archived_at=now(),email_notifications=false,version=version+1 WHERE organization_id=$1 AND id=$2 RETURNING id,archived_at",
        [tenant, c.id],
      )
    ).rows[0];
    await db.query(
      "UPDATE notification_outbox SET status='cancelled' WHERE organization_id=$1 AND payload->>'customerId'=$2 AND status IN ('pending','failed')",
      [tenant, c.id],
    );
    await audit(db, s, action, "customer", c.id);
  } else if (action === "customer.merge") {
    permit(s, management);
    fields(data, ["targetId"]);
    const sourceId = id(input.id),
      targetId = id(data.targetId);
    if (sourceId === targetId)
      throw new PilotError(400, "Choose another customer.");
    await db.query(
      "SELECT id FROM customers WHERE organization_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE",
      [tenant, [sourceId, targetId]],
    );
    const source = await locked(
        db,
        tenant,
        "customers",
        sourceId,
        input.version,
      ),
      target = await locked(db, tenant, "customers", targetId);
    if (source.archived_at || target.archived_at)
      throw new PilotError(409, "Choose active customers.");
    for (const table of [
      "packages",
      "shipments",
      "pilot_records",
      "pilot_attachments",
      "pilot_notifications",
    ])
      await db.query(
        `UPDATE ${table} SET customer_id=$3 WHERE organization_id=$1 AND customer_id=$2`,
        [tenant, sourceId, targetId],
      );
    await db.query(
      "DELETE FROM customer_sessions WHERE organization_id=$1 AND customer_id=$2",
      [tenant, sourceId],
    );
    await db.query(
      "DELETE FROM pilot_accounts WHERE organization_id=$1 AND customer_id=$2",
      [tenant, sourceId],
    );
    await db.query(
      "UPDATE customers SET archived_at=now(),merged_into=$3,version=version+1 WHERE organization_id=$1 AND id=$2",
      [tenant, sourceId, targetId],
    );
    await db.query(
      "UPDATE notification_outbox SET status='cancelled' WHERE organization_id=$1 AND payload->>'customerId'=$2 AND status IN ('pending','failed')",
      [tenant, sourceId],
    );
    await audit(db, s, action, "customer", sourceId, { targetId });
    result = { id: targetId, merged: true };
  } else if (action === "customer.access") {
    permit(s, [...management, "support"]);
    fields(data, ["revoke"]);
    const c = await locked(db, tenant, "customers", input.id);
    if (c.archived_at) throw new PilotError(409, "Customer is archived.");
    if (typeof data.revoke !== "boolean")
      throw new PilotError(400, "Choose access action.");
    await db.query(
      "DELETE FROM customer_sessions WHERE organization_id=$1 AND customer_id=$2",
      [tenant, c.id],
    );
    result = { customerId: c.id, revoked: true };
    if (!data.revoke) {
      privateToken = randomBytes(32).toString("hex");
      const expires = (
        await db.query(
          "INSERT INTO customer_sessions(token_hash,organization_id,customer_id,expires_at) VALUES($1,$2,$3,now()+interval '8 hours') RETURNING expires_at",
          [hashToken(privateToken), tenant, c.id],
        )
      ).rows[0];
      result = { customerId: c.id, expiresAt: expires.expires_at };
    }
    await audit(db, s, action, "customer", c.id, { revoked: data.revoke });
  } else if (action === "package.update") {
    permit(s, warehouse);
    fields(data, [
      "bin",
      "merchant",
      "itemDescription",
      "destination",
      "service",
      "declaredValueCents",
      "condition",
    ]);
    const p = await locked(db, tenant, "packages", input.id, input.version);
    if (["in_transit", "arrived", "delivered"].includes(p.status))
      throw new PilotError(409, "Package has already left the warehouse.");
    result = (
      await db.query(
        "UPDATE packages SET bin=$3,merchant=$4,item_description=$5,destination=$6,service=$7,declared_value_cents=$8,condition=$9,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *",
        [
          tenant,
          p.id,
          text(data.bin, 80),
          text(data.merchant, 120),
          text(data.itemDescription, 1000),
          text(data.destination, 120, true),
          choice(data.service, ["air", "ocean"]),
          data.declaredValueCents === null
            ? null
            : integer(data.declaredValueCents),
          choice(data.condition, ["good", "damaged"]),
        ],
      )
    ).rows[0];
    await audit(db, s, action, "package", p.id);
  } else if (action === "package.hold") {
    permit(s, [...warehouse, "customs", "support"]);
    fields(data, ["reason"]);
    const p = await locked(db, tenant, "packages", input.id, input.version);
    if (["in_transit", "delivered"].includes(p.status))
      throw new PilotError(
        409,
        "Cannot hold this package at its current stage.",
      );
    const reason = text(data.reason, 500);
    result = (
      await db.query(
        "UPDATE packages SET hold_reason=$3,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *",
        [tenant, p.id, reason || null],
      )
    ).rows[0];
    await audit(db, s, action, "package", p.id, { reason });
    await notify(
      db,
      tenant,
      p.customer_id,
      reason ? "Package on hold" : "Hold released",
      reason || "Your package can continue through processing.",
    );
  } else if (action === "package.transition") {
    permit(s, warehouse);
    fields(data, ["status"]);
    const p = await locked(db, tenant, "packages", input.id, input.version);
    const next = choice(data.status, ["processing", "ready"]);
    if (p.hold_reason)
      throw new PilotError(409, "Release the package hold first.");
    if (!(
      (p.status === "received" && next === "processing") ||
      (p.status === "processing" && next === "ready")
    ))
      throw new PilotError(409, "Invalid package status transition.");
    if (
      next === "ready" &&
      (!p.destination || !p.bin || p.condition === "damaged")
    )
      throw new PilotError(
        409,
        "Record destination/bin and review damage before marking ready.",
      );
    result = (
      await db.query(
        "UPDATE packages SET status=$3,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *",
        [tenant, p.id, next],
      )
    ).rows[0];
    await packageEvent(db, s, p, next);
    await notify(
      db,
      tenant,
      p.customer_id,
      "Package update",
      next === "ready"
        ? "Your package is ready for shipping."
        : "We are preparing your package.",
    );
  } else if (action === "billing.generate") {
    permit(s, accounting);
    fields(data, ["shipmentId"]);
    result = await generateBill(db, tenant, id(data.shipmentId));
    await audit(db, s, action, "bill", String(result.id));
  } else if (action === "billing.samples") {
    permit(s, management);
    fields(data, []);
    await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [
      tenant + ":sample-rates",
    ]);
    for (const service of ["air", "ocean"]) {
      const exists = await db.query(
        "SELECT id FROM pilot_records WHERE organization_id=$1 AND kind='rate' AND customer_id IS NULL AND status='active' AND payload->>'destination'='Nassau' AND payload->>'service'=$2 AND payload->>'pricingVersion'='1'",
        [tenant, service],
      );
      if (exists.rowCount) continue;
      const payload = validatePricing({
        description: `SAMPLE Nassau ${service} pricing — replace before live use`,
        destination: "Nassau",
        service,
        billingBasis: service === "air" ? "kg" : "cubic_ft",
        amountCents: service === "air" ? 550 : 800,
        currency: "BSD",
        minimumCents: service === "air" ? 1500 : 2000,
        handlingCents: service === "air" ? 250 : 300,
        deliveryCents: service === "air" ? 1000 : 1500,
        dimensionalDivisor: 6000,
        samplePricing: true,
      });
      await db.query(
        "INSERT INTO pilot_records(organization_id,kind,status,payload) VALUES($1,'rate','active',$2)",
        [tenant, JSON.stringify(payload)],
      );
    }
    result = { ok: true };
    await audit(db, s, action, "organization", tenant);
  } else if (action === "shipment.create") {
    permit(s, warehouse);
    fields(data, [
      "packageIds",
      "destination",
      "service",
      "deliveryMethod",
      "address",
    ]);
    if (
      !Array.isArray(data.packageIds) ||
      !data.packageIds.length ||
      data.packageIds.length > 100
    )
      throw new PilotError(400, "Select 1–100 packages.");
    const ids = data.packageIds.map(id).sort();
    if (new Set(ids).size !== ids.length)
      throw new PilotError(400, "Duplicate package selection.");
    const packages = (
      await db.query(
        "SELECT * FROM packages WHERE organization_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE",
        [tenant, ids],
      )
    ).rows;
    if (packages.length !== ids.length)
      throw new PilotError(404, "Package not found.");
    const customer = packages[0].customer_id,
      destination = text(data.destination, 120, true),
      service = choice(data.service, ["air", "ocean"]),
      method = choice(data.deliveryMethod, ["pickup", "delivery"]),
      address = text(data.address, 500, method === "delivery");
    if (
      packages.some(
        (p) =>
          p.customer_id !== customer ||
          p.status !== "ready" ||
          p.hold_reason ||
          p.destination !== destination ||
          p.service !== service,
      )
    )
      throw new PilotError(
        409,
        "Select ready, unheld packages for one customer and route.",
      );
    const linked = await db.query(
      "SELECT package_id FROM shipment_packages WHERE organization_id=$1 AND package_id=ANY($2::uuid[])",
      [tenant, ids],
    );
    if (linked.rowCount)
      throw new PilotError(
        409,
        "A selected package is already assigned to a shipment.",
      );
    result = (
      await db.query(
        "INSERT INTO shipments(organization_id,customer_id,destination,service,delivery_method,delivery_address) VALUES($1,$2,$3,$4,$5,$6) RETURNING *",
        [tenant, customer, destination, service, method, address],
      )
    ).rows[0];
    for (const p of packages)
      await db.query("INSERT INTO shipment_packages VALUES($1,$2,$3)", [
        tenant,
        result.id,
        p.id,
      ]);
    await audit(db, s, action, "shipment", result.id as string, {
      packageIds: ids,
    });
    await notify(
      db,
      tenant,
      customer,
      "Shipment created",
      "Your packages have been grouped for shipping.",
    );
  } else if (action === "shipment.customs") {
    permit(s, customs);
    fields(data, ["status", "notes"]);
    const sh = await locked(db, tenant, "shipments", input.id, input.version);
    if (!["draft", "ready", "exception"].includes(sh.status))
      throw new PilotError(409, "Shipment has left the review stage.");
    const state = choice(data.status, ["review", "cleared", "blocked"]),
      notes = text(data.notes, 2000, true);
    if (state === "cleared") {
      const missing = await db.query(
        "SELECT sp.package_id FROM shipment_packages sp WHERE sp.organization_id=$1 AND sp.shipment_id=$2 AND NOT EXISTS(SELECT 1 FROM pilot_records r WHERE r.organization_id=sp.organization_id AND r.customer_id=$3 AND r.kind='receipt' AND r.status='verified' AND r.payload->>'packageId'=sp.package_id::text AND EXISTS(SELECT 1 FROM pilot_attachments f WHERE f.organization_id=r.organization_id AND f.record_id=r.id))",
        [tenant, sh.id, sh.customer_id],
      );
      if (missing.rowCount)
        throw new PilotError(
          409,
          "Verify customer purchase documentation before clearance.",
        );
    }
    result = (
      await db.query(
        "UPDATE shipments SET customs_status=$3,customs_notes=$4,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *",
        [tenant, sh.id, state, notes],
      )
    ).rows[0];
    await audit(db, s, action, "shipment", sh.id, { status: state, notes });
  } else if (action === "shipment.transition") {
    permit(s, delivery);
    fields(data, ["status", "receivedBy", "driver"]);
    const sh = await locked(db, tenant, "shipments", input.id, input.version);
    const next = choice(data.status, [
      "ready",
      "in_transit",
      "arrived",
      "delivered",
      "cancelled",
    ]);
    const paths: Record<string, string[]> = {
      draft: ["ready", "cancelled"],
      ready: ["in_transit", "cancelled"],
      in_transit: ["arrived"],
      arrived: ["delivered"],
    };
    if (!paths[sh.status]?.includes(next))
      throw new PilotError(409, "Invalid shipment status transition.");
    if (s.role === "driver" && !["arrived", "delivered"].includes(next))
      throw new PilotError(403, "Driver role cannot dispatch shipments.");
    if (next === "cancelled") {
      const issued = await db.query(
        "SELECT id FROM pilot_records WHERE organization_id=$1 AND kind='bill' AND status='issued' AND payload->>'source'='automatic' AND payload->>'shipmentId'=$2",
        [tenant, sh.id],
      );
      if (issued.rowCount)
        throw new PilotError(
          409,
          "Reconcile and void the issued shipment bill before cancelling this shipment.",
        );
    }
    const packages = (
      await db.query(
        "SELECT p.* FROM packages p JOIN shipment_packages sp ON sp.organization_id=p.organization_id AND sp.package_id=p.id WHERE sp.organization_id=$1 AND sp.shipment_id=$2 ORDER BY p.id FOR UPDATE OF p",
        [tenant, sh.id],
      )
    ).rows;
    if (
      next === "in_transit" &&
      (sh.customs_status !== "cleared" ||
        packages.some((p) => p.hold_reason || p.status !== "ready"))
    )
      throw new PilotError(
        409,
        "Customs clearance and unheld ready packages are required.",
      );
    const receivedBy = text(data.receivedBy ?? "", 120, next === "delivered"),
      driver = text(data.driver ?? sh.driver, 120);
    result = (
      await db.query(
        "UPDATE shipments SET status=$3,driver=$4,received_by=CASE WHEN $3='delivered' THEN $5 ELSE received_by END,delivered_at=CASE WHEN $3='delivered' THEN now() ELSE delivered_at END,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *",
        [tenant, sh.id, next, driver, receivedBy],
      )
    ).rows[0];
    if (next === "ready") {
      const bill = await generateBill(db, tenant, sh.id);
      await audit(db, s, "billing.draft_generated", "bill", bill.id, {
        shipmentId: sh.id,
      });
    }
    if (next === "cancelled") {
      await db.query(
        "UPDATE pilot_records SET status='void',version=version+1,updated_at=now() WHERE organization_id=$1 AND kind='bill' AND status='draft' AND payload->>'source'='automatic' AND payload->>'shipmentId'=$2",
        [tenant, sh.id],
      );
    }
    if (next === "cancelled")
      await db.query(
        "DELETE FROM shipment_packages WHERE organization_id=$1 AND shipment_id=$2",
        [tenant, sh.id],
      );
    if (["in_transit", "arrived", "delivered"].includes(next))
      for (const p of packages) {
        await db.query(
          "UPDATE packages SET status=$3,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2",
          [tenant, p.id, next],
        );
        await packageEvent(db, s, p, next);
      }
    await audit(db, s, action, "shipment", sh.id, {
      status: next,
      receivedBy,
      driver,
    });
    await notify(
      db,
      tenant,
      sh.customer_id,
      "Shipment update",
      `Shipment is ${next.replaceAll("_", " ")}.`,
    );
  } else if (action === "record.create") {
    const kind = choice(data.kind, [
      "bill",
      "receipt",
      "support",
      "claim",
      "procurement",
      "quote",
      "exception",
      "rate",
      "voyage",
    ]);
    fields(data, ["kind", "customerId", "payload"]);
    const payload = validateRecord(kind, object(data.payload));
    permit(
      s,
      kind === "bill"
        ? accounting
        : ["rate", "voyage"].includes(kind)
          ? management
          : STAFF_ROLES,
    );
    const customer = data.customerId === null ? null : id(data.customerId);
    if (kind === "rate" && payload.pricingVersion === 1 && customer)
      throw new PilotError(
        400,
        "Automatic pricing must be an organization-wide rate.",
      );
    if (!customer && !["rate", "voyage"].includes(kind))
      throw new PilotError(400, "Choose a customer.");
    if (customer) {
      const c = (
        await db.query(
          "SELECT id,archived_at FROM customers WHERE organization_id=$1 AND id=$2",
          [tenant, customer],
        )
      ).rows[0];
      if (!c) throw new PilotError(404, "Customer not found.");
      if (c.archived_at) throw new PilotError(409, "Customer is archived.");
    }
    if (payload.packageId) {
      const packageRow = (
        await db.query(
          "SELECT customer_id FROM packages WHERE organization_id=$1 AND id=$2",
          [tenant, payload.packageId],
        )
      ).rows[0];
      if (!packageRow || packageRow.customer_id !== customer)
        throw new PilotError(404, "Package not found for this customer.");
    }
    const state =
      kind === "bill"
        ? "draft"
        : kind === "procurement"
          ? "requested"
          : ["support", "exception"].includes(kind)
            ? "open"
            : "submitted";
    result = (
      await db.query(
        "INSERT INTO pilot_records(organization_id,customer_id,kind,status,payload) VALUES($1,$2,$3,$4,$5) RETURNING *",
        [tenant, customer, kind, state, JSON.stringify(payload)],
      )
    ).rows[0];
    await audit(db, s, action, kind, result.id as string);
  } else if (action === "quote.offer") {
    permit(s, management);
    fields(data, ["amountCents", "currency", "note"]);
    const r = await locked(
      db,
      tenant,
      "pilot_records",
      input.id,
      input.version,
    );
    if (
      !["quote", "procurement"].includes(r.kind) ||
      !["submitted", "requested"].includes(r.status)
    )
      throw new PilotError(409, "Only new requests can receive an offer.");
    const payload = {
      ...r.payload,
      amountCents: integer(data.amountCents, 1),
      currency: choice(data.currency, ["USD", "BSD"]),
      updates: [
        ...(r.payload.updates ?? []),
        {
          status: "offer",
          note: text(data.note, 2000, true),
          at: new Date().toISOString(),
        },
      ],
    };
    result = (
      await db.query(
        "UPDATE pilot_records SET status=$3,payload=$4,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *",
        [
          tenant,
          r.id,
          r.kind === "quote" ? "offered" : "quoted",
          JSON.stringify(payload),
        ],
      )
    ).rows[0];
    await audit(db, s, action, r.kind, r.id);
    await notify(
      db,
      tenant,
      r.customer_id,
      "Offer ready",
      "Review the price and terms in your customer account before accepting.",
    );
  } else if (action === "record.update") {
    fields(data, ["status", "note", "samplePricingConfirmed"]);
    const r = await locked(
        db,
        tenant,
        "pilot_records",
        input.id,
        input.version,
      ),
      next = text(data.status, 40, true),
      note = text(data.note, 2000, true);
    const transitions: Record<string, Record<string, string[]>> = {
      bill: { draft: ["issued", "void"], issued: ["void"] },
      receipt: { submitted: ["verified", "rejected"], rejected: ["verified"] },
      support: { open: ["waiting", "resolved"], waiting: ["open", "resolved"] },
      claim: {
        submitted: ["review", "rejected"],
        review: ["resolved", "rejected", "waiting"],
        waiting: ["review", "resolved", "rejected"],
      },
      procurement: {
        requested: ["cancelled"],
        quoted: ["cancelled"],
        approved: ["purchased", "cancelled"],
        purchased: ["received"],
        received: ["shipped"],
        shipped: ["delivered"],
      },
      quote: { submitted: ["rejected"], offered: ["rejected"] },
      exception: { open: ["resolved"] },
      rate: { submitted: ["active", "retired"], active: ["retired"] },
      voyage: {
        submitted: ["scheduled", "cancelled"],
        scheduled: ["departed", "cancelled"],
        departed: ["arrived"],
      },
    };
    permit(
      s,
      r.kind === "bill"
        ? accounting
        : r.kind === "receipt"
          ? [...warehouse, "customs", "accounting"]
          : r.kind === "claim" || r.kind === "support"
            ? support
            : r.kind === "procurement" ||
                r.kind === "rate" ||
                r.kind === "voyage"
              ? management
              : warehouse,
    );
    if (!transitions[r.kind]?.[r.status]?.includes(next))
      throw new PilotError(409, "Invalid record status transition.");
    if (r.kind === "bill" && next === "issued") {
      if (
        r.payload.pricingPending ||
        !Number.isSafeInteger(r.payload.amountCents) ||
        r.payload.amountCents <= 0
      )
        throw new PilotError(
          409,
          "Configure pricing and calculate this draft before issuing.",
        );
      if (r.payload.samplePricing && data.samplePricingConfirmed !== true)
        throw new PilotError(
          409,
          "This bill uses sample pricing. Explicitly confirm it is for preview use before issuing.",
        );
    }
    if (r.kind === "bill" && next === "void") {
      const payments = await db.query(
        "SELECT id FROM pilot_records WHERE organization_id=$1 AND kind='payment' AND status='recorded' AND payload->>'billId'=$2",
        [tenant, r.id],
      );
      if (payments.rowCount)
        throw new PilotError(
          409,
          "Record the external refund before voiding a paid bill.",
        );
    }
    const payload = {
      ...r.payload,
      updates: [
        ...(r.payload.updates ?? []),
        { note, status: next, at: new Date().toISOString() },
      ],
    };
    result = (
      await db.query(
        "UPDATE pilot_records SET status=$3,payload=$4,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *",
        [tenant, r.id, next, JSON.stringify(payload)],
      )
    ).rows[0];
    await audit(db, s, action, r.kind, r.id, { status: next, note });
    if (r.customer_id)
      await notify(db, tenant, r.customer_id, `${r.kind} update`, note);
  } else if (action === "payment.refund") {
    permit(s, accounting);
    fields(data, ["reference", "note"]);
    const r = await locked(
      db,
      tenant,
      "pilot_records",
      input.id,
      input.version,
    );
    if (r.kind !== "payment" || r.status !== "recorded")
      throw new PilotError(409, "Only recorded payments can be refunded.");
    const payload = {
      ...r.payload,
      refundReference: text(data.reference, 120, true),
      refundNote: text(data.note, 2000, true),
    };
    result = (
      await db.query(
        "UPDATE pilot_records SET status='refunded',payload=$3,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *",
        [tenant, r.id, JSON.stringify(payload)],
      )
    ).rows[0];
    await audit(db, s, action, "payment", r.id);
    await notify(
      db,
      tenant,
      r.customer_id,
      "Refund recorded",
      "An external refund was recorded for your payment.",
    );
  } else if (action === "payment.record") {
    permit(s, accounting);
    fields(data, ["billId", "amountCents", "method", "reference"]);
    const bill = await locked(db, tenant, "pilot_records", data.billId);
    if (bill.kind !== "bill" || bill.status !== "issued")
      throw new PilotError(409, "Payment requires an issued bill.");
    const amount = integer(data.amountCents, 1),
      method = choice(data.method, ["cash", "bank_transfer", "card_external"]),
      reference = text(data.reference, 120, true);
    const paid = (
      await db.query(
        "SELECT coalesce(sum((payload->>'amountCents')::bigint),0) AS total FROM pilot_records WHERE organization_id=$1 AND kind='payment' AND status='recorded' AND payload->>'billId'=$2",
        [tenant, bill.id],
      )
    ).rows[0];
    const total = bill.payload.amountCents;
    if (amount + Number(paid.total) > total)
      throw new PilotError(
        409,
        "Payment exceeds the outstanding bill balance.",
      );
    const existing = await db.query(
      "SELECT id FROM pilot_records WHERE organization_id=$1 AND kind='payment' AND payload->>'reference'=$2",
      [tenant, reference],
    );
    if (existing.rowCount)
      throw new PilotError(409, "Payment reference was already recorded.");
    result = (
      await db.query(
        "INSERT INTO pilot_records(organization_id,customer_id,kind,status,payload) VALUES($1,$2,'payment','recorded',$3) RETURNING *",
        [
          tenant,
          bill.customer_id,
          JSON.stringify({
            billId: bill.id,
            amountCents: amount,
            method,
            reference,
            currency: bill.payload.currency,
          }),
        ],
      )
    ).rows[0];
    await audit(db, s, action, "payment", result.id as string);
    await notify(
      db,
      tenant,
      bill.customer_id,
      "Payment recorded",
      `A payment of ${(amount / 100).toFixed(2)} ${bill.payload.currency} has been recorded.`,
    );
  } else throw new PilotError(400, "Unknown action.");
  await db.query(
    "UPDATE operation_requests SET status='completed',result=$3,updated_at=now() WHERE organization_id=$1 AND idempotency_key=$2",
    [tenant, key, JSON.stringify(result)],
  );
  return privateToken ? { ...result, token: privateToken } : result;
}
async function packageEvent(
  db: PoolClient,
  s: Staff,
  p: Record<string, unknown>,
  next: string,
) {
  await db.query(
    "INSERT INTO package_events(organization_id,package_id,event_type,from_status,to_status,actor_user_id) VALUES($1,$2,$3,$4,$5,$6)",
    [s.organization_id, p.id, "package." + next, p.status, next, s.user_id],
  );
  await audit(db, s, "package." + next, "package", p.id as string);
}
export function validateRecord(
  kind: string,
  p: Record<string, unknown>,
): Record<string, unknown> {
  if (kind === "bill") {
    fields(p, ["description", "amountCents", "currency", "dueDate"]);
    return {
      description: text(p.description, 500, true),
      amountCents: integer(p.amountCents, 1),
      currency: choice(p.currency, ["USD", "BSD"]),
      dueDate: date(p.dueDate),
    };
  }
  if (kind === "rate") {
    fields(p, [
      "description",
      "amountCents",
      "currency",
      "destination",
      "service",
      "billingBasis",
      "minimumCents",
      "handlingCents",
      "deliveryCents",
      "dimensionalDivisor",
      "samplePricing",
    ]);
    if (p.destination !== undefined)
      return validatePricing(p) as unknown as Record<string, unknown>;
    return {
      description: text(p.description, 500, true),
      amountCents: integer(p.amountCents, 1),
      currency: choice(p.currency, ["USD", "BSD"]),
    };
  }
  if (kind === "voyage") {
    fields(p, ["description", "departure", "destination", "service"]);
    return {
      description: text(p.description, 500, true),
      departure: date(p.departure),
      destination: text(p.destination, 120, true),
      service: choice(p.service, ["air", "ocean"]),
    };
  }
  if (kind === "receipt") {
    fields(p, ["description", "amountCents", "currency", "packageId"]);
    return {
      description: text(p.description, 1000, true),
      amountCents: integer(p.amountCents, 0),
      currency: choice(p.currency, ["USD", "BSD"]),
      packageId: p.packageId ? id(p.packageId) : null,
    };
  }
  fields(p, ["description", "packageId"]);
  return {
    description: text(p.description, 2000, true),
    packageId: p.packageId ? id(p.packageId) : null,
  };
}
function date(v: unknown) {
  const value = text(v, 40, true);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value + "T00:00:00Z")) ||
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value
  )
    throw new PilotError(400, "Choose a valid date.");
  return value;
}
