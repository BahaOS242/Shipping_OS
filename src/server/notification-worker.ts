import { randomUUID } from "node:crypto";
import type { Pool } from "pg";
export type DeliveryJob = {
  organization_id: string;
  id: string;
  recipient: string;
  payload: { title: string; message: string };
  lock_token: string;
  attempts: number;
};
export async function deliverBatch(
  pool: Pool,
  send: (job: DeliveryJob) => Promise<string>,
  limit = 10,
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 10)
    throw new Error("Batch size must be 1–10.");
  const db = await pool.connect();
  const jobs: DeliveryJob[] = [];
  try {
    await db.query("BEGIN");
    const role = (
      await db.query(
        "SELECT rolsuper,rolbypassrls,pg_has_role(current_user,'shipping_os_worker','MEMBER') AS worker FROM pg_roles WHERE rolname=current_user",
      )
    ).rows[0];
    if (role.rolsuper || role.rolbypassrls || !role.worker)
      throw new Error("A restricted shipping_os_worker login is required.");
    await db.query(
      "UPDATE notification_outbox SET status='failed',locked_at=NULL,lock_token=NULL,last_error='Delivery attempts exhausted' WHERE channel='email' AND status='sending' AND locked_at<now()-interval '5 minutes' AND attempts>=8",
    );
    const rows = (
      await db.query(
        "SELECT organization_id,id FROM notification_outbox WHERE channel='email' AND attempts<8 AND ((status IN ('pending','failed') AND available_at<=now()) OR (status='sending' AND locked_at<now()-interval '5 minutes')) ORDER BY available_at,created_at LIMIT $1 FOR UPDATE SKIP LOCKED",
        [limit],
      )
    ).rows;
    for (const row of rows) {
      const token = randomUUID();
      jobs.push(
        (
          await db.query(
            "UPDATE notification_outbox SET status='sending',attempts=attempts+1,locked_at=now(),lock_token=$3,last_error=NULL WHERE organization_id=$1 AND id=$2 RETURNING *",
            [row.organization_id, row.id, token],
          )
        ).rows[0],
      );
    }
    await db.query("COMMIT");
  } catch (e) {
    await db.query("ROLLBACK");
    throw e;
  } finally {
    db.release();
  }
  let sent = 0,
    failed = 0;
  // Deliver the small claimed batch concurrently so queued jobs do not age beyond their lease.
  await Promise.all(
    jobs.map(async (job) => {
      try {
        const messageId = await send(job);
        const completed = await pool.query(
          "UPDATE notification_outbox SET status='sent',sent_at=now(),provider_message_id=$4,locked_at=NULL,lock_token=NULL WHERE organization_id=$1 AND id=$2 AND status='sending' AND lock_token=$3",
          [job.organization_id, job.id, job.lock_token, messageId],
        );
        if (completed.rowCount) sent++;
      } catch (e) {
        const code = (e as { code?: string })?.code;
        const safeCode =
          typeof code === "string" && /^[A-Z_]{1,20}$/.test(code)
            ? code
            : "PROVIDER_ERROR";
        await pool.query(
          "UPDATE notification_outbox SET status='failed',last_error=$4,locked_at=NULL,lock_token=NULL,available_at=now()+(least(3600,power(2,least(attempts,10))*30)*interval '1 second') WHERE organization_id=$1 AND id=$2 AND status='sending' AND lock_token=$3",
          [
            job.organization_id,
            job.id,
            job.lock_token,
            "Delivery failed (" + safeCode + ")",
          ],
        );
        failed++;
      }
    }),
  );
  return { claimed: jobs.length, sent, failed };
}
