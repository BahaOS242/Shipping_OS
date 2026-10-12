import "server-only";
import type { PoolClient } from "pg";
import { PilotError, hashToken } from "./pilot";
import type { CustomerSession } from "./customer-tracking";
import { fields, object, text, id, validateRecord } from "./operations";
export async function customerSnapshot(db: PoolClient, c: CustomerSession) {
  const tenant = c.organization_id,
    customer = c.customer_id;
  const bills = (
    await db.query(
      "SELECT b.id,b.status,b.payload, CASE WHEN b.status='issued' THEN (b.payload->>'amountCents')::bigint-coalesce((SELECT sum((p.payload->>'amountCents')::bigint) FROM pilot_records p WHERE p.organization_id=b.organization_id AND p.kind='payment' AND p.status='recorded' AND p.payload->>'billId'=b.id::text),0) ELSE 0 END AS balance_cents FROM pilot_records b WHERE b.organization_id=$1 AND b.customer_id=$2 AND b.kind='bill' AND b.status<>'draft' ORDER BY b.created_at DESC LIMIT 100",
      [tenant, customer],
    )
  ).rows;
  return {
    bills,
    customer: c.display_name,
    organization: c.organization_name,
    profile: (
      await db.query(
        "SELECT display_name,email,phone,email_notifications FROM customers WHERE organization_id=$1 AND id=$2",
        [tenant, customer],
      )
    ).rows[0],
    packages: (
      await db.query(
        "SELECT id,tracking_number,status,merchant,item_description,destination,service,hold_reason,weight_kg,updated_at FROM packages WHERE organization_id=$1 AND customer_id=$2 ORDER BY updated_at DESC LIMIT 100",
        [tenant, customer],
      )
    ).rows,
    shipments: (
      await db.query(
        "SELECT id,status,destination,service,delivery_method,delivered_at,received_by FROM shipments WHERE organization_id=$1 AND customer_id=$2 ORDER BY updated_at DESC LIMIT 100",
        [tenant, customer],
      )
    ).rows,
    records: (
      await db.query(
        "SELECT id,kind,status,payload,version,created_at FROM pilot_records WHERE organization_id=$1 AND customer_id=$2 ORDER BY updated_at DESC LIMIT 200",
        [tenant, customer],
      )
    ).rows,
    notifications: (
      await db.query(
        "SELECT * FROM pilot_notifications WHERE organization_id=$1 AND customer_id=$2 ORDER BY created_at DESC LIMIT 100",
        [tenant, customer],
      )
    ).rows,
    files: (
      await db.query(
        "SELECT id,name,mime_type,package_id,record_id,created_at FROM pilot_attachments WHERE organization_id=$1 AND customer_id=$2 ORDER BY created_at DESC LIMIT 100",
        [tenant, customer],
      )
    ).rows,
  };
}
export async function customerAction(
  db: PoolClient,
  c: CustomerSession,
  raw: unknown,
) {
  const input = object(raw);
  fields(input, ["action", "data", "id"]);
  const action = text(input.action, 80, true),
    data = object(input.data ?? {}),
    tenant = c.organization_id,
    customer = c.customer_id;
  if (action === "record.accept") {
    fields(data, ["accepted"]);
    if (typeof data.accepted !== "boolean")
      throw new PilotError(400, "Choose accept or decline.");
    const r = (
      await db.query(
        "SELECT * FROM pilot_records WHERE organization_id=$1 AND customer_id=$2 AND id=$3 FOR UPDATE",
        [tenant, customer, id(input.id)],
      )
    ).rows[0];
    if (!r) throw new PilotError(404, "Offer not found.");
    if (
      !(
        (r.kind === "quote" && r.status === "offered") ||
        (r.kind === "procurement" && r.status === "quoted")
      ) ||
      !r.payload.amountCents
    )
      throw new PilotError(409, "This offer is unavailable.");
    const state = data.accepted
      ? "approved"
      : r.kind === "quote"
        ? "rejected"
        : "cancelled";
    const payload = {
      ...r.payload,
      updates: [
        ...(r.payload.updates ?? []),
        {
          status: state,
          note: data.accepted
            ? "Customer accepted the price and terms."
            : "Customer declined the offer.",
          at: new Date().toISOString(),
        },
      ],
    };
    await db.query(
      "UPDATE pilot_records SET status=$4,payload=$5,version=version+1,updated_at=now() WHERE organization_id=$1 AND customer_id=$2 AND id=$3",
      [tenant, customer, r.id, state, JSON.stringify(payload)],
    );
    return { ok: true };
  }
  if (action === "record.reply") {
    fields(data, ["message"]);
    const r = (
      await db.query(
        "SELECT * FROM pilot_records WHERE organization_id=$1 AND customer_id=$2 AND id=$3 AND kind IN ('support','claim') FOR UPDATE",
        [tenant, customer, id(input.id)],
      )
    ).rows[0];
    if (!r) throw new PilotError(404, "Service request not found.");
    if (["resolved", "rejected"].includes(r.status))
      throw new PilotError(
        409,
        "This request is closed. Open a new request if you need more help.",
      );
    const payload = {
      ...r.payload,
      updates: [
        ...(r.payload.updates ?? []),
        {
          note: text(data.message, 2000, true),
          status: "customer reply",
          at: new Date().toISOString(),
        },
      ],
    };
    await db.query(
      "UPDATE pilot_records SET payload=$4,version=version+1,updated_at=now() WHERE organization_id=$1 AND customer_id=$2 AND id=$3",
      [tenant, customer, r.id, JSON.stringify(payload)],
    );
    return { ok: true };
  }
  if (action === "profile.preferences") {
    fields(data, ["emailNotifications"]);
    if (typeof data.emailNotifications !== "boolean")
      throw new PilotError(400, "Choose email notification preference.");
    await db.query(
      "UPDATE customers SET email_notifications=$3,version=version+1 WHERE organization_id=$1 AND id=$2",
      [tenant, customer, data.emailNotifications],
    );
    if (!data.emailNotifications)
      await db.query(
        "UPDATE notification_outbox SET status='cancelled' WHERE organization_id=$1 AND payload->>'customerId'=$2 AND status IN ('pending','failed')",
        [tenant, customer],
      );
    return { ok: true };
  }
  if (action === "notification.read") {
    fields(data, []);
    const result = await db.query(
      "UPDATE pilot_notifications SET read_at=now() WHERE organization_id=$1 AND customer_id=$2 AND id=$3 RETURNING id",
      [tenant, customer, id(input.id)],
    );
    if (!result.rowCount) throw new PilotError(404, "Notification not found.");
    return { ok: true };
  }
  if (action === "prealert") {
    fields(data, [
      "trackingNumber",
      "merchant",
      "description",
      "destination",
      "service",
    ]);
    const tracking = text(data.trackingNumber, 100, true).toUpperCase();
    if (!/^[A-Z0-9-]{3,100}$/.test(tracking))
      throw new PilotError(400, "Enter a valid tracking number.");
    const service = text(data.service, 20, true);
    if (!["air", "ocean"].includes(service))
      throw new PilotError(400, "Choose air or ocean.");
    const existing = (
      await db.query(
        "SELECT id,customer_id FROM packages WHERE organization_id=$1 AND tracking_number=$2",
        [tenant, tracking],
      )
    ).rows[0];
    if (existing) {
      if (existing.customer_id !== customer)
        throw new PilotError(409, "Tracking number is already registered.");
      return existing;
    }
    const pkg = (
      await db.query(
        "INSERT INTO packages(organization_id,customer_id,tracking_number,status,merchant,item_description,destination,service) VALUES($1,$2,$3,'expected',$4,$5,$6,$7) RETURNING id",
        [
          tenant,
          customer,
          tracking,
          text(data.merchant, 120, true),
          text(data.description, 1000, true),
          text(data.destination, 120, true),
          service,
        ],
      )
    ).rows[0];
    await db.query(
      "INSERT INTO package_events(organization_id,package_id,event_type,to_status) VALUES($1,$2,'package.expected','expected')",
      [tenant, pkg.id],
    );
    return pkg;
  }
  if (action === "record.create") {
    fields(data, ["kind", "payload"]);
    const kind = text(data.kind, 40, true);
    if (!["support", "claim", "procurement", "quote", "receipt"].includes(kind))
      throw new PilotError(403, "Customers cannot create this record type.");
    const payload = validateRecord(kind, object(data.payload));
    if (payload.packageId) {
      const p = await db.query(
        "SELECT id FROM packages WHERE organization_id=$1 AND customer_id=$2 AND id=$3",
        [tenant, customer, id(payload.packageId)],
      );
      if (!p.rowCount) throw new PilotError(404, "Package not found.");
    }
    const state =
      kind === "support"
        ? "open"
        : kind === "procurement"
          ? "requested"
          : "submitted";
    return (
      await db.query(
        "INSERT INTO pilot_records(organization_id,customer_id,kind,status,payload) VALUES($1,$2,$3,$4,$5) RETURNING id,kind,status",
        [tenant, customer, kind, state, JSON.stringify(payload)],
      )
    ).rows[0];
  }
  throw new PilotError(400, "Unknown customer action.");
}

export async function customerOperation(
  db: PoolClient,
  c: CustomerSession,
  raw: unknown,
  key: string,
) {
  if (!/^[A-Za-z0-9-]{16,100}$/.test(key))
    throw new PilotError(400, "A request key is required.");
  const hash = hashToken(JSON.stringify(raw));
  await db.query(
    "INSERT INTO customer_requests(organization_id,customer_id,request_key,request_hash) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING",
    [c.organization_id, c.customer_id, key, hash],
  );
  const op = (
    await db.query(
      "SELECT * FROM customer_requests WHERE organization_id=$1 AND customer_id=$2 AND request_key=$3 FOR UPDATE",
      [c.organization_id, c.customer_id, key],
    )
  ).rows[0];
  if (op.request_hash !== hash)
    throw new PilotError(
      409,
      "Request key already used for different details.",
    );
  if (op.result) return op.result;
  const result = await customerAction(db, c, raw);
  await db.query(
    "UPDATE customer_requests SET result=$4 WHERE organization_id=$1 AND customer_id=$2 AND request_key=$3",
    [c.organization_id, c.customer_id, key, JSON.stringify(result)],
  );
  return result;
}
