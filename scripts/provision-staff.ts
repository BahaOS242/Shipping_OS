// Administrator-only tool. Never use ADMIN_DATABASE_URL in the application.
import { randomBytes, createHash } from "node:crypto";
import { Pool } from "pg";
async function main() {
  const [organizationId, userId] = process.argv.slice(2);
  if (!organizationId || !userId || !process.env.ADMIN_DATABASE_URL)
    throw new Error(
      "Usage: ADMIN_DATABASE_URL=… npm run pilot:staff -- <organization UUID> <existing staff user ID>",
    );
  const db = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  try {
    const member = await db.query(
      "SELECT role FROM organization_members WHERE organization_id=$1 AND user_id=$2 AND role IN ('owner','admin','manager','warehouse','customs','accounting','support','driver')",
      [organizationId, userId],
    );
    if (!member.rowCount)
      throw new Error("Create an authorized staff membership first.");
    const token = randomBytes(32).toString("hex");
    await db.query(
      "INSERT INTO staff_sessions(token_hash,organization_id,user_id,expires_at) VALUES ($1,$2,$3,now()+interval '8 hours')",
      [
        createHash("sha256").update(token).digest("hex"),
        organizationId,
        userId,
      ],
    );
    console.log(
      "Private staff access code (valid for 8 hours; share securely):\n" +
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
