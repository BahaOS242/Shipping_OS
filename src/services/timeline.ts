/** TIMELINE / AUDIT — every view of history is a filter over the same event log. */
import { db } from "@/data/store";
import type { AuditEvent, ID, Refs } from "@/domain/types";

export type TimelineScope = Partial<Refs>;

/** Events touching a record. Packages also inherit their shipment's events. */
export function timeline(scope: TimelineScope, opts: { customerView?: boolean; limit?: number } = {}): AuditEvent[] {
  const s = db();
  const pkg = scope.packageId ? s.packages.find((p) => p.id === scope.packageId) : undefined;
  const shipmentForPkg = pkg?.shipmentId;
  const invForPkg = pkg?.purchaseInvoiceId;
  const out = s.events.filter((e) => {
    const r = e.refs;
    let hit = false;
    if (scope.customerId && r.customerId === scope.customerId) hit = true;
    if (scope.packageId && (r.packageId === scope.packageId || (shipmentForPkg && r.shipmentId === shipmentForPkg && !r.packageId) || (invForPkg && r.purchaseInvoiceId === invForPkg))) hit = true;
    if (scope.shipmentId && r.shipmentId === scope.shipmentId) hit = true;
    if (scope.purchaseInvoiceId && r.purchaseInvoiceId === scope.purchaseInvoiceId) hit = true;
    if (scope.billId && r.billId === scope.billId) hit = true;
    if (scope.claimId && r.claimId === scope.claimId) hit = true;
    if (scope.ticketId && r.ticketId === scope.ticketId) hit = true;
    if (scope.exceptionId && r.exceptionId === scope.exceptionId) hit = true;
    if (scope.deliveryId && r.deliveryId === scope.deliveryId) hit = true;
    if (scope.procurementId && r.procurementId === scope.procurementId) hit = true;
    return hit && (!opts.customerView || !!e.customerSummary);
  });
  const sorted = out.sort((a, b) => a.at.localeCompare(b.at));
  return opts.limit ? sorted.slice(-opts.limit) : sorted;
}

export const recentEvents = (limit = 30) => [...db().events].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);

export const eventsOfType = (type: string, sinceMs?: number) => db().events.filter((e) => e.type === type && (!sinceMs || new Date(e.at).getTime() >= sinceMs));

export const lastEventFor = (refs: TimelineScope) => timeline(refs).at(-1);

export const eventById = (id: ID) => db().events.find((e) => e.id === id);
