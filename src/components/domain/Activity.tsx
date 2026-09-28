"use client";

import type { AuditEvent } from "@/domain/types";
import { fmtDateTime } from "../ui/Time";

const ICON: Record<string, string> = {
  PACKAGE_EXPECTED: "🛒", PACKAGE_RECEIVED: "📦", INVOICE_UPLOADED: "📤", INVOICE_PROCESSED: "🧾", INVOICE_VERIFIED: "✅", PACKAGE_WEIGHT_UPDATED: "⚖️",
  PACKAGE_PHOTOGRAPHED: "📷", PACKAGE_HELD: "✋", PACKAGE_RELEASED: "▶️", PACKAGE_CONSOLIDATED: "🔗", SHIPMENT_CREATED: "🏷️", CUSTOMS_PACKET_GENERATED: "📄",
  CUSTOMS_REVIEW_REQUIRED: "📋", CUSTOMS_FLAGGED: "🚩", CUSTOMS_APPROVED: "✓", SHIPMENT_DEPARTED: "✈️", SHIPMENT_ARRIVED: "🇧🇸", PACKAGE_READY: "✅",
  DELIVERY_SCHEDULED: "🗓️", OUT_FOR_DELIVERY: "🚚", DELIVERY_FAILED: "⚠️", PACKAGE_DELIVERED: "🎉", BILL_ISSUED: "💰", CHARGE_ADDED: "➕",
  PAYMENT_RECEIVED: "💳", PAYMENT_RECONCILED: "🧮", STORAGE_FEE_APPLIED: "⏰", CLAIM_CREATED: "🛟", CLAIM_UPDATED: "🛟", SUPPORT_TICKET_CREATED: "🎧",
  TICKET_UPDATED: "🎧", EXCEPTION_CREATED: "⚠", EXCEPTION_UPDATED: "●", EXCEPTION_RESOLVED: "✓", CUSTOMER_MESSAGE: "💬", AI_RESPONDED: "🤖",
  STAFF_MESSAGE: "🙋", CUSTOMER_NOTIFIED: "🔔", PROCUREMENT_REQUESTED: "🛒", PROCUREMENT_UPDATED: "🛒", PACKAGE_UPDATED: "✎", CUSTOMER_CREATED: "👋",
};

/**
 * Activity / audit timeline. `customer` shows only customer-facing lines in plain language;
 * staff see the full audit trail with actor.
 */
export function Activity({ events, customer = false, newestFirst = true, empty = "No activity yet." }: { events: AuditEvent[]; customer?: boolean; newestFirst?: boolean; empty?: string }) {
  const list = (customer ? events.filter((e) => e.customerSummary) : events).slice();
  if (newestFirst) list.reverse();
  if (!list.length) return <p className="text-ink-mute">{empty}</p>;
  return (
    <ol className="space-y-0">
      {list.map((e, i) => (
        <li key={e.id} className="relative flex gap-3 pb-4 last:pb-0">
          {i < list.length - 1 && <span aria-hidden className="absolute left-[15px] top-8 h-[calc(100%-1.75rem)] w-0.5 bg-[#e3e7ec]" />}
          <span aria-hidden className="relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-sm ring-1 ring-[#e3e7ec]">{ICON[e.type] ?? "•"}</span>
          <div className="min-w-0 pt-1">
            <p className={customer ? "font-semibold" : "text-[15px]"}>{customer ? e.customerSummary : e.summary}</p>
            <p className="text-xs text-ink-mute">
              {fmtDateTime(e.at)}
              {!customer && <> · {e.actor.kind === "ai" ? "🤖 " : e.actor.kind === "system" ? "⚙ " : ""}{e.actor.name} · <span className="font-mono">{e.type}</span></>}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
