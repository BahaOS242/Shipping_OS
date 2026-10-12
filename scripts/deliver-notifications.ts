import nodemailer from "nodemailer";
import { Pool } from "pg";
import { deliverBatch } from "../src/server/notification-worker";
async function main() {
  if (process.env.EMAIL_DELIVERY_ENABLED !== "true")
    throw new Error(
      "Email delivery is disabled. Configure SMTP and explicitly enable EMAIL_DELIVERY_ENABLED.",
    );
  const {
    WORKER_DATABASE_URL,
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
    SMTP_FROM,
  } = process.env;
  if (
    !WORKER_DATABASE_URL ||
    !SMTP_HOST ||
    !SMTP_USER ||
    !SMTP_PASSWORD ||
    !SMTP_FROM ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(SMTP_FROM)
  )
    throw new Error("Worker database and SMTP configuration are required.");
  const port = Number(SMTP_PORT ?? 587);
  if (![465, 587].includes(port))
    throw new Error("Use SMTP port 465 or 587 with verified TLS.");
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: true,
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    tls: { rejectUnauthorized: true },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  const pool = new Pool({
    connectionString: WORKER_DATABASE_URL,
    max: 2,
    connectionTimeoutMillis: 5000,
  });
  try {
    console.log(
      await deliverBatch(pool, async (job) => {
        const result = await transport.sendMail({
          from: SMTP_FROM,
          to: job.recipient,
          subject: job.payload.title,
          text: job.payload.message,
          messageId: `<shipping-os-${job.organization_id}-${job.id}@${SMTP_FROM.split("@")[1]}>`,
        });
        if (!result.accepted.length)
          throw new Error("SMTP rejected recipient.");
        return result.messageId;
      }),
    );
  } finally {
    transport.close();
    await pool.end();
  }
}
main().catch((e) => {
  const setupMessages = [
    "Email delivery is disabled. Configure SMTP and explicitly enable EMAIL_DELIVERY_ENABLED.",
    "Worker database and SMTP configuration are required.",
    "Use SMTP port 465 or 587 with verified TLS.",
  ];
  console.error(
    e instanceof Error && setupMessages.includes(e.message)
      ? e.message
      : "Delivery failed. Check worker database access and provider settings.",
  );
  process.exitCode = 1;
});
