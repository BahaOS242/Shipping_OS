import "server-only";
import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { NextResponse } from "next/server";
import { PilotError, withOperator } from "./pilot";
import { withCustomer } from "./customer-tracking";
import { sessionToken, requireOrigin, failure } from "./pilot-http";
import { customerToken } from "./customer-http";
import { id, text } from "./operations";
const max = 6 * 1024 * 1024;
async function formData(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new PilotError(400, "Choose a file.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      throw new PilotError(413, "Upload must be at most 5 MB.");
    }
    chunks.push(value);
  }
  try {
    return await new Response(Buffer.concat(chunks), {
      headers: { "Content-Type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    throw new PilotError(400, "Invalid file upload.");
  }
}
export async function addFile(
  db: PoolClient,
  tenant: string,
  customer: string,
  form: FormData,
) {
  const file = form.get("file");
  if (!(file instanceof File) || !file.size || file.size > 5242880)
    throw new PilotError(
      400,
      "Choose a PNG, JPEG or PDF file of at most 5 MB.",
    );
  const content = Buffer.from(await file.arrayBuffer());
  let mime = "";
  if (
    content
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    mime = "image/png";
  else if (content[0] === 255 && content[1] === 216 && content[2] === 255)
    mime = "image/jpeg";
  else if (content.subarray(0, 5).toString() === "%PDF-")
    mime = "application/pdf";
  else throw new PilotError(400, "Only PNG, JPEG and PDF files are supported.");
  const packageId = form.get("packageId") ? id(form.get("packageId")) : null,
    recordId = form.get("recordId") ? id(form.get("recordId")) : null;
  const c = await db.query(
    "SELECT id FROM customers WHERE organization_id=$1 AND id=$2 AND archived_at IS NULL",
    [tenant, customer],
  );
  if (!c.rowCount) throw new PilotError(404, "Customer not found.");
  if (packageId) {
    const p = await db.query(
      "SELECT id FROM packages WHERE organization_id=$1 AND id=$2 AND customer_id=$3",
      [tenant, packageId, customer],
    );
    if (!p.rowCount) throw new PilotError(404, "Package not found.");
  }
  if (recordId) {
    const r = await db.query(
      "SELECT id FROM pilot_records WHERE organization_id=$1 AND id=$2 AND customer_id=$3",
      [tenant, recordId, customer],
    );
    if (!r.rowCount) throw new PilotError(404, "Document record not found.");
  }
  return (
    await db.query(
      "INSERT INTO pilot_attachments(organization_id,customer_id,package_id,record_id,name,mime_type,content,checksum) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,name,mime_type,package_id,record_id",
      [
        tenant,
        customer,
        packageId,
        recordId,
        text(file.name, 200, true),
        mime,
        content,
        createHash("sha256").update(content).digest("hex"),
      ],
    )
  ).rows[0];
}
export async function upload(request: Request, customerMode: boolean) {
  try {
    requireOrigin(request);
    const form = await formData(request);
    const result = customerMode
      ? await withCustomer(await customerToken(), (db, c) =>
          addFile(db, c.organization_id, c.customer_id, form),
        )
      : await withOperator(await sessionToken(), (db, s) =>
          addFile(db, s.organization_id, id(form.get("customerId")), form),
        );
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return failure(e);
  }
}
export async function download(request: Request, customerMode: boolean) {
  try {
    const fileId = id(new URL(request.url).searchParams.get("id"));
    const work = async (db: PoolClient, tenant: string) => {
      const file = (
        await db.query(
          "SELECT name,mime_type,content FROM pilot_attachments WHERE organization_id=$1 AND id=$2",
          [tenant, fileId],
        )
      ).rows[0];
      if (!file) throw new PilotError(404, "File not found.");
      return file;
    };
    const file = customerMode
      ? await withCustomer(await customerToken(), (db, c) =>
          work(db, c.organization_id),
        )
      : await withOperator(await sessionToken(), (db, s) =>
          work(db, s.organization_id),
        );
    return new Response(new Uint8Array(file.content), {
      headers: {
        "Content-Type": file.mime_type,
        "Content-Disposition":
          "attachment; filename*=UTF-8''" + encodeURIComponent(file.name),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "sandbox; default-src 'none'",
      },
    });
  } catch (e) {
    return failure(e);
  }
}
