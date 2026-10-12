"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
type Row = {
  id: string;
  status?: string;
  version?: number;
  customer_id?: string;
  display_name?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};
type Snapshot = {
  organization: string;
  role: string;
  customers: Row[];
  packages: Row[];
  shipments: Row[];
  records: Row[];
  files: Row[];
  summary: { status: string; count: number }[];
  balances: { currency: string; outstanding_cents: string }[];
  audit: Row[];
  outbox: Row[];
  registrations: Row[];
};
type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "textarea"
    | "number"
    | "date"
    | "select"
    | "checkbox"
    | "packages";
  options?: { value: string; label: string }[];
  value?: string | number | boolean;
  required?: boolean;
};
type Panel = {
  title: string;
  action: string;
  row?: Row;
  fields: Field[];
  note?: string;
};
const managers = ["owner", "admin", "manager"],
  warehouse = [...managers, "warehouse"],
  accounting = [...managers, "accounting"],
  reviewers = [...managers, "customs"],
  support = [...managers, "support"];
const recordLabels: Record<string, string> = {
  bill: "Bills",
  payment: "Payments",
  receipt: "Documents",
  support: "Support",
  claim: "Claims",
  procurement: "Procurement",
  quote: "Quotes",
  exception: "Exceptions",
  rate: "Rates",
  voyage: "Voyages",
};
const transitions: Record<string, Record<string, string[]>> = {
  bill: { draft: ["issued", "void"], issued: ["void"] },
  receipt: { submitted: ["verified", "rejected"], rejected: ["verified"] },
  support: { open: ["waiting", "resolved"], waiting: ["open", "resolved"] },
  claim: {
    submitted: ["review", "rejected"],
    review: ["resolved", "rejected", "waiting"],
    waiting: ["review", "resolved", "rejected"],
  },
  procurement: {
    requested: ["cancelled"],
    quoted: ["cancelled"],
    approved: ["purchased", "cancelled"],
    purchased: ["received"],
    received: ["shipped"],
    shipped: ["delivered"],
  },
  quote: { submitted: ["rejected"], offered: ["rejected"] },
  exception: { open: ["resolved"] },
  rate: { submitted: ["active", "retired"], active: ["retired"] },
  voyage: {
    submitted: ["scheduled", "cancelled"],
    scheduled: ["departed", "cancelled"],
    departed: ["arrived"],
  },
};
const option = (value: string) => ({
  value,
  label: value.replaceAll("_", " "),
});
const money = (cents: unknown, currency: unknown = "USD") =>
  `${(Number(cents ?? 0) / 100).toFixed(2)} ${String(currency)}`;
