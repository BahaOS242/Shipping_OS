import "server-only";
import type { PoolClient } from "pg";
import { hashToken, PilotError, withTokenTransaction } from "./pilot";
export type CustomerSession = {
  organization_id: string;
  customer_id: string;
  expires_at: Date;
  display_name: string;
  organization_name: string;
};
export async function withCustomer<T>(
  token: string | undefined,
  work: (db: PoolClient, customer: CustomerSession) => Promise<T>,
): Promise<T> {
  return withTokenTransaction(token, async (db, verifiedToken) => {
    const session = await db.query(
      "SELECT organization_id,customer_id,expires_at FROM customer_sessions WHERE token_hash=$1 AND expires_at>now()",
      [hashToken(verifiedToken)],
    );
    if (!session.rowCount)
      throw new PilotError(
        401,
        "Your customer access has expired or was revoked.",
      );
    const s = session.rows[0];
    await db.query(
      "SELECT set_config('app.organization_id',$1,true),set_config('app.customer_id',$2,true),set_config('app.actor_type','customer',true)",
      [s.organization_id, s.customer_id],
    );
    const profile = await db.query(
      "SELECT c.display_name,o.name AS organization_name FROM customers c JOIN organizations o ON o.id=c.organization_id WHERE c.organization_id=$1 AND c.id=$2",
      [s.organization_id, s.customer_id],
    );
    if (!profile.rowCount)
      throw new PilotError(401, "Customer access is no longer available.");
    return work(db, { ...s, ...profile.rows[0] });
  });
}
export async function tracking(
  db: PoolClient,
  customer: CustomerSession,
  packageId: string | null,
) {
  const values = [customer.organization_id, customer.customer_id];
  if (packageId) {
    if (
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
        packageId,
      )
    )
      throw new PilotError(400, "Invalid package reference.");
    const pkg = await db.query(
      "SELECT id,tracking_number,status,weight_kg,length_cm,width_cm,height_cm,created_at,updated_at FROM packages WHERE organization_id=$1 AND customer_id=$2 AND id=$3",
      [...values, packageId],
    );
    if (!pkg.rowCount) throw new PilotError(404, "Package not found.");
    const events = await db.query(
      "SELECT id,event_type,to_status,occurred_at FROM package_events WHERE organization_id=$1 AND package_id=$2 ORDER BY occurred_at DESC,id DESC LIMIT 100",
      [customer.organization_id, packageId],
    );
    return { package: pkg.rows[0], events: events.rows };
  }
  const packages = await db.query(
    "SELECT id,tracking_number,status,weight_kg,updated_at FROM packages WHERE organization_id=$1 AND customer_id=$2 ORDER BY updated_at DESC,id DESC LIMIT 50",
    values,
  );
  return {
    customer: customer.display_name,
    organization: customer.organization_name,
    packages: packages.rows,
  };
}
