import "server-only";
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { PoolClient } from "pg";
import { PilotError, pool, hashToken } from "./pilot";
import { fields, object, text } from "./operations";
import { validateCustomer } from "./pilot-customers";
const derive = promisify(scrypt);
export async function hashPassword(password: unknown) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  )
    throw new PilotError(400, "Use a password of 12–128 characters.");
  const salt = randomBytes(16).toString("hex"),
    hash = (await derive(password, salt, 64)) as Buffer;
  return salt + ":" + hash.toString("hex");
}
export async function verifyPassword(password: unknown, stored: string) {
  if (typeof password !== "string" || !password.length || password.length > 128)
    return false;
  const [salt, expected] = stored.split(":");
  const actual = (await derive(password, salt, 64)) as Buffer;
  const target = Buffer.from(expected, "hex");
  return target.length === actual.length && timingSafeEqual(target, actual);
}
async function anonymous<T>(
  slug: string,
  email: string,
  work: (db: PoolClient, tenant: string | null) => Promise<T>,
) {
  const db = await pool().connect();
  try {
    await db.query("BEGIN");
    const role = (
      await db.query(
        "SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user",
      )
    ).rows[0];
    if (role.rolsuper || role.rolbypassrls)
      throw new PilotError(
        503,
        "Restricted database credentials are required.",
      );
    await db.query(
      "SELECT set_config('app.actor_type','',true),set_config('app.staff_role','',true),set_config('app.user_id','',true),set_config('app.customer_id','',true),set_config('app.organization_id','',true),set_config('app.login_slug',$1,true),set_config('app.login_email',$2,true),set_config('app.identity_authenticated','',true)",
      [slug, email],
    );
    const org = (
      await db.query("SELECT id FROM organizations WHERE slug=$1", [slug])
    ).rows[0];
    await db.query("SELECT set_config('app.organization_id',$1,true)", [
      org?.id ?? "",
    ]);
    const result = await work(db, org?.id ?? null);
    await db.query("COMMIT");
    return result;
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
}
export async function rateLimit(key: string, limit = 10) {
  // Own transaction: failed authentication must not roll back attempt counters.
  const db = await pool().connect();
  try {
    await db.query("BEGIN");
    await db.query("SELECT set_config('app.identity_key',$1,true)", [
      hashToken(key),
    ]);
    const row = (
      await db.query(
        "INSERT INTO identity_attempts(key,attempts) VALUES($1,1) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN identity_attempts.window_start<now()-interval '15 minutes' THEN 1 ELSE identity_attempts.attempts+1 END,window_start=CASE WHEN identity_attempts.window_start<now()-interval '15 minutes' THEN now() ELSE identity_attempts.window_start END RETURNING attempts",
        [hashToken(key)],
      )
    ).rows[0];
    await db.query("COMMIT");
    if (row.attempts > limit)
      throw new PilotError(429, "Too many attempts. Try again in 15 minutes.");
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
}
function identityInput(raw: unknown) {
  const v = object(raw);
  fields(v, ["organization", "email", "password"]);
  const slug = text(v.organization, 100, true);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
    throw new PilotError(400, "Enter your organization address.");
  const normalized = validateCustomer({
    displayName: "identity",
    email: v.email,
  });
  if (!normalized.email) throw new PilotError(400, "Enter your email address.");
  return { slug, email: normalized.email, password: v.password };
}
export async function login(raw: unknown) {
  const v = identityInput(raw);
  await rateLimit("login:" + v.slug + ":" + v.email);
  return anonymous(v.slug, v.email, async (db, tenant) => {
    const account = tenant
      ? (
          await db.query(
            "SELECT * FROM pilot_accounts WHERE organization_id=$1 AND email=$2",
            [tenant, v.email],
          )
        ).rows[0]
      : null;
    const valid = await verifyPassword(
      v.password,
      account?.password_hash ??
        "00000000000000000000000000000000:" + "00".repeat(64),
    );
    if (!valid || !account)
      throw new PilotError(401, "Email or password is incorrect.");
    await db.query(
      "SELECT set_config('app.customer_id',$1,true),set_config('app.actor_type','customer',true),set_config('app.identity_authenticated','true',true)",
      [account.customer_id],
    );
    const customer = await db.query(
      "SELECT id FROM customers WHERE organization_id=$1 AND id=$2 AND archived_at IS NULL",
      [tenant, account.customer_id],
    );
    if (!customer.rowCount)
      throw new PilotError(401, "Account access is unavailable.");
    const token = randomBytes(32).toString("hex");
    const session = (
      await db.query(
        "INSERT INTO customer_sessions VALUES($1,$2,$3,now()+interval '8 hours') RETURNING expires_at",
        [hashToken(token), tenant, account.customer_id],
      )
    ).rows[0];
    return { token, expiresAt: session.expires_at };
  });
}
export async function register(raw: unknown) {
  const v = object(raw);
  fields(v, ["organization", "displayName", "email", "phone", "password"]);
  const c = validateCustomer({
    displayName: v.displayName,
    email: v.email,
    phone: v.phone,
  });
  if (!c.email) throw new PilotError(400, "Email is required.");
  const slug = text(v.organization, 100, true);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
    throw new PilotError(400, "Enter your organization address.");
  await rateLimit("register:" + slug + ":" + c.email, 3);
  const passwordHash = await hashPassword(v.password);
  return anonymous(slug, c.email, async (db, tenant) => {
    if (!tenant) throw new PilotError(400, "Organization not found.");
    await db.query(
      "INSERT INTO pilot_registrations(organization_id,email,display_name,phone,password_hash) VALUES($1,$2,$3,$4,$5)",
      [tenant, c.email, c.displayName, c.phone, passwordHash],
    );
    return {
      pending: true,
      message:
        "Registration saved. PCL Imports must verify your identity and approve access before you can sign in.",
    };
  });
}
