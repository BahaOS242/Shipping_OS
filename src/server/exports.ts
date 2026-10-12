import "server-only";
import type { PoolClient } from "pg";
import { PilotError, type Staff } from "./pilot";
import { permit } from "./operations";
export function csvCell(value: unknown) {
  let s = String(value ?? "");
  if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
  return '"' + s.replaceAll('"', '""') + '"';
}
export async function exportRows(
  db: PoolClient,
  s: Staff,
  kind: string,
  shipmentId: string | null,
) {
  let rows: Record<string, unknown>[];
  if (kind === "inventory" || kind === "manifest") {
    permit(s, ["owner", "admin", "manager", "warehouse", "customs", "driver"]);
    if (kind === "manifest" && !shipmentId)
      throw new PilotError(400, "Choose a shipment.");
    rows = (
      await db.query(
        `SELECT p.id,p.tracking_number,c.display_name AS customer,p.status,p.bin,p.destination,p.service,p.weight_kg,p.length_cm,p.width_cm,p.height_cm,p.declared_value_cents FROM packages p JOIN customers c ON c.organization_id=p.organization_id AND c.id=p.customer_id WHERE p.organization_id=$1 ${kind === "manifest" ? "AND EXISTS(SELECT 1 FROM shipment_packages sp WHERE sp.organization_id=p.organization_id AND sp.package_id=p.id AND sp.shipment_id=$2)" : ""} ORDER BY p.tracking_number,p.id`,
        kind === "manifest"
          ? [s.organization_id, shipmentId]
          : [s.organization_id],
      )
    ).rows;
  } else if (kind === "billing") {
    permit(s, ["owner", "admin", "manager", "accounting"]);
    rows = (
      await db.query(
        "SELECT r.id,r.kind,r.status,c.display_name AS customer,r.payload->>'description' AS description,r.payload->>'billId' AS bill_id,r.payload->>'amountCents' AS amount_cents,r.payload->>'currency' AS currency,r.payload->>'reference' AS reference,r.created_at FROM pilot_records r JOIN customers c ON c.organization_id=r.organization_id AND c.id=r.customer_id WHERE r.organization_id=$1 AND r.kind IN ('bill','payment') ORDER BY r.created_at,r.id",
        [s.organization_id],
      )
    ).rows;
  } else if (kind === "audit") {
    permit(s, ["owner", "admin", "manager"]);
    rows = (
      await db.query(
        "SELECT id,actor_user_id,event_type,entity_type,entity_id,created_at FROM audit_events WHERE organization_id=$1 ORDER BY created_at,id",
        [s.organization_id],
      )
    ).rows;
  } else throw new PilotError(400, "Unknown export.");
  const headers = rows.length ? Object.keys(rows[0]) : ["No records"];
  return (
    [headers, ...rows.map((r) => headers.map((k) => r[k]))]
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n") + "\r\n"
  );
}
