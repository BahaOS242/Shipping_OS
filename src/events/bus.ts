/**
 * EVENT BUS — lightweight, synchronous, in-process.
 *
 * emit() → appends an AuditEvent (audit log + timelines) → runs handlers
 * (notifications, WhatsApp/email simulations, staff alerts).
 * Production: same event names on a real queue (e.g. Postgres outbox → workers).
 */
import { nowIso } from "@/data/clock";
import { db, nextSeq } from "@/data/store";
import type { Actor, AuditEvent, Refs } from "@/domain/types";

export const EVENT_TYPES = [
  "CUSTOMER_CREATED",
  "PACKAGE_EXPECTED",
  "PACKAGE_RECEIVED",
  "INVOICE_UPLOADED",
  "INVOICE_PROCESSED",
  "INVOICE_VERIFIED",
  "PACKAGE_WEIGHT_UPDATED",
  "PACKAGE_PHOTOGRAPHED",
  "PACKAGE_HELD",
  "PACKAGE_RELEASED",
  "PACKAGE_UPDATED",
  "PACKAGE_CONSOLIDATED",
  "SHIPMENT_CREATED",
  "CUSTOMS_PACKET_GENERATED",
  "CUSTOMS_REVIEW_REQUIRED",
  "CUSTOMS_FLAGGED",
  "CUSTOMS_APPROVED",
  "SHIPMENT_DEPARTED",
  "SHIPMENT_ARRIVED",
  "PACKAGE_READY",
  "DELIVERY_SCHEDULED",
  "OUT_FOR_DELIVERY",
  "DELIVERY_FAILED",
  "PACKAGE_DELIVERED",
  "BILL_ISSUED",
  "CHARGE_ADDED",
  "PAYMENT_RECEIVED",
  "PAYMENT_RECONCILED",
  "STORAGE_FEE_APPLIED",
  "CLAIM_CREATED",
  "CLAIM_UPDATED",
  "SUPPORT_TICKET_CREATED",
  "TICKET_UPDATED",
  "EXCEPTION_CREATED",
  "EXCEPTION_UPDATED",
  "EXCEPTION_RESOLVED",
  "CUSTOMER_MESSAGE",
  "AI_RESPONDED",
  "STAFF_MESSAGE",
  "CUSTOMER_NOTIFIED",
  "PROCUREMENT_REQUESTED",
  "PROCUREMENT_UPDATED",
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export type EmitInput = {
  actor: Actor;
  refs: Refs;
  summary: string;
  customerSummary?: string;
  data?: Record<string, unknown>;
};

type Handler = (e: AuditEvent) => void;
const handlers: Handler[] = [];

export function onEvent(h: Handler) {
  handlers.push(h);
}

/** Must be called inside a `mutate()` (services do this). */
export function emit(type: EventType, input: EmitInput): AuditEvent {
  const event: AuditEvent = { id: `EVT-${nextSeq("evt", 0)}`, type, at: nowIso(), ...input };
  db().events.push(event);
  for (const h of handlers) h(event);
  return event;
}

export const SYSTEM: Actor = { kind: "system", name: "Shipping OS system", role: "admin" };
