import "server-only";
import { createHash } from "node:crypto";
import { Pool, type PoolClient } from "pg";

export class PilotError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const globalPg = globalThis as unknown as { pilotPool?: Pool };
export function pool() {
  if (!process.env.DATABASE_URL)
    throw new PilotError(503, "Pilot database is not configured.");
  return (globalPg.pilotPool ??= new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  }));
}
export const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export type Staff = {
  organization_id: string;
  user_id: string;
  role: string;
  name: string;
  expires_at: Date;
};
export async function withTokenTransaction<T>(
  token: string | undefined,
  work: (db: PoolClient, verifiedToken: string) => Promise<T>,
): Promise<T> {
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
    throw new PilotError(401, "Sign in with a valid access code.");
  const db = await pool().connect();
  try {
    await db.query("BEGIN");
    await db.query("SET LOCAL statement_timeout = '10s'");
    const role = await db.query(
      "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user",
    );
    if (role.rows[0].rolsuper || role.rows[0].rolbypassrls)
      throw new PilotError(
        503,
        "Pilot requires restricted database credentials.",
      );
    await db.query("SELECT set_config('app.session_hash',$1,true)", [
      hashToken(token),
    ]);
    await db.query(
      "SELECT set_config('app.organization_id','',true), set_config('app.user_id','',true), set_config('app.customer_id','',true),set_config('app.actor_type','',true)",
    );
    const result = await work(db, token);
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}
export async function withStaff<T>(
  token: string | undefined,
  work: (db: PoolClient, staff: Staff) => Promise<T>,
): Promise<T> {
  return withTokenTransaction(token, async (db, verifiedToken) => {
    const session = await db.query(
      "SELECT organization_id, user_id, expires_at FROM staff_sessions WHERE token_hash=$1 AND expires_at > now()",
      [hashToken(verifiedToken)],
    );
    if (!session.rowCount)
      throw new PilotError(
        401,
        "Your staff session has expired or was revoked.",
      );
    const s = session.rows[0];
    await db.query(
      "SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true)",
      [s.organization_id, s.user_id],
    );
    const member = await db.query(
      "SELECT m.role, o.name FROM organization_members m JOIN organizations o ON o.id=m.organization_id WHERE m.organization_id=$1 AND m.user_id=$2",
      [s.organization_id, s.user_id],
    );
    if (
      !member.rowCount ||
      !["owner", "admin", "manager", "warehouse"].includes(member.rows[0].role)
    )
      throw new PilotError(403, "Warehouse staff access is required.");
    await db.query("SELECT set_config('app.actor_type','staff',true)");
    return work(db, { ...s, ...member.rows[0] });
  });
}
export type Intake = {
  customerId: string;
  trackingNumber: string;
  weightKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function validateIntake(value: unknown): Intake {
  if (!value || typeof value !== "object")
    throw new PilotError(400, "Enter package details.");
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).some(
      (k) =>
        ![
          "customerId",
          "trackingNumber",
          "weightKg",
          "lengthCm",
          "widthCm",
          "heightCm",
        ].includes(k),
    )
  )
    throw new PilotError(400, "Unexpected package field.");
  if (typeof v.customerId !== "string" || !uuid.test(v.customerId))
    throw new PilotError(400, "Choose a customer.");
  if (
    typeof v.trackingNumber !== "string" ||
    !/^[A-Za-z0-9-]{3,100}$/.test(v.trackingNumber.trim())
  )
    throw new PilotError(
      400,
      "Tracking number must contain 3–100 letters, numbers or hyphens.",
    );
  for (const k of ["weightKg", "lengthCm", "widthCm", "heightCm"]) {
    if (
      typeof v[k] !== "number" ||
      !Number.isFinite(v[k]) ||
      (v[k] as number) <= 0 ||
      (v[k] as number) > 10000
    )
      throw new PilotError(
        400,
        "Weight and dimensions must be greater than zero and at most 10,000.",
      );
  }
  if (
    Number((v.weightKg as number).toFixed(3)) <= 0 ||
    ["lengthCm", "widthCm", "heightCm"].some(
      (k) => Number((v[k] as number).toFixed(2)) <= 0,
    )
  )
    throw new PilotError(400, "Measurements are below supported precision.");
  return {
    customerId: v.customerId.toLowerCase(),
    trackingNumber: v.trackingNumber.trim().toUpperCase(),
    weightKg: Number((v.weightKg as number).toFixed(3)),
    lengthCm: Number((v.lengthCm as number).toFixed(2)),
    widthCm: Number((v.widthCm as number).toFixed(2)),
    heightCm: Number((v.heightCm as number).toFixed(2)),
  };
}
export async function receive(
  db: PoolClient,
  staff: Staff,
  input: Intake,
  key: string,
) {
  if (!/^[a-zA-Z0-9-]{16,100}$/.test(key))
    throw new PilotError(400, "A valid intake request key is required.");
  const tenant = staff.organization_id;
  const requestHash = hashToken(JSON.stringify({ user: staff.user_id, input }));
  await db.query(
    "INSERT INTO operation_requests (organization_id,idempotency_key,operation_type,request_hash) VALUES ($1,$2,'package.receive',$3) ON CONFLICT DO NOTHING",
    [tenant, key, requestHash],
  );
  const operation = (
    await db.query(
      "SELECT * FROM operation_requests WHERE organization_id=$1 AND idempotency_key=$2 FOR UPDATE",
      [tenant, key],
    )
  ).rows[0];
  if (
    operation.request_hash !== requestHash ||
    operation.operation_type !== "package.receive"
  )
    throw new PilotError(
      409,
      "This request key was already used for different package details.",
    );
  if (operation.status === "completed") return operation.result;
  const customer = await db.query(
    "SELECT id FROM customers WHERE organization_id=$1 AND id=$2",
    [tenant, input.customerId],
  );
  if (!customer.rowCount)
    throw new PilotError(404, "Customer was not found in this organization.");
  const existing = await db.query(
    "SELECT * FROM packages WHERE organization_id=$1 AND tracking_number=$2 FOR UPDATE",
    [tenant, input.trackingNumber],
  );
  let pkg;
  const values = [
    tenant,
    input.customerId,
    input.trackingNumber,
    input.weightKg,
    input.lengthCm,
    input.widthCm,
    input.heightCm,
  ];
  if (existing.rowCount) {
    if (
      existing.rows[0].status !== "expected" ||
      existing.rows[0].customer_id !== input.customerId
    )
      throw new PilotError(
        409,
        "This tracking number is already received or assigned to another customer.",
      );
    pkg = (
      await db.query(
        "UPDATE packages SET status='received',weight_kg=$4,length_cm=$5,width_cm=$6,height_cm=$7,updated_at=now() WHERE organization_id=$1 AND customer_id=$2 AND tracking_number=$3 RETURNING *",
        values,
      )
    ).rows[0];
  } else {
    pkg = (
      await db.query(
        "INSERT INTO packages (organization_id,customer_id,tracking_number,weight_kg,length_cm,width_cm,height_cm,status) VALUES ($1,$2,$3,$4,$5,$6,$7,'received') RETURNING *",
        values,
      )
    ).rows[0];
  }
  await db.query(
    "INSERT INTO package_events (organization_id,package_id,event_type,from_status,to_status,actor_user_id,details) VALUES ($1,$2,'package.received',$3,'received',$4,$5)",
    [
      tenant,
      pkg.id,
      existing.rowCount ? "expected" : null,
      staff.user_id,
      JSON.stringify(input),
    ],
  );
  await db.query(
    "INSERT INTO audit_events (organization_id,actor_user_id,entity_type,entity_id,event_type,details) VALUES ($1,$2,'package',$3,'package.received',$4)",
    [tenant, staff.user_id, pkg.id, JSON.stringify({ idempotencyKey: key })],
  );
  await db.query(
    "UPDATE operation_requests SET status='completed',result=$3,updated_at=now() WHERE organization_id=$1 AND idempotency_key=$2",
    [tenant, key, JSON.stringify(pkg)],
  );
  return pkg;
}
