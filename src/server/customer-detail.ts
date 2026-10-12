import "server-only";
import type { PoolClient } from "pg";
import type { CustomerSession } from "./customer-tracking";
import { tracking } from "./customer-tracking";
import { PilotError } from "./pilot";
import { id } from "./operations";

export async function customerDetail(
  db: PoolClient,
  c: CustomerSession,
  kind: string,
  reference: string,
) {
  const key = id(reference),
    args = [c.organization_id, c.customer_id, key];
  if (!["packages", "shipments", "bills"].includes(kind))
    throw new PilotError(404, "Page not found.");
  const sql =
    kind === "packages"
      ? "SELECT id,tracking_number,status,merchant,item_description,destination,service,weight_kg,length_cm,width_cm,height_cm,created_at,updated_at FROM packages WHERE organization_id=$1 AND customer_id=$2 AND id=$3"
      : kind === "shipments"
        ? "SELECT id,status,destination,service,customs_status,delivery_method,delivery_address,received_by,delivered_at,created_at,updated_at FROM shipments WHERE organization_id=$1 AND customer_id=$2 AND id=$3"
        : "SELECT id,status,payload,created_at FROM pilot_records WHERE organization_id=$1 AND customer_id=$2 AND id=$3 AND kind='bill' AND status<>'draft'";
  const item = (await db.query(sql, args)).rows[0];
  if (!item) throw new PilotError(404, "This item is unavailable.");
  const files = (
    await db.query(
      `SELECT id,name,mime_type,created_at FROM pilot_attachments WHERE organization_id=$1 AND customer_id=$2 AND ${kind === "packages" ? "package_id" : "record_id"}=$3 ORDER BY created_at DESC`,
      args,
    )
  ).rows;
  let related: Record<string, unknown>[] = [],
    events: Record<string, unknown>[] = [],
    balance = 0;
  if (kind === "packages") {
    events = (await tracking(db, c, key)).events ?? [];
    related = (
      await db.query(
        "SELECT s.id,s.status,s.destination,s.service FROM shipments s JOIN shipment_packages l ON l.organization_id=s.organization_id AND l.shipment_id=s.id WHERE s.organization_id=$1 AND s.customer_id=$2 AND l.package_id=$3",
        args,
      )
    ).rows;
  } else if (kind === "shipments") {
    related = (
      await db.query(
        "SELECT p.id,p.tracking_number,p.status,p.merchant,p.item_description FROM packages p JOIN shipment_packages l ON l.organization_id=p.organization_id AND l.package_id=p.id JOIN shipments s ON s.organization_id=l.organization_id AND s.id=l.shipment_id WHERE p.organization_id=$1 AND p.customer_id=$2 AND s.customer_id=$2 AND l.shipment_id=$3 ORDER BY p.created_at",
        args,
      )
    ).rows;
  } else {
    related = (
      await db.query(
        "SELECT id,status,payload,created_at FROM pilot_records WHERE organization_id=$1 AND customer_id=$2 AND kind='payment' AND payload->>'billId'=$3 ORDER BY created_at",
        args,
      )
    ).rows;
    balance =
      item.status === "issued"
        ? Number(item.payload.amountCents) -
          related
            .filter((p) => p.status === "recorded")
            .reduce(
              (sum, p) =>
                sum +
                Number((p.payload as Record<string, unknown>).amountCents),
              0,
            )
        : 0;
  }
  return {
    organization: c.organization_name,
    customer: c.display_name,
    item,
    files,
    related,
    events,
    balance,
  };
}
