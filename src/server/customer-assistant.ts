import "server-only";
import type { PoolClient } from "pg";
import type { CustomerSession } from "./customer-tracking";
import { customerSnapshot } from "./customer-workspace";
import { fields, object, text } from "./operations";
export async function customerAssistant(
  db: PoolClient,
  c: CustomerSession,
  raw: unknown,
) {
  const input = object(raw);
  fields(input, ["message"]);
  const message = text(input.message, 1000, true).toLowerCase();
  const data = await customerSnapshot(db, c);
  const links: { label: string; href: string }[] = [];
  let answer =
    "I can help with your packages, shipments, bills, receipts, shipping requests and contacting the team. What would you like to check?";
  const matched = data.packages.filter((p) =>
    message.includes(String(p.tracking_number).toLowerCase()),
  );
  if (
    matched.length ||
    /track|package|where.*order|delivery status/.test(message)
  ) {
    const packages = matched.length ? matched : data.packages.slice(0, 5);
    answer = packages.length
      ? packages
          .map(
            (p) =>
              `${p.tracking_number}: ${String(p.status).replaceAll("_", " ")}. ${p.destination ? `Destination: ${p.destination}.` : ""}${p.hold_reason ? " The team is reviewing a hold; contact support for help." : ""}`,
          )
          .join("\n")
      : "You have no packages listed yet. Register a pre-alert when you have a tracking number.";
    for (const p of packages)
      links.push({
        label: `Track ${p.tracking_number}`,
        href: `/pilot/account/packages/${p.id}`,
      });
    links.push({
      label: "All packages / add a pre-alert",
      href: "/pilot/account?tab=Packages",
    });
  } else if (/receipt|document|upload/.test(message)) {
    const missing = data.packages.filter(
      (p) =>
        !["delivered", "cancelled"].includes(p.status) &&
        !data.records.some(
          (r) =>
            r.kind === "receipt" &&
            r.status !== "rejected" &&
            r.payload.packageId === p.id &&
            data.files.some((f) => f.record_id === r.id),
        ),
    );
    answer = `You have ${data.files.length} uploaded documents in your document library. ${
      missing.length
        ? `${missing.length} packages need a purchase receipt: ${missing
            .slice(0, 5)
            .map((p) => p.tracking_number)
            .join(
              ", ",
            )}. Register the document under Documents, then attach its original PDF, PNG or JPEG.`
        : "No missing purchase receipts were found in your current package list."
    } Staff reviews documents before customs clearance.`;
    links.push({
      label: "Upload / view documents",
      href: "/pilot/account?tab=Documents",
    });
  } else if (/bill|invoice|balance|pay|refund|owe/.test(message)) {
    const unpaid = data.bills.filter((b) => Number(b.balance_cents) > 0);
    const balances = new Map<string, number>();
    for (const b of unpaid)
      balances.set(
        b.payload.currency,
        (balances.get(b.payload.currency) ?? 0) + Number(b.balance_cents),
      );
    answer = unpaid.length
      ? `Your outstanding balance is ${[...balances].map(([currency, cents]) => `${(cents / 100).toFixed(2)} ${currency}`).join(" and ")} across ${unpaid.length} issued ${unpaid.length === 1 ? "bill" : "bills"}. Contact ${c.organization_name} to arrange payment. Confirmed external payments appear in your bill history.`
      : "You have no outstanding issued bills in your current account list. Drafts are reviewed by staff before appearing here.";
    if (data.bills.length === 100)
      answer +=
        " This summary covers your latest 100 bills; contact the team for a full statement.";
    if (unpaid.some((b) => b.payload.samplePricing))
      answer +=
        " Some bills use sample preview pricing; these are not confirmed live charges.";
    for (const b of unpaid.slice(0, 5))
      links.push({
        label: b.payload.description,
        href: `/pilot/account/bills/${b.id}`,
      });
    links.push({ label: "Bills & payments", href: "/pilot/account?tab=Bills" });
  } else if (
    /shipment|ship|consolidat|together|rate|price|cost/.test(message)
  ) {
    answer = `You have ${data.shipments.filter((s) => !["delivered", "cancelled"].includes(s.status)).length} active shipments. To ship packages together, select ready packages under Shipments and request shipping. The team confirms availability, price and customs requirements before dispatch. A request does not reserve packages. Ask for a quote for your route; sample preview rates are not confirmed prices.`;
    links.push(
      {
        label: "Shipments / request shipping",
        href: "/pilot/account?tab=Shipments",
      },
      { label: "Request a quote", href: "/pilot/account?tab=Quotes" },
    );
  } else if (
    /support|human|person|help|contact|claim|damag|missing|address/.test(
      message,
    )
  ) {
    answer = `Contact ${c.organization_name} through Support for your shipping address, delivery questions or account help. For lost or damaged items, open a claim with the related package and supporting details. Your request appears in the staff workspace for review.`;
    links.push(
      { label: "Contact the team", href: "/pilot/account?tab=Support" },
      { label: "Open a claim", href: "/pilot/account?tab=Claims" },
    );
  } else if (/notification|update/.test(message)) {
    answer = `You have ${data.notifications.filter((n) => !n.read_at).length} unread updates. Open Notifications to review them.`;
    links.push({
      label: "View notifications",
      href: "/pilot/account?tab=Notifications",
    });
  } else if (/buy|shop|purchase/.test(message)) {
    answer =
      "Submit a shopping request with the item, store link, quantity and preferences. Staff will send a price offer for you to review before accepting.";
    links.push({
      label: "Shopping requests",
      href: "/pilot/account?tab=Shopping%20requests",
    });
  }
  return { answer, links };
}