export default function Operations() {
  const [data, setData] = useState<Snapshot | null>(null),
    [ready, setReady] = useState(false),
    [tab, setTab] = useState("Overview"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [search, setSearch] = useState(""),
    [panel, setPanel] = useState<Panel | null>(null),
    [privateCode, setPrivateCode] = useState(""),
    [uploadTarget, setUploadTarget] = useState<Row | null>(null);
  const pending = useRef<{ body: string; key: string } | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/pilot/operations", { cache: "no-store" })
      .then(async (r) => {
        const result = await r.json();
        if (!active) return;
        if (r.ok) setData(result);
        else if (r.status !== 401) setMessage(result.error);
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setReady(true);
          setMessage("Unable to connect. Please reload.");
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function load() {
    const r = await fetch(
        "/api/pilot/operations?q=" + encodeURIComponent(search),
        { cache: "no-store" },
      ),
      result = await r.json();
    if (!r.ok) {
      if (r.status === 401) setData(null);
      throw new Error(result.error);
    }
    setData(result);
  }
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "Unable to connect. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  function open(p: Panel) {
    setPanel(p);
    setPrivateCode("");
    setUploadTarget(null);
    pending.current = null;
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!panel) return;
    const values = new FormData(form),
      details: Record<string, unknown> = {};
    for (const f of panel.fields)
      details[f.name] =
        f.type === "checkbox"
          ? values.has(f.name)
          : f.type === "number"
            ? values.get(f.name) === ""
              ? null
              : f.name.endsWith("Cents")
                ? Math.round(Number(values.get(f.name)) * 100)
                : Number(values.get(f.name))
            : f.type === "packages"
              ? values.getAll(f.name)
              : (values.get(f.name) ?? "");
    let bodyData = details;
    if (panel.action === "record.create") {
      const { kind, customerId, ...payload } = details;
      bodyData = { kind, customerId: customerId || null, payload };
    }
    const body = JSON.stringify({
      action: panel.action,
      id: panel.row?.id,
      version: panel.row?.version,
      data: bodyData,
    });
    if (pending.current?.body !== body)
      pending.current = { body, key: crypto.randomUUID() };
    await run(async () => {
      const r = await fetch("/api/pilot/operations", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": pending.current!.key,
          },
          body,
        }),
        result = await r.json();
      if (!r.ok) throw new Error(result.error);
      pending.current = null;
      setPanel(null);
      if (result.token) setPrivateCode(result.token);
      setMessage(
        result.codeAlreadyIssued
          ? "Code was already issued. Issue a replacement if the original response was lost."
          : "Saved. The operational record and audit history are up to date.",
      );
      await load();
    });
  }
  const allowed = (roles: string[]) =>
    Boolean(data && roles.includes(data.role));
  const customerOptions =
    data?.customers
      .filter((c) => !c.archived_at)
      .map((c) => ({ value: c.id, label: String(c.display_name) })) ?? [];
  const packageOptions =
    data?.packages.map((p) => ({
      value: p.id,
      label: `${p.tracking_number ?? p.id} · ${p.display_name}`,
    })) ?? [];
  function recordForm(kind: string) {
    const fields: Field[] = [
      {
        name: "kind",
        label: "Record type",
        type: "select",
        options: [option(kind)],
        value: kind,
      },
      {
        name: "customerId",
        label: "Customer",
        type: "select",
        options: customerOptions,
        required: !["rate", "voyage"].includes(kind),
      },
      {
        name: "description",
        label: "Description",
        type: "textarea",
        required: true,
      },
    ];
    if (["bill", "receipt", "rate"].includes(kind))
      fields.push(
        {
          name: "amountCents",
          label: "Amount",
          type: "number",
          required: true,
        },
        {
          name: "currency",
          label: "Currency",
          type: "select",
          options: ["USD", "BSD"].map(option),
          value: "USD",
        },
      );
    if (kind === "bill")
      fields.push({
        name: "dueDate",
        label: "Due date",
        type: "date",
        required: true,
      });
    if (
      kind === "receipt" ||
      ["support", "claim", "procurement", "quote", "exception"].includes(kind)
    )
      fields.push({
        name: "packageId",
        label: "Related package (optional)",
        type: "select",
        options: packageOptions,
      });
    if (kind === "voyage")
      fields.push(
        {
          name: "departure",
          label: "Departure date",
          type: "date",
          required: true,
        },
        { name: "destination", label: "Destination", required: true },
        {
          name: "service",
          label: "Service",
          type: "select",
          options: ["air", "ocean"].map(option),
          value: "air",
        },
      );
    open({
      title: "Create " + (recordLabels[kind] ?? kind),
      action: "record.create",
      fields,
    });
  }
  const button =
    "rounded-lg border bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50";
  const tabs = [
    "Overview",
    "Registrations",
    "Customers",
    "Warehouse",
    "Shipments",
    "Customs",
    "Billing",
    "Documents",
    "Support",
    "Claims",
    "Procurement",
    "Quotes",
    "Exceptions",
    "Rates",
    "Voyages",
    "Notifications",
    "Audit",
  ];
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal-700">
              {data?.organization ?? "PCL Imports"} · OPERATIONS
            </p>
            <h1 className="mt-2 text-3xl font-bold">Operations workspace</h1>
            <p className="mt-2 text-slate-600">
              Warehouse, shipping and customer service in one place.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/pilot" className={button}>
              Package intake
            </Link>
            <Link href="/pilot/customers" className={button}>
              Add customers
            </Link>
            {data && (
              <a
                className={button}
                href={
                  "/api/pilot/export?kind=" +
                  (["Billing"].includes(tab)
                    ? "billing"
                    : tab === "Audit"
                      ? "audit"
                      : "inventory")
                }
              >
                Export{" "}
                {tab === "Billing"
                  ? "billing"
                  : tab === "Audit"
                    ? "audit"
                    : "inventory"}
              </a>
            )}
            {data && (
              <button
                disabled={busy}
                className={button}
                onClick={() =>
                  run(async () => {
                    const r = await fetch("/api/pilot/session", {
                      method: "DELETE",
                    });
                    if (!r.ok) throw new Error((await r.json()).error);
                    setData(null);
                    setPrivateCode("");
                    setPanel(null);
                  })
                }
              >
                Sign out
              </button>
            )}
          </div>
        </header>
        {message && (
          <p
            role="status"
            className="mb-5 rounded-xl border border-teal-200 bg-teal-50 p-4"
          >
            {message}
          </p>
        )}
        {privateCode && (
          <section className="mb-5 rounded-xl border border-amber-300 bg-amber-50 p-5">
            <h2 className="font-bold">Private customer access code</h2>
            <p className="mt-2 text-sm">
              Valid for eight hours. Share securely with this customer.
              Replacing it revokes their previous codes.
            </p>
            <code className="my-3 block break-all">{privateCode}</code>
            <button
              className={button}
              onClick={() => navigator.clipboard.writeText(privateCode)}
            >
              Copy code
            </button>
          </section>
        )}
        {!ready ? (
          <p>Connecting…</p>
        ) : !data ? (
          <form
            className="max-w-md rounded-2xl border bg-white p-6"
            onSubmit={(e) => {
              e.preventDefault();
              const fields = new FormData(e.currentTarget);
              void run(async () => {
                const r = await fetch("/api/pilot/session", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ token: fields.get("token") }),
                });
                if (!r.ok) throw new Error((await r.json()).error);
                await load();
              });
            }}
          >
            <h2 className="text-xl font-semibold">Staff sign in</h2>
            <label htmlFor="ops-code" className="mt-5 block">
              Staff access code
            </label>
            <input
              id="ops-code"
              name="token"
              type="password"
              required
              autoComplete="off"
              className="mt-2 w-full rounded-lg border p-3"
            />
            <button
              disabled={busy}
              className="mt-5 rounded-lg bg-teal-700 px-5 py-3 text-white"
            >
              Open operations
            </button>
          </form>
        ) : (
          <>
            <nav
              aria-label="Operations modules"
              className="mb-6 flex flex-wrap gap-2"
            >
              {tabs
                .filter((name) =>
                  name === "Registrations" ||
                  name === "Audit" ||
                  name === "Notifications" ||
                  name === "Rates" ||
                  name === "Voyages"
                    ? allowed(managers)
                    : name === "Billing"
                      ? allowed([...accounting, "support"])
                      : name === "Procurement"
                        ? allowed(managers)
                        : name === "Customs"
                          ? allowed(reviewers)
                          : true,
                )
                .map((name) => (
                  <button
                    key={name}
                    disabled={busy}
                    aria-current={tab === name ? "page" : undefined}
                    className={`${button} ${tab === name ? "!bg-teal-700 !text-white" : ""}`}
                    onClick={() => {
                      setTab(name);
                      setPanel(null);
                      setUploadTarget(null);
                      setPrivateCode("");
                    }}
                  >
                    {name}
                  </button>
                ))}
            </nav>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(load);
              }}
              className="mb-6 flex gap-2"
            >
              <label htmlFor="ops-search" className="sr-only">
                Search operations
              </label>
              <input
                id="ops-search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                maxLength={100}
                placeholder="Search package tracking, customer name, bin or reference"
                className="min-w-0 flex-1 rounded-lg border bg-white p-3"
              />
              <button disabled={busy} className={button}>
                Search / refresh
              </button>
            </form>
            {panel && (
              <form
                onSubmit={submit}
                className="mb-8 rounded-2xl border border-teal-300 bg-white p-6"
              >
                <div className="flex justify-between gap-4">
                  <h2 className="text-xl font-bold">{panel.title}</h2>
                  <button
                    type="button"
                    disabled={busy}
                    className={button}
                    onClick={() => setPanel(null)}
                  >
                    Close
                  </button>
                </div>
                {panel.note && (
                  <p className="mt-3 text-slate-600">{panel.note}</p>
                )}
                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  {panel.fields.map((f) => (
                    <label
                      key={f.name}
                      className={
                        f.type === "textarea" || f.type === "packages"
                          ? "md:col-span-2"
                          : ""
                      }
                    >
                      <span className="block font-semibold">{f.label}</span>
                      {f.type === "select" ? (
                        <select
                          aria-label={f.label}
                          name={f.name}
                          defaultValue={String(f.value ?? "")}
                          required={f.required}
                          className="mt-2 w-full rounded-lg border bg-white p-3"
                        >
                          <option value="">Choose…</option>
                          {f.options?.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      ) : f.type === "checkbox" ? (
                        <input
                          aria-label={f.label}
                          name={f.name}
                          type="checkbox"
                          defaultChecked={Boolean(f.value)}
                          className="mt-3 h-5 w-5"
                        />
                      ) : f.type === "packages" ? (
                        <div className="mt-3 max-h-72 space-y-2 overflow-auto">
                          {data.packages
                            .filter(
                              (p) => p.status === "ready" && !p.hold_reason,
                            )
                            .map((p) => (
                              <label
                                key={p.id}
                                className="flex gap-3 rounded-lg border p-3"
                              >
                                <input
                                  name={f.name}
                                  type="checkbox"
                                  value={p.id}
                                />
                                <span>
                                  {String(p.tracking_number)} · {p.display_name}{" "}
                                  · {String(p.destination)} ·{" "}
                                  {String(p.service)}
                                </span>
                              </label>
                            ))}
                        </div>
                      ) : f.type === "textarea" ? (
                        <textarea
                          aria-label={f.label}
                          name={f.name}
                          required={f.required}
                          defaultValue={String(f.value ?? "")}
                          maxLength={2000}
                          className="mt-2 min-h-24 w-full rounded-lg border p-3"
                        />
                      ) : (
                        <input
                          aria-label={f.label}
                          name={f.name}
                          type={f.type ?? "text"}
                          required={f.required}
                          defaultValue={String(
                            f.value !== undefined &&
                              f.name.endsWith("Cents") &&
                              f.value !== ""
                              ? Number(f.value) / 100
                              : (f.value ?? ""),
                          )}
                          min={f.type === "number" ? 0 : undefined}
                          step={
                            f.type === "number"
                              ? f.name.endsWith("Cents")
                                ? 0.01
                                : 1
                              : undefined
                          }
                          maxLength={2000}
                          className="mt-2 w-full rounded-lg border p-3"
                        />
                      )}
                    </label>
                  ))}
                </div>
                <button
                  disabled={busy}
                  className="mt-6 rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white"
                >
                  {busy ? "Saving…" : "Save action"}
                </button>
              </form>
            )}
            {uploadTarget && (
              <form
                className="mb-6 rounded-xl border bg-white p-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = e.currentTarget,
                    values = new FormData(form);
                  values.set("customerId", uploadTarget.customer_id!);
                  if (uploadTarget.kind)
                    values.set("recordId", uploadTarget.id);
                  else values.set("packageId", uploadTarget.id);
                  void run(async () => {
                    const r = await fetch("/api/pilot/files", {
                      method: "POST",
                      body: values,
                    });
                    if (!r.ok) throw new Error((await r.json()).error);
                    setMessage("File securely saved.");
                    setUploadTarget(null);
                    await load();
                  });
                }}
              >
                <h2 className="font-bold">Attach photo or purchase document</h2>
                <input
                  aria-label="Attachment file"
                  name="file"
                  type="file"
                  required
                  accept="image/png,image/jpeg,application/pdf"
                  className="mt-4 block max-w-full"
                />
                <p className="mt-2 text-sm text-slate-500">
                  PNG, JPEG or PDF; up to 5 MB.
                </p>
                <button disabled={busy} className={`${button} mt-4`}>
                  Upload file
                </button>
              </form>
            )}
            {tab === "Overview" && (
              <section>
                <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  {data.summary.map((s) => (
                    <article
                      key={s.status}
                      className="rounded-2xl border bg-white p-5"
                    >
                      <p className="text-sm text-slate-600">
                        {s.status.replaceAll("_", " ")}
                      </p>
                      <p className="mt-2 text-3xl font-bold">{s.count}</p>
                    </article>
                  ))}
                </div>
                <div className="mt-6 flex flex-wrap gap-4">
                  {data.balances.map((b) => (
                    <p
                      key={b.currency}
                      className="rounded-xl border bg-white p-5"
                    >
                      Outstanding issued bills:{" "}
                      <strong>{money(b.outstanding_cents, b.currency)}</strong>
                    </p>
                  ))}
                </div>
                <p className="mt-6 text-sm text-slate-600">
                  Operational queues show the latest 100 packages/shipments and
                  300 records. Search narrows package and customer results.
                  Financial totals include all issued bills.
                </p>
              </section>
            )}
            {tab === "Registrations" && (
              <section>
                {data.registrations.map((r) => (
                  <article
                    key={r.id}
                    className="mb-4 rounded-xl border bg-white p-5"
                  >
                    <h2 className="font-bold">{r.display_name}</h2>
                    <p className="mt-2 break-all">
                      {String(r.email)} · {r.status}
                    </p>
                    {r.status === "pending" && allowed(managers) && (
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() =>
                          open({
                            title: "Review account registration",
                            action: "identity.review",
                            row: r,
                            note: "Approve only after independently verifying this person and their authority to access the selected customer records.",
                            fields: [
                              {
                                name: "status",
                                label: "Decision",
                                type: "select",
                                options: ["approved", "rejected"].map(option),
                                required: true,
                              },
                              {
                                name: "identityVerified",
                                label:
                                  "I independently verified customer identity and account ownership",
                                type: "checkbox",
                              },
                              {
                                name: "customerId",
                                label:
                                  "Existing customer (optional; leave blank to create a new customer)",
                                type: "select",
                                options: customerOptions,
                              },
                            ],
                          })
                        }
                      >
                        Review registration
                      </button>
                    )}
                  </article>
                ))}
              </section>
            )}
            {tab === "Customers" && (
              <section className="grid gap-4 md:grid-cols-2">
                {data.customers.map((c) => (
                  <article
                    key={c.id}
                    className="rounded-xl border bg-white p-5"
                  >
                    <h2 className="text-lg font-bold">{c.display_name}</h2>
                    <p className="mt-2 break-all">
                      {String(c.email ?? "No email")} ·{" "}
                      {String(c.phone ?? "No phone")}
                    </p>
                    <p className="mt-2 text-sm text-slate-500">
                      {c.archived_at ? "Archived" : "Active"}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {allowed([...warehouse, "support"]) && !c.archived_at && (
                        <button
                          className={button}
                          disabled={busy}
                          onClick={() =>
                            open({
                              title: "Edit customer",
                              action: "customer.update",
                              row: c,
                              fields: [
                                {
                                  name: "displayName",
                                  label: "Name",
                                  value: String(c.display_name),
                                  required: true,
                                },
                                {
                                  name: "email",
                                  label: "Email",
                                  value: String(c.email ?? ""),
                                },
                                {
                                  name: "phone",
                                  label: "Phone with country code",
                                  value: String(c.phone ?? ""),
                                },
                                {
                                  name: "emailNotifications",
                                  label: "Customer opted in to email updates",
                                  type: "checkbox",
                                  value: Boolean(c.email_notifications),
                                },
                              ],
                            })
                          }
                        >
                          Edit
                        </button>
                      )}
                      {allowed([...managers, "support"]) && !c.archived_at && (
                        <>
                          <button
                            className={button}
                            disabled={busy}
                            onClick={() =>
                              open({
                                title: "Issue private customer access",
                                action: "customer.access",
                                row: c,
                                note: "This replaces all previous access codes. The new code is shown once and lasts eight hours.",
                                fields: [
                                  {
                                    name: "revoke",
                                    label:
                                      "Revoke only (do not issue a replacement)",
                                    type: "checkbox",
                                  },
                                ],
                              })
                            }
                          >
                            Customer access
                          </button>
                        </>
                      )}
                      {allowed(managers) && !c.archived_at && (
                        <>
                          <button
                            className={button}
                            disabled={busy}
                            onClick={() =>
                              open({
                                title: "Archive customer",
                                action: "customer.archive",
                                row: c,
                                note: "This ends customer access and prevents new intake. Existing operational history remains.",
                                fields: [],
                              })
                            }
                          >
                            Archive
                          </button>
                          <button
                            className={button}
                            disabled={busy}
                            onClick={() =>
                              open({
                                title: "Merge customer records",
                                action: "customer.merge",
                                row: c,
                                note: "Packages, shipments, documents and service records move to the target. Source access codes are revoked; its profile is archived.",
                                fields: [
                                  {
                                    name: "targetId",
                                    label: "Target customer",
                                    type: "select",
                                    required: true,
                                    options: customerOptions.filter(
                                      (o) => o.value !== c.id,
                                    ),
                                  },
                                ],
                              })
                            }
                          >
                            Merge
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                ))}
              </section>
            )}
            {tab === "Warehouse" && (
              <section className="grid gap-4 md:grid-cols-2">
                {data.packages.map((p) => (
                  <article
                    key={p.id}
                    className="rounded-xl border bg-white p-5"
                  >
                    <h2 className="break-all text-lg font-bold">
                      {String(p.tracking_number)}
                    </h2>
                    <p className="mt-2">
                      {p.display_name} · {p.status} ·{" "}
                      {String(p.weight_kg ?? "—")} kg
                    </p>
                    <p className="mt-2 text-slate-600">
                      {String(p.destination || "Destination pending")} · Bin{" "}
                      {String(p.bin || "pending")}
                    </p>
                    {Boolean(p.hold_reason) && (
                      <p className="mt-2 text-amber-800">
                        Hold: {String(p.hold_reason)}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link
                        href={"/pilot/label/" + p.id}
                        className={button}
                        target="_blank"
                      >
                        Print label
                      </Link>
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() => {
                          setUploadTarget(p);
                          setPanel(null);
                        }}
                      >
                        Attach file
                      </button>
                      {allowed(warehouse) && (
                        <>
                          <button
                            className={button}
                            disabled={busy}
                            onClick={() =>
                              open({
                                title: "Package details",
                                action: "package.update",
                                row: p,
                                fields: [
                                  {
                                    name: "bin",
                                    label: "Warehouse bin",
                                    value: String(p.bin ?? ""),
                                  },
                                  {
                                    name: "merchant",
                                    label: "Merchant",
                                    value: String(p.merchant ?? ""),
                                  },
                                  {
                                    name: "itemDescription",
                                    label: "Description",
                                    type: "textarea",
                                    value: String(p.item_description ?? ""),
                                  },
                                  {
                                    name: "destination",
                                    label: "Destination",
                                    value: String(p.destination ?? ""),
                                    required: true,
                                  },
                                  {
                                    name: "service",
                                    label: "Service",
                                    type: "select",
                                    value: String(p.service),
                                    options: ["air", "ocean"].map(option),
                                  },
                                  {
                                    name: "declaredValueCents",
                                    label: "Declared value in USD (optional)",
                                    type: "number",
                                    value:
                                      p.declared_value_cents === null
                                        ? ""
                                        : Number(p.declared_value_cents),
                                  },
                                  {
                                    name: "condition",
                                    label: "Condition after human inspection",
                                    type: "select",
                                    value: String(p.condition),
                                    options: ["good", "damaged"].map(option),
                                  },
                                ],
                              })
                            }
                          >
                            Edit details
                          </button>
                          {["received", "processing"].includes(
                            p.status ?? "",
                          ) && (
                            <button
                              className={button}
                              disabled={busy}
                              onClick={() =>
                                open({
                                  title: "Move package forward",
                                  action: "package.transition",
                                  row: p,
                                  fields: [
                                    {
                                      name: "status",
                                      label: "Next status",
                                      type: "select",
                                      options: [
                                        option(
                                          p.status === "received"
                                            ? "processing"
                                            : "ready",
                                        ),
                                      ],
                                      value:
                                        p.status === "received"
                                          ? "processing"
                                          : "ready",
                                    },
                                  ],
                                })
                              }
                            >
                              {p.status === "received"
                                ? "Start processing"
                                : "Mark ready"}
                            </button>
                          )}
                        </>
                      )}
                      {allowed([...warehouse, "customs", "support"]) && (
                        <button
                          className={button}
                          disabled={busy}
                          onClick={() =>
                            open({
                              title: "Package hold",
                              action: "package.hold",
                              row: p,
                              note: "Leave the reason empty to release a hold.",
                              fields: [
                                {
                                  name: "reason",
                                  label: "Hold reason",
                                  type: "textarea",
                                  value: String(p.hold_reason ?? ""),
                                },
                              ],
                            })
                          }
                        >
                          Hold / release
                        </button>
                      )}
                    </div>
                    {data.files
                      .filter((f) => f.package_id === p.id)
                      .map((f) => (
                        <a
                          key={f.id}
                          className="mt-3 block break-all text-teal-700"
                          href={"/api/pilot/files?id=" + f.id}
                        >
                          {String(f.name)}
                        </a>
                      ))}
                  </article>
                ))}
              </section>
            )}
            {(tab === "Shipments" || tab === "Customs") && (
              <section>
                {tab === "Shipments" && allowed(warehouse) && (
                  <button
                    className={`${button} mb-5`}
                    disabled={busy}
                    onClick={() =>
                      open({
                        title: "Consolidate ready packages",
                        action: "shipment.create",
                        note: "Choose unheld packages for one customer, destination and service.",
                        fields: [
                          {
                            name: "packageIds",
                            label: "Ready packages",
                            type: "packages",
                          },
                          {
                            name: "destination",
                            label: "Destination",
                            required: true,
                          },
                          {
                            name: "service",
                            label: "Service",
                            type: "select",
                            options: ["air", "ocean"].map(option),
                            value: "air",
                          },
                          {
                            name: "deliveryMethod",
                            label: "Delivery method",
                            type: "select",
                            options: ["pickup", "delivery"].map(option),
                            value: "pickup",
                          },
                          {
                            name: "address",
                            label: "Delivery address (required for delivery)",
                          },
                        ],
                      })
                    }
                  >
                    Create shipment
                  </button>
                )}
                <div className="grid gap-4 md:grid-cols-2">
                  {data.shipments.map((s) => (
                    <article
                      key={s.id}
                      className="rounded-xl border bg-white p-5"
                    >
                      <a
                        className="text-sm font-semibold text-teal-700 underline"
                        href={
                          "/api/pilot/export?kind=manifest&shipment=" + s.id
                        }
                      >
                        Download package manifest
                      </a>
                      <h2 className="text-lg font-bold">
                        {s.display_name} · {String(s.destination)}
                      </h2>
                      <p className="mt-2">
                        {s.status} · {String(s.service)} · Customs:{" "}
                        {String(s.customs_status)}
                      </p>
                      <p className="mt-2 text-sm">
                        Packages: {(s.package_ids as string[]).length} ·{" "}
                        {String(s.delivery_method)}
                      </p>
                      <p className="mt-2 break-all text-xs text-slate-400">
                        {s.id}
                      </p>
                      {Boolean(s.received_by) && (
                        <p className="mt-2">
                          Received by {String(s.received_by)}
                        </p>
                      )}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {allowed(reviewers) && (
                          <button
                            className={button}
                            disabled={busy}
                            onClick={() =>
                              open({
                                title: "Record authorized customs review",
                                action: "shipment.customs",
                                row: s,
                                note: "Clearance requires verified purchase documentation for every package. Record the authorized decision and reference.",
                                fields: [
                                  {
                                    name: "status",
                                    label: "Review result",
                                    type: "select",
                                    options: [
                                      "review",
                                      "cleared",
                                      "blocked",
                                    ].map(option),
                                    required: true,
                                  },
                                  {
                                    name: "notes",
                                    label: "Decision / clearance reference",
                                    type: "textarea",
                                    required: true,
                                  },
                                ],
                              })
                            }
                          >
                            Customs review
                          </button>
                        )}
                        {allowed([...warehouse, "driver"]) && (
                          <button
                            className={button}
                            disabled={busy}
                            onClick={() =>
                              open({
                                title: "Shipment movement / delivery",
                                action: "shipment.transition",
                                row: s,
                                fields: [
                                  {
                                    name: "status",
                                    label: "Next status",
                                    type: "select",
                                    options: (
                                      {
                                        draft: ["ready", "cancelled"],
                                        ready: ["in_transit", "cancelled"],
                                        in_transit: ["arrived"],
                                        arrived: ["delivered"],
                                      }[s.status ?? "draft"] ?? []
                                    ).map(option),
                                    required: true,
                                  },
                                  {
                                    name: "driver",
                                    label: "Driver / delivery assignment",
                                    value: String(s.driver ?? ""),
                                  },
                                  {
                                    name: "receivedBy",
                                    label:
                                      "Recipient name (required when delivered)",
                                  },
                                ],
                              })
                            }
                          >
                            Update movement
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
            {[
              "Billing",
              "Documents",
              "Support",
              "Claims",
              "Procurement",
              "Quotes",
              "Exceptions",
              "Rates",
              "Voyages",
            ].includes(tab) && (
              <section>
                <div className="mb-5 flex flex-wrap gap-2">
                  {Object.entries(recordLabels)
                    .filter(([kind, label]) =>
                      tab === "Billing"
                        ? ["bill", "payment"].includes(kind)
                        : label === tab,
                    )
                    .filter(
                      ([kind]) =>
                        kind !== "payment" &&
                        (kind === "bill"
                          ? allowed(accounting)
                          : ["rate", "voyage", "procurement"].includes(kind)
                            ? allowed(managers)
                            : kind === "support" || kind === "claim"
                              ? allowed(support)
                              : allowed(warehouse)),
                    )
                    .map(([kind]) => (
                      <button
                        key={kind}
                        disabled={busy}
                        className={button}
                        onClick={() => recordForm(kind)}
                      >
                        Create {kind}
                      </button>
                    ))}
                  {tab === "Billing" && (
                    <p className="w-full text-sm text-slate-600">
                      Amounts are staff-entered. Payments/refunds record
                      transactions completed externally; this screen does not
                      move funds.
                    </p>
                  )}
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {data.records
                    .filter((r) =>
                      tab === "Billing"
                        ? ["bill", "payment"].includes(String(r.kind))
                        : recordLabels[String(r.kind)] === tab,
                    )
                    .map((r) => (
                      <article
                        key={r.id}
                        className="rounded-xl border bg-white p-5"
                      >
                        <h2 className="text-lg font-bold">
                          {String(r.kind)} · {r.display_name ?? "Organization"}
                        </h2>
                        <p className="mt-2 whitespace-pre-wrap break-words">
                          {String(
                            r.payload?.description ??
                              r.payload?.reference ??
                              "",
                          )}
                        </p>
                        <p className="mt-2 font-semibold text-teal-700">
                          {r.status}
                          {r.payload?.amountCents !== undefined
                            ? " · " +
                              money(r.payload.amountCents, r.payload.currency)
                            : ""}
                        </p>
                        <p className="mt-2 break-all text-xs text-slate-400">
                          {r.id}
                        </p>
                        {Array.isArray(r.payload?.updates) &&
                          (
                            r.payload.updates as {
                              note: string;
                              status: string;
                            }[]
                          )
                            .slice(-3)
                            .map((u, i) => (
                              <p
                                key={i}
                                className="mt-3 border-l-2 border-teal-200 pl-3 text-sm"
                              >
                                {u.status}: {u.note}
                              </p>
                            ))}
                        <div className="mt-4 flex flex-wrap gap-2">
                          {["quote", "procurement"].includes(String(r.kind)) &&
                            ["submitted", "requested"].includes(
                              r.status ?? "",
                            ) &&
                            allowed(managers) && (
                              <button
                                className={button}
                                disabled={busy}
                                onClick={() =>
                                  open({
                                    title: "Price offer for customer approval",
                                    action: "quote.offer",
                                    row: r,
                                    fields: [
                                      {
                                        name: "amountCents",
                                        label: "Total amount",
                                        type: "number",
                                        required: true,
                                      },
                                      {
                                        name: "currency",
                                        label: "Currency",
                                        type: "select",
                                        options: ["USD", "BSD"].map(option),
                                        value: "USD",
                                      },
                                      {
                                        name: "note",
                                        label: "Price inclusions and terms",
                                        type: "textarea",
                                        required: true,
                                      },
                                    ],
                                  })
                                }
                              >
                                Send price offer
                              </button>
                            )}
                          {transitions[String(r.kind)]?.[r.status ?? ""] && (
                            <button
                              className={button}
                              disabled={busy}
                              onClick={() =>
                                open({
                                  title: "Update " + String(r.kind),
                                  action: "record.update",
                                  row: r,
                                  fields: [
                                    {
                                      name: "status",
                                      label: "Next status",
                                      type: "select",
                                      options:
                                        transitions[String(r.kind)][
                                          r.status!
                                        ].map(option),
                                      required: true,
                                    },
                                    {
                                      name: "note",
                                      label:
                                        "Customer-visible update / resolution",
                                      type: "textarea",
                                      required: true,
                                    },
                                  ],
                                })
                              }
                            >
                              Review / update
                            </button>
                          )}
                          {r.kind === "receipt" && (
                            <button
                              className={button}
                              disabled={busy}
                              onClick={() => {
                                setUploadTarget(r);
                                setPanel(null);
                              }}
                            >
                              Upload document
                            </button>
                          )}
                          {r.kind === "bill" &&
                            r.status === "issued" &&
                            allowed(accounting) && (
                              <button
                                className={button}
                                disabled={busy}
                                onClick={() =>
                                  open({
                                    title: "Record external payment",
                                    action: "payment.record",
                                    fields: [
                                      {
                                        name: "billId",
                                        label: "Issued bill",
                                        type: "select",
                                        options: [
                                          {
                                            value: r.id,
                                            label: String(
                                              r.payload?.description,
                                            ),
                                          },
                                        ],
                                        value: r.id,
                                      },
                                      {
                                        name: "amountCents",
                                        label: "Paid amount",
                                        type: "number",
                                        required: true,
                                      },
                                      {
                                        name: "method",
                                        label: "Payment method",
                                        type: "select",
                                        options: [
                                          "cash",
                                          "bank_transfer",
                                          "card_external",
                                        ].map(option),
                                        required: true,
                                      },
                                      {
                                        name: "reference",
                                        label:
                                          "Unique transaction / receipt reference",
                                        required: true,
                                      },
                                    ],
                                  })
                                }
                              >
                                Record payment
                              </button>
                            )}
                          {r.kind === "payment" &&
                            r.status === "recorded" &&
                            allowed(accounting) && (
                              <button
                                className={button}
                                disabled={busy}
                                onClick={() =>
                                  open({
                                    title: "Record completed external refund",
                                    action: "payment.refund",
                                    row: r,
                                    fields: [
                                      {
                                        name: "reference",
                                        label: "External refund reference",
                                        required: true,
                                      },
                                      {
                                        name: "note",
                                        label: "Reason / confirmation",
                                        type: "textarea",
                                        required: true,
                                      },
                                    ],
                                  })
                                }
                              >
                                Record refund
                              </button>
                            )}
                        </div>
                        {data.files
                          .filter((f) => f.record_id === r.id)
                          .map((f) => (
                            <a
                              key={f.id}
                              className="mt-3 block break-all text-teal-700"
                              href={"/api/pilot/files?id=" + f.id}
                            >
                              {String(f.name)}
                            </a>
                          ))}
                      </article>
                    ))}
                </div>
              </section>
            )}
            {tab === "Notifications" && (
              <section>
                <h2 className="mb-4 text-xl font-bold">
                  Outbound delivery queue
                </h2>
                <p className="mb-5 text-slate-600">
                  Customer updates are also saved in-app. External email
                  requires an opted-in customer and a configured delivery
                  worker.
                </p>
                {data.outbox.map((n) => (
                  <article
                    key={n.id}
                    className="mb-3 rounded-xl border bg-white p-4"
                  >
                    <strong>
                      {String(n.channel)} · {n.status}
                    </strong>
                    <p className="mt-2 text-sm">
                      Attempts: {String(n.attempts)}
                      {n.last_error ? " · " + String(n.last_error) : ""}
                    </p>
                    {n.status === "failed" && (
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() =>
                          open({
                            title: "Retry external notification",
                            action: "notification.retry",
                            row: n,
                            fields: [],
                            note: "SMTP delivery can be duplicated if a provider accepted an earlier attempt. Check the provider before retrying.",
                          })
                        }
                      >
                        Retry delivery
                      </button>
                    )}
                  </article>
                ))}
              </section>
            )}
            {tab === "Audit" && (
              <section>
                {data.audit.map((a) => (
                  <article
                    key={a.id}
                    className="mb-3 rounded-xl border bg-white p-4"
                  >
                    <strong>{String(a.event_type)}</strong>
                    <p className="mt-2 break-all text-sm">
                      {String(a.actor_user_id)} · {String(a.entity_id)}
                    </p>
                    <time className="mt-1 text-sm text-slate-500">
                      {new Date(String(a.created_at)).toLocaleString()}
                    </time>
                  </article>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
