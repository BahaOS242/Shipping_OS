import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { Pool } from "pg";
async function main() {
  if (!process.env.ADMIN_DATABASE_URL)
    throw new Error(
      "ADMIN_DATABASE_URL is required. Use a dedicated pilot database.",
    );
  const pool = new Pool({ connectionString: process.env.ADMIN_DATABASE_URL });
  const db = await pool.connect();
  try {
    await db.query("SELECT pg_advisory_lock(2420001)");
    await db.query(
      "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const name of (await readdir("db/migrations"))
      .filter((n) => n.endsWith(".sql"))
      .sort()) {
      const source = await readFile("db/migrations/" + name, "utf8");
      const checksum = createHash("sha256").update(source).digest("hex");
      const existing = await db.query(
        "SELECT checksum FROM schema_migrations WHERE name=$1",
        [name],
      );
      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum)
          throw new Error("Migration changed after application: " + name);
        continue;
      }
      await db.query("BEGIN");
      try {
        await db.query(
          source.replace(/^BEGIN;\s*$/m, "").replace(/^COMMIT;\s*$/m, ""),
        );
        await db.query(
          "INSERT INTO schema_migrations(name,checksum) VALUES ($1,$2)",
          [name, checksum],
        );
        await db.query("COMMIT");
        console.log("Applied " + name);
      } catch (error) {
        await db.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    await db.query("SELECT pg_advisory_unlock(2420001)");
    db.release();
    await pool.end();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
