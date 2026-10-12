import Link from "next/link";
import { BillingBreakdown } from "@/components/pilot/BillingBreakdown";
import { notFound, redirect } from "next/navigation";
import { customerDetail } from "@/server/customer-detail";
import { withCustomer } from "@/server/customer-tracking";
import { customerToken } from "@/server/customer-http";
import { PilotError } from "@/server/pilot";
import { PrintButton } from "@/components/pilot/PrintButton";
export const dynamic = "force-dynamic";
const readable = (value: unknown) =>
  String(value ?? "Not yet available").replaceAll("_", " ");
const date = (value: unknown) =>
  new Date(String(value)).toLocaleString("en-BS", {
    timeZone: "America/Nassau",
  });
const money = (value: unknown, currency: unknown) =>
  `${(Number(value) / 100).toFixed(2)} ${String(currency)}`;
export default async function Detail({
  params,
}: {
  params: Promise<{ kind: string; id: string }>;
}) {
  const { kind, id } = await params;
  let detail;
  try {
    detail = await withCustomer(await customerToken(), (db, c) =>
      customerDetail(db, c, kind, id),
    );
  } catch (e) {
    if (e instanceof PilotError && e.status === 401) redirect("/pilot/sign-in");
    if (e instanceof PilotError && [400, 404].includes(e.status)) notFound();
    throw e;
  }
  const { item, files, related, events, balance, organization, customer } =
    detail;
  const bill = kind === "bills",
    pkg = kind === "packages";
  const payload = item.payload ?? {};
  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <Link
        className="portal-no-print text-teal-700"
        href={`/pilot/account?tab=${pkg ? "Packages" : bill ? "Bills" : "Shipments"}`}
      >
        ← Back to my {kind}
      </Link>
      <div className="my-7">
        <p className="text-sm font-bold text-teal-700">
          {organization} · {customer}
        </p>
        <h1 className="mt-3 break-all text-3xl font-bold">
          {pkg
            ? item.tracking_number
            : bill
              ? "Your bill"
              : "Shipment to " + readable(item.destination)}
        </h1>
        <p className="mt-3 capitalize">
          {readable(item.status)} · Updated{" "}
          {date(item.updated_at ?? item.created_at)}
        </p>
      </div>
      <section className="rounded-2xl border bg-white p-6">
        <h2 className="mb-5 text-xl font-bold">
          {pkg ? "Package details" : bill ? "Bill summary" : "Shipping details"}
        </h2>
        <dl className="portal-detail-grid">
          {(pkg
            ? [
                ["Merchant", item.merchant || "Not provided"],
                ["Contents", item.item_description || "Not provided"],
                ["Destination", item.destination || "To be confirmed"],
                ["Service", item.service],
                [
                  "Weight",
                  item.weight_kg
                    ? item.weight_kg + " kg"
                    : "Measured on arrival",
                ],
                [
                  "Dimensions",
                  item.length_cm
                    ? `${item.length_cm} × ${item.width_cm} × ${item.height_cm} cm`
                    : "Measured on arrival",
                ],
              ]
            : bill
              ? [
                  ["Reference", item.id],
                  ["Description", payload.description],
                  ["Total", money(payload.amountCents, payload.currency)],
                  ["Outstanding", money(balance, payload.currency)],
                  ["Due date", payload.dueDate || "Contact the team"],
                ]
              : [
                  ["Reference", item.id],
                  ["Destination", item.destination],
                  ["Service", item.service],
                  ["Customs", item.customs_status],
                  ["Delivery method", item.delivery_method],
                  [
                    "Delivery address",
                    item.delivery_address || "To be confirmed",
                  ],
                ]
          ).map(([label, value]) => (
            <div key={String(label)}>
              <dt className="text-sm text-slate-500">{String(label)}</dt>
              <dd className="mt-1 break-words font-semibold">
                {readable(value)}
              </dd>
            </div>
          ))}
        </dl>
        {bill && <BillingBreakdown payload={payload} />}
        {bill && (
          <div className="mt-6">
            <p>
              Contact {organization} to arrange payment. This balance reflects
              confirmed payments recorded by the team.
            </p>
            <div className="portal-no-print mt-4">
              <PrintButton label="Print or save bill" />
            </div>
          </div>
        )}
        {item.delivered_at && (
          <p className="mt-5">
            Received by {readable(item.received_by)} · {date(item.delivered_at)}
          </p>
        )}
      </section>
      {pkg && (
        <section className="mt-6 rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-bold">Tracking history</h2>
          <p className="mt-2 text-sm text-slate-500">
            Latest updates first · Nassau time
          </p>
          <ol className="mt-5 space-y-5">
            {events.map((e) => (
              <li
                key={String(e.id)}
                className="border-l-4 border-teal-600 pl-4"
              >
                <p className="font-semibold capitalize">
                  {readable(e.to_status ?? e.event_type)}
                </p>
                <time className="text-sm text-slate-500">
                  {date(e.occurred_at)}
                </time>
              </li>
            ))}
          </ol>
          {!events.length && (
            <p className="mt-4">
              The next update will appear when the team processes your package.
            </p>
          )}
        </section>
      )}
      <section className="mt-6 rounded-2xl border bg-white p-6">
        <h2 className="text-xl font-bold">
          {pkg
            ? "Related shipments"
            : bill
              ? "Payment history"
              : "Packages in this shipment"}
        </h2>
        {!related.length && (
          <p className="mt-4">
            {pkg
              ? "This package has not been assigned to a shipment yet."
              : bill
                ? "No payments recorded yet."
                : "No packages listed."}
          </p>
        )}
        {related.map((r) => (
          <div key={String(r.id)} className="mt-4 border-t pt-4">
            {bill ? (
              <>
                <p className="capitalize">
                  {readable(r.status)} ·{" "}
                  {money(
                    (r.payload as Record<string, unknown>).amountCents,
                    (r.payload as Record<string, unknown>).currency,
                  )}
                </p>
                <p className="text-sm">
                  {date(r.created_at)} · Reference{" "}
                  {readable((r.payload as Record<string, unknown>).reference)}
                </p>
              </>
            ) : (
              <Link
                className="font-semibold text-teal-700"
                href={`/pilot/account/${pkg ? "shipments" : "packages"}/${r.id}`}
              >
                {pkg ? readable(r.destination) : readable(r.tracking_number)} ·{" "}
                {readable(r.status)}
              </Link>
            )}
          </div>
        ))}
      </section>
      {kind !== "shipments" && (
        <section className="mt-6 rounded-2xl border bg-white p-6">
          <h2 className="text-xl font-bold">Documents</h2>
          {!files.length && <p className="mt-4">No documents attached yet.</p>}
          {files.map((f) => (
            <a
              className="mt-4 block break-all text-teal-700"
              href={`/api/pilot/customer/files?id=${f.id}`}
              key={f.id}
            >
              {f.name} ↓
            </a>
          ))}
          {pkg && (
            <Link
              className="portal-no-print mt-5 inline-block text-teal-700"
              href="/pilot/account?tab=Documents"
            >
              Upload a purchase receipt →
            </Link>
          )}
        </section>
      )}
      <Link
        className="portal-no-print mt-7 inline-block font-semibold text-teal-700"
        href="/pilot/account?tab=Support"
      >
        Need help? Contact the team →
      </Link>
    </main>
  );
}
