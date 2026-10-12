import "server-only";
import type { PoolClient } from "pg";
import { hashToken, PilotError, type Staff } from "./pilot";
export type CustomerInput = {
  displayName: string;
  email: string | null;
  phone: string | null;
};
export function validateCustomer(value: unknown): CustomerInput {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new PilotError(400, "Enter customer details.");
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).some((k) => !["displayName", "email", "phone"].includes(k))
  )
    throw new PilotError(400, "Unexpected customer field.");
  if (
    typeof v.displayName !== "string" ||
    /[\p{Cc}\p{Cf}]/u.test(v.displayName)
  )
    throw new PilotError(400, "Enter a customer name.");
  const displayName = v.displayName.trim().replace(/\s+/g, " ");
  if (!displayName || displayName.length > 120)
    throw new PilotError(400, "Customer name must contain 1–120 characters.");
  for (const k of ["email", "phone"])
    if (v[k] !== undefined && v[k] !== null && typeof v[k] !== "string")
      throw new PilotError(400, "Contact details must be text.");
  const email =
    typeof v.email === "string" ? v.email.trim().toLowerCase() || null : null;
  const phone = typeof v.phone === "string" ? v.phone.trim() || null : null;
  if (
    email &&
    (email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      /[\p{Cc}\p{Cf}]/u.test(email))
  )
    throw new PilotError(400, "Enter a valid email address.");
  if (phone && !/^\+[1-9][0-9]{6,14}$/.test(phone))
    throw new PilotError(
      400,
      "Use a phone number with country code, such as +12425550123.",
    );
  return { displayName, email, phone };
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export async function listCustomers(
  db: PoolClient,
  staff: Staff,
  q: string,
  cursor: string | null,
) {
  if (q.length > 100)
    throw new PilotError(400, "Search must be at most 100 characters.");
  let after: { name: string; id: string } | null = null;
  if (cursor) {
    try {
      if (cursor.length > 1000) throw new Error();
      after = JSON.parse(Buffer.from(cursor, "base64url").toString());
      if (
        !after ||
        typeof after.name !== "string" ||
        after.name.length > 1000 ||
        typeof after.id !== "string" ||
        !uuid.test(after.id)
      )
        throw new Error();
    } catch {
      throw new PilotError(400, "Invalid customer page.");
    }
  }
  const search = "%" + q.trim().replace(/[\\%_]/g, "\\$&") + "%";
  const result = await db.query(
    "SELECT id,display_name,email,phone,lower(display_name) AS sort_name FROM customers WHERE organization_id=$1 AND archived_at IS NULL AND (display_name ILIKE $2 OR email ILIKE $2 OR phone ILIKE $2) AND ($3::text IS NULL OR (lower(display_name),id)>($3::text,$4::uuid)) ORDER BY lower(display_name),id LIMIT 26",
    [staff.organization_id, search, after?.name ?? null, after?.id ?? null],
  );
  const page = result.rows.slice(0, 25),
    last = page.at(-1);
  const customers = page.map((row) => ({
    id: row.id,
    display_name: row.display_name,
    email: row.email,
    phone: row.phone,
  }));
  return {
    organization: staff.name,
    customers,
    nextCursor:
      result.rows.length > 25
        ? Buffer.from(
            JSON.stringify({ name: last.sort_name, id: last.id }),
          ).toString("base64url")
        : null,
  };
}
export async function createCustomer(
  db: PoolClient,
  staff: Staff,
  input: CustomerInput,
  key: string,
) {
  if (!/^[a-zA-Z0-9-]{16,100}$/.test(key))
    throw new PilotError(400, "A valid customer request key is required.");
  const tenant = staff.organization_id,
    requestHash = hashToken(JSON.stringify({ user: staff.user_id, input }));
  await db.query(
    "INSERT INTO operation_requests(organization_id,idempotency_key,operation_type,request_hash) VALUES($1,$2,'customer.create',$3) ON CONFLICT DO NOTHING",
    [tenant, key, requestHash],
  );
  const operation = (
    await db.query(
      "SELECT * FROM operation_requests WHERE organization_id=$1 AND idempotency_key=$2 FOR UPDATE",
      [tenant, key],
    )
  ).rows[0];
  if (
    operation.operation_type !== "customer.create" ||
    operation.request_hash !== requestHash
  )
    throw new PilotError(
      409,
      "This request key was already used for different details.",
    );
  if (operation.status === "completed") return operation.result;
  const customer = (
    await db.query(
      "INSERT INTO customers(organization_id,display_name,email,phone) VALUES($1,$2,$3,$4) RETURNING id,display_name,email,phone",
      [tenant, input.displayName, input.email, input.phone],
    )
  ).rows[0];
  await db.query(
    "INSERT INTO audit_events(organization_id,actor_user_id,entity_type,entity_id,event_type,details) VALUES($1,$2,'customer',$3,'customer.created',$4)",
    [
      tenant,
      staff.user_id,
      customer.id,
      JSON.stringify({ idempotencyKey: key }),
    ],
  );
  await db.query(
    "UPDATE operation_requests SET status='completed',result=$3,updated_at=now() WHERE organization_id=$1 AND idempotency_key=$2",
    [tenant, key, JSON.stringify(customer)],
  );
  return customer;
}
