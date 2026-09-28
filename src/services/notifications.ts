/**
 * NOTIFICATION SERVICE — turns events into customer and staff notifications.
 * Customer notifications are mirrored into the (simulated) WhatsApp thread and
 * marked as emailed. Nothing is actually sent.
 */
import { db, mutate, nextSeq } from "@/data/store";
import { EXCEPTION_CATALOG } from "@/domain/copy";
import type { AuditEvent, ID, Notification, NotificationChannel, Team } from "@/domain/types";
import { onEvent } from "@/events/bus";

type Rule = { icon: string; title: string; channels: NotificationChannel[]; href?: (e: AuditEvent) => string | undefined };

const pkgOrShipment = (e: AuditEvent) => (e.refs.packageId ? `/packages/${e.refs.packageId}` : e.refs.shipmentId ? `/shipments/${e.refs.shipmentId}` : undefined);

/** Which events notify the customer, and how. */
export const CUSTOMER_RULES: Partial<Record<string, Rule>> = {
  PACKAGE_RECEIVED: { icon: "📦", title: "Package received", channels: ["in_app", "whatsapp", "email"], href: pkgOrShipment },
  INVOICE_PROCESSED: { icon: "🧾", title: "Receipt processed", channels: ["in_app"], href: pkgOrShipment },
  PACKAGE_CONSOLIDATED: { icon: "📦", title: "Packages put together", channels: ["in_app"], href: pkgOrShipment },
  SHIPMENT_CREATED: { icon: "🏷️", title: "Shipment created", channels: ["in_app", "email"], href: pkgOrShipment },
  CUSTOMS_APPROVED: { icon: "📋", title: "Paperwork checked", channels: ["in_app"], href: pkgOrShipment },
  SHIPMENT_DEPARTED: { icon: "🚢", title: "Shipment on the way", channels: ["in_app", "whatsapp", "email"], href: pkgOrShipment },
  SHIPMENT_ARRIVED: { icon: "🇧🇸", title: "Shipment arrived in The Bahamas", channels: ["in_app", "whatsapp"], href: pkgOrShipment },
  PACKAGE_READY: { icon: "✅", title: "Ready for pickup", channels: ["in_app", "whatsapp", "email"], href: pkgOrShipment },
  DELIVERY_SCHEDULED: { icon: "🗓️", title: "Delivery scheduled", channels: ["in_app", "whatsapp"], href: pkgOrShipment },
  OUT_FOR_DELIVERY: { icon: "🚚", title: "Out for delivery", channels: ["in_app", "whatsapp"], href: pkgOrShipment },
  DELIVERY_FAILED: { icon: "⚠️", title: "We missed you", channels: ["in_app", "whatsapp"], href: pkgOrShipment },
  PACKAGE_DELIVERED: { icon: "🎉", title: "Delivered", channels: ["in_app", "whatsapp", "email"], href: pkgOrShipment },
  BILL_ISSUED: { icon: "💰", title: "Payment due", channels: ["in_app", "whatsapp", "email"], href: () => "/payments" },
  PAYMENT_RECEIVED: { icon: "✓", title: "Payment received", channels: ["in_app", "email"], href: () => "/payments" },
  EXCEPTION_CREATED: { icon: "⚠️", title: "Action needed", channels: ["in_app", "whatsapp"], href: pkgOrShipment },
  CLAIM_CREATED: { icon: "🛟", title: "Claim received", channels: ["in_app", "email"], href: (e) => `/claims?open=${e.refs.claimId}` },
  CLAIM_UPDATED: { icon: "🛟", title: "Claim update", channels: ["in_app", "email"], href: (e) => `/claims?open=${e.refs.claimId}` },
  SUPPORT_TICKET_CREATED: { icon: "🎧", title: "Help request opened", channels: ["in_app"], href: () => "/support" },
  STAFF_MESSAGE: { icon: "💬", title: "Message from Shipping OS", channels: ["in_app"], href: () => "/support" },
  CUSTOMER_NOTIFIED: { icon: "⏰", title: "Your package is waiting", channels: ["in_app", "whatsapp", "email"], href: pkgOrShipment },
  STORAGE_FEE_APPLIED: { icon: "⏰", title: "Storage fee added", channels: ["in_app", "email"], href: () => "/payments" },
  PROCUREMENT_UPDATED: { icon: "🛒", title: "Buy-for-me update", channels: ["in_app", "email"], href: () => "/dashboard" },
};

