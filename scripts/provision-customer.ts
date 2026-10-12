import { randomBytes, createHash } from "node:crypto";
import { Pool } from "pg";
async function main() {
  const [organizationId, customerId] = process.argv.slice(2);
  if (!organizationId || !customerId || !process.env.ADMIN_DATABASE_URL)
    throw new Error(
      "Usage: ADMIN_DATABASE_URL=… npm run pilot:customer -- <organization UUID> <existing customer UUID>",
    );
  const db = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  try {
    const token = randomBytes(32).toString("hex");
    const result = await db.query(
      "INSERT INTO customer_sessions(token_hash,organization_id,customer_id,expires_at) SELECT $1,organization_id,id,now()+interval '8 hours' FROM customers WHERE organization_id=$2 AND id=$3 RETURNING customer_id",
      [
        createHash("sha256").update(token).digest("hex"),
        organizationId,
        customerId,
      ],
    );
    if (!result.rowCount)
      throw new Error("Customer not found in this organization.");
    console.log(
      "Private customer access code (valid for 8 hours; share securely):\n" +
        token,
    );
  } finally {
    await db.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