/** Which events alert a staff team. */
const STAFF_RULES: Partial<Record<string, (e: AuditEvent) => { team: Team; icon: string; title: string; href?: string } | undefined>> = {
  EXCEPTION_CREATED: (e) => {
    const t = e.data?.type as keyof typeof EXCEPTION_CATALOG | undefined;
    return t ? { team: EXCEPTION_CATALOG[t].team, icon: EXCEPTION_CATALOG[t].icon, title: EXCEPTION_CATALOG[t].label, href: `/exceptions?open=${e.refs.exceptionId}` } : undefined;
  },
  SUPPORT_TICKET_CREATED: (e) => ({ team: "support", icon: "🎧", title: "New support ticket", href: `/support?open=${e.refs.ticketId}` }),
  CLAIM_CREATED: (e) => ({ team: "support", icon: "🛟", title: "New claim", href: `/claims?open=${e.refs.claimId}` }),
  CUSTOMS_REVIEW_REQUIRED: (e) => ({ team: "customs", icon: "📋", title: "Customs review requested", href: `/customs/${e.refs.shipmentId}` }),
  PAYMENT_RECEIVED: (e) => (e.refs.billId ? undefined : { team: "accounting", icon: "≠", title: "Unmatched payment", href: "/accounting?tab=reconciliation" }),
};

const WHATSAPP_MIRROR = new Set(["PACKAGE_RECEIVED", "SHIPMENT_DEPARTED", "SHIPMENT_ARRIVED", "PACKAGE_READY", "OUT_FOR_DELIVERY", "PACKAGE_DELIVERED", "BILL_ISSUED", "CUSTOMER_NOTIFIED", "DELIVERY_SCHEDULED"]);

onEvent((e) => {
  const s = db();
  const cRule = CUSTOMER_RULES[e.type];
  if (cRule && e.refs.customerId && e.customerSummary) {
    const n: Notification = {
      id: `NTF-${nextSeq("ntf", 0)}`,
      audience: "customer",
      customerId: e.refs.customerId,
      icon: cRule.icon,
      title: cRule.title,
      body: e.customerSummary,
      href: cRule.href?.(e),
      at: e.at,
      read: false,
      channels: cRule.channels,
      eventId: e.id,
      refs: e.refs,
    };
    s.notifications.push(n);
    if (WHATSAPP_MIRROR.has(e.type)) {
      // Simulated WhatsApp template message in the customer's thread.
      let conv = s.conversations.find((c) => c.customerId === e.refs.customerId && c.channel === "whatsapp");
      if (!conv) {
        conv = { id: `CONV-${nextSeq("conv", 0)}`, customerId: e.refs.customerId, channel: "whatsapp", messages: [], intents: [], escalated: false, updatedAt: e.at };
        s.conversations.push(conv);
      }
      conv.messages.push({ id: `M${nextSeq("msg", 0)}`, author: "assistant", text: `${cRule.icon} ${e.customerSummary}`, at: e.at });
      conv.updatedAt = e.at;
    }
  }
  const sRule = STAFF_RULES[e.type]?.(e);
  if (sRule) {
    s.notifications.push({ id: `NTF-${nextSeq("ntf", 0)}`, audience: "staff", team: sRule.team, icon: sRule.icon, title: sRule.title, body: e.summary, href: sRule.href, at: e.at, read: false, channels: ["in_app"], eventId: e.id, refs: e.refs });
  }
});

export function listNotifications(f: { customerId?: ID; team?: Team | "all"; limit?: number }) {
  return db()
    .notifications.filter((n) => (f.customerId ? n.audience === "customer" && n.customerId === f.customerId : n.audience === "staff" && (!f.team || f.team === "all" || n.team === f.team)))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, f.limit ?? 200);
}

export function markRead(ids: ID[]) {
  return mutate((s) => {
    for (const n of s.notifications) if (ids.includes(n.id)) n.read = true;
  });
}
