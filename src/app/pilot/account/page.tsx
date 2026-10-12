"use client";
import Link from "next/link";
import { CustomerDashboard } from "@/components/pilot/Dashboard";
import { useEffect, useRef, useState } from "react";
type Row = {
  id: string;
  status?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};
type Workspace = {
  customer: string;
  organization: string;
  profile: {
    email: string | null;
    phone: string | null;
    email_notifications: boolean;
  };
  packages: Row[];
  shipments: Row[];
  records: Row[];
  notifications: Row[];
  files: Row[];
  bills: Row[];
};
const labels: Record<string, string> = {
  receipt: "Documents",
  support: "Support",
  claim: "Claims",
  procurement: "Shopping requests",
  quote: "Quotes",
};
export default function Account() {
  const [data, setData] = useState<Workspace | null>(null),
    [ready, setReady] = useState(false),
    [tab, setTab] = useState("Dashboard"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [search, setSearch] = useState(""),
    [packageStatus, setPackageStatus] = useState("all");
  const pending = useRef<{ body: string; key: string } | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/pilot/customer/workspace", { cache: "no-store" })
      .then(async (r) => {
        const result = await r.json();
        if (!active) return;
        if (r.ok) {
          setData(result);
          const requested = new URLSearchParams(window.location.search).get(
            "tab",
          );
          if (
            requested &&
            [
              "Dashboard",
              "Packages",
              "Shipments",
              "Bills",
              ...Object.values(labels),
              "Notifications",
              "Settings",
            ].includes(requested)
          )
            setTab(requested);
        } else if (r.status !== 401) setMessage(result.error);
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
    const r = await fetch("/api/pilot/customer/workspace", {
        cache: "no-store",
      }),
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
  async function post(
    action: string,
    details: Record<string, unknown>,
    recordId?: string,
  ) {
    const body = JSON.stringify({ action, data: details, id: recordId });
    if (pending.current?.body !== body)
      pending.current = { body, key: crypto.randomUUID() };
    const r = await fetch("/api/pilot/customer/workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": pending.current.key,
        },
        body,
      }),
      result = await r.json();
    if (!r.ok) {
      if (r.status === 401) setData(null);
      throw new Error(result.error);
    }
    pending.current = null;
    return result;
  }
  const input = "mt-2 w-full rounded-lg border border-slate-300 bg-white p-3";
  const button =
    "rounded-lg border bg-white px-4 py-3 font-semibold disabled:opacity-50";
  const kind = Object.keys(labels).find((k) => labels[k] === tab);
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex flex-wrap justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal-700">
              {data
                ? "Hi " + data.customer.split(" ")[0] + " 👋"
                : "PCL Imports · CUSTOMER ACCOUNT"}
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              {data
                ? tab === "Dashboard"
                  ? "Here’s everything in one place."
                  : "Welcome, " + data.customer
                : "Your shipping account"}
            </h1>
          </div>
          <div className="flex gap-2">
            <Link href="/pilot/tracking" className={button}>
              Tracking
            </Link>
            {data && (
              <button
                className={button}
                disabled={busy}
                onClick={() =>
                  run(async () => {
                    const r = await fetch("/api/pilot/customer-session", {
                      method: "DELETE",
                    });
                    if (!r.ok) throw new Error((await r.json()).error);
                    setData(null);
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
        {!ready ? (
          <p>Loading your account…</p>
        ) : !data ? (
          <section className="rounded-2xl border bg-white p-6">
            <h2 className="text-xl font-semibold">Private sign-in required</h2>
            <p className="mt-3 text-slate-600">
              Use your customer access code to open tracking and your account.
            </p>
            <Link
              className={`${button} mt-5 inline-block`}
              href="/pilot/sign-in"
            >
              Sign in with email and password
            </Link>
            <Link className="mt-4 block text-teal-700" href="/pilot/tracking">
              Use a private code instead
            </Link>
          </section>
        ) : (
          <>
            <nav
              aria-label="Customer modules"
              className="mb-6 flex flex-wrap gap-2"
            >
              {[
                "Dashboard",
                "Packages",
                "Shipments",
                "Bills",
                "Documents",
                "Support",
                "Claims",
                "Shopping requests",
                "Quotes",
                "Notifications",
                "Settings",
              ].map((name) => (
                <button
                  key={name}
                  disabled={busy}
                  className={`${button} ${tab === name ? "!bg-teal-700 !text-white" : ""}`}
                  aria-current={tab === name ? "page" : undefined}
                  onClick={() => setTab(name)}
                >
                  {name}
                </button>
              ))}
            </nav>
            {tab === "Dashboard" && (
              <CustomerDashboard data={data} open={setTab} />
            )}
            {tab === "Packages" && (
              <section>
                <form
                  className="mb-6 rounded-2xl border bg-white p-6"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget,
                      values = new FormData(form);
                    void run(async () => {
                      await post("prealert", {
                        trackingNumber: values.get("trackingNumber"),
                        merchant: values.get("merchant"),
                        description: values.get("description"),
                        destination: values.get("destination"),
                        service: values.get("service"),
                      });
                      form.reset();
                      setMessage("Your expected package is registered.");
                      await load();
                    });
                  }}
                >
                  <h2 className="text-xl font-bold">
                    Tell us a package is coming
                  </h2>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <label>
                      Tracking number
                      <input
                        name="trackingNumber"
                        required
                        minLength={3}
                        maxLength={100}
                        className={input}
                      />
                    </label>
                    <label>
                      Merchant
                      <input
                        name="merchant"
                        required
                        maxLength={120}
                        className={input}
                      />
                    </label>
                    <label>
                      Item description
                      <input
                        name="description"
                        required
                        maxLength={1000}
                        className={input}
                      />
                    </label>
                    <label>
                      Destination
                      <input
                        name="destination"
                        required
                        maxLength={120}
                        className={input}
                      />
                    </label>
                    <label>
                      Shipping service
                      <select
                        aria-label="Shipping service"
                        name="service"
                        className={input}
                      >
                        <option value="air">Air</option>
                        <option value="ocean">Ocean</option>
                      </select>
                    </label>
                  </div>
                  <button disabled={busy} className={`${button} mt-6`}>
                    Register expected package
                  </button>
                </form>
                <div className="space-y-4">
                  <div className="rounded-2xl border bg-white p-5">
                    <label className="block">
                      Search my packages
                      <input
                        className={input}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Tracking, merchant or contents"
                      />
                    </label>
                    <label className="mt-4 block">
                      Package status
                      <select
                        className={input}
                        value={packageStatus}
                        onChange={(e) => setPackageStatus(e.target.value)}
                      >
                        <option value="all">All statuses</option>
                        {Array.from(
                          new Set(data.packages.map((p) => p.status)),
                        ).map((status) => (
                          <option key={status} value={status}>
                            {status?.replaceAll("_", " ")}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="mt-3 text-sm text-slate-500">
                      Showing your latest {data.packages.length} packages.
                    </p>
                  </div>
                  {!data.packages.filter(
                    (p) =>
                      (packageStatus === "all" || p.status === packageStatus) &&
                      [p.tracking_number, p.merchant, p.item_description].some(
                        (v) =>
                          String(v ?? "")
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                      ),
                  ).length && <p>No packages match your search.</p>}
                  {data.packages
                    .filter(
                      (p) =>
                        (packageStatus === "all" ||
                          p.status === packageStatus) &&
                        [
                          p.tracking_number,
                          p.merchant,
                          p.item_description,
                        ].some((v) =>
                          String(v ?? "")
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                        ),
                    )
                    .map((p) => (
                      <article
                        key={p.id}
                        className="rounded-xl border bg-white p-5"
                      >
                        <h2 className="break-all font-bold">
                          {String(p.tracking_number)}
                        </h2>
                        <p className="mt-2">
                          {p.status?.replaceAll("_", " ")} ·{" "}
                          {String(p.destination)} · {String(p.service)}
                        </p>
                        {Boolean(p.hold_reason) && (
                          <p className="mt-2 text-amber-800">
                            Our team is reviewing a hold on this package.
                            Contact support for help.
                          </p>
                        )}
                        <Link
                          className="mt-3 inline-block text-teal-700"
                          href={`/pilot/account/packages/${p.id}`}
                        >
                          View package & tracking history
                        </Link>
                      </article>
                    ))}
                </div>
              </section>
            )}
            {tab === "Shipments" && (
              <section className="space-y-4">
                <form
                  className="rounded-2xl border bg-white p-6"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget,
                      values = new FormData(form);
                    void run(async () => {
                      await post("shipping.request", {
                        packageIds: values.getAll("packageIds"),
                        destination: values.get("destination"),
                        service: values.get("service"),
                        deliveryMethod: values.get("deliveryMethod"),
                        note: values.get("note"),
                      });
                      form.reset();
                      await load();
                      setMessage(
                        "Your shipping request is saved. The team will confirm availability, customs requirements and pricing. Follow it in Support.",
                      );
                    });
                  }}
                >
                  <h2 className="text-xl font-bold">Ready to ship?</h2>
                  <p className="mt-2 text-slate-600">
                    Select ready packages to request shipping together. The team
                    confirms your route, price and documents before dispatch.
                  </p>
                  <fieldset className="mt-5">
                    <legend className="font-semibold">
                      Packages to include
                    </legend>
                    {data.packages
                      .filter((p) => p.status === "ready" && !p.hold_reason)
                      .map((p) => (
                        <label className="mt-3 flex gap-3" key={p.id}>
                          <input
                            type="checkbox"
                            name="packageIds"
                            value={p.id}
                          />
                          {String(p.tracking_number)}
                        </label>
                      ))}
                    {!data.packages.some(
                      (p) => p.status === "ready" && !p.hold_reason,
                    ) && (
                      <p className="mt-3 text-slate-500">
                        Your packages will appear here when they are ready for
                        shipping.
                      </p>
                    )}
                  </fieldset>
                  <label className="mt-4 block">
                    Shipping destination
                    <input
                      name="destination"
                      required
                      maxLength={200}
                      className={input}
                    />
                  </label>
                  <label className="mt-4 block">
                    Requested service
                    <select name="service" className={input}>
                      <option value="air">Air</option>
                      <option value="ocean">Ocean</option>
                    </select>
                  </label>
                  <label className="mt-4 block">
                    Receive my shipment
                    <select name="deliveryMethod" className={input}>
                      <option value="pickup">Pickup</option>
                      <option value="delivery">Delivery</option>
                    </select>
                  </label>
                  <label className="mt-4 block">
                    Delivery address or instructions
                    <textarea name="note" maxLength={1000} className={input} />
                  </label>
                  <button
                    className={`${button} mt-5`}
                    disabled={
                      busy ||
                      !data.packages.some(
                        (p) => p.status === "ready" && !p.hold_reason,
                      )
                    }
                  >
                    Request shipping
                  </button>
                </form>
                {!data.shipments.length && <p>No shipments yet.</p>}
                {data.shipments.map((s) => (
                  <article
                    key={s.id}
                    className="rounded-xl border bg-white p-5"
                  >
                    <h2 className="font-bold">
                      {String(s.destination)} · {String(s.service)}
                    </h2>
                    <p className="mt-2">
                      {s.status?.replaceAll("_", " ")} ·{" "}
                      {String(s.delivery_method)}
                    </p>
                    {Boolean(s.delivered_at) && (
                      <p className="mt-2">
                        Delivered to {String(s.received_by)} on{" "}
                        {new Date(String(s.delivered_at)).toLocaleDateString()}
                      </p>
                    )}
                    <Link
                      className="mt-4 inline-block text-teal-700"
                      href={`/pilot/account/shipments/${s.id}`}
                    >
                      View shipment details →
                    </Link>
                  </article>
                ))}
              </section>
            )}
            {tab === "Bills" && (
              <section>
                <p className="mb-5 text-slate-600">
                  Contact PCL Imports to arrange payment. Confirmed external
                  payments appear below.
                </p>
                {!data.bills.length && <p>No issued bills yet.</p>}
                {data.bills.map((b) => (
                  <article
                    key={b.id}
                    className="mb-4 rounded-xl border bg-white p-5"
                  >
                    <h2 className="font-bold">
                      {String(b.payload?.description)}
                    </h2>
                    <p className="mt-2">
                      {b.status} · Total{" "}
                      {(Number(b.payload?.amountCents) / 100).toFixed(2)}{" "}
                      {String(b.payload?.currency)}
                    </p>
                    <p className="mt-2 font-semibold">
                      Outstanding: {(Number(b.balance_cents) / 100).toFixed(2)}{" "}
                      {String(b.payload?.currency)}
                    </p>
                    <p className="mt-2 text-sm">
                      Due {String(b.payload?.dueDate ?? "Contact the team")}
                    </p>
                    <Link
                      className="mt-4 inline-block text-teal-700"
                      href={`/pilot/account/bills/${b.id}`}
                    >
                      View bill & payment history →
                    </Link>
                  </article>
                ))}
                {data.records
                  .filter((r) => r.kind === "payment")
                  .map((p) => (
                    <p
                      key={p.id}
                      className="mb-2 rounded-lg border bg-white p-4"
                    >
                      Payment {p.status}:{" "}
                      {(Number(p.payload?.amountCents) / 100).toFixed(2)}{" "}
                      {String(p.payload?.currency ?? "USD")}
                    </p>
                  ))}
              </section>
            )}
            {tab === "Documents" && (
              <section className="mb-6 rounded-2xl border bg-white p-6">
                <h2 className="text-xl font-bold">My document library</h2>
                <p className="mt-2 text-slate-500">
                  Your uploaded originals. Register a purchase document below,
                  then attach its receipt.
                </p>
                {!data.files.length && (
                  <p className="mt-4">No files uploaded yet.</p>
                )}
                {data.files.map((f) => (
                  <div key={f.id} className="mt-4 border-t pt-4">
                    <a
                      className="break-all font-semibold text-teal-700"
                      href={`/api/pilot/customer/files?id=${f.id}`}
                    >
                      {String(f.name)} ↓
                    </a>
                    {Boolean(f.package_id) && (
                      <Link
                        className="mt-2 block text-sm text-teal-700"
                        href={`/pilot/account/packages/${f.package_id}`}
                      >
                        View related package →
                      </Link>
                    )}
                  </div>
                ))}
              </section>
            )}
            {kind && (
              <section>
                <form
                  className="mb-6 rounded-2xl border bg-white p-6"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget,
                      values = new FormData(form),
                      payload: Record<string, unknown> = {
                        description: values.get("description"),
                        packageId: values.get("packageId") || null,
                      };
                    if (kind === "receipt") {
                      payload.amountCents = Math.round(
                        Number(values.get("amountCents")) * 100,
                      );
                      payload.currency = values.get("currency");
                    }
                    void run(async () => {
                      await post("record.create", { kind, payload });
                      form.reset();
                      setMessage(
                        "Your request has been saved for the PCL Imports team.",
                      );
                      await load();
                    });
                  }}
                >
                  <h2 className="text-xl font-bold">
                    {kind === "receipt"
                      ? "Register a purchase document"
                      : kind === "support"
                        ? "Ask for help"
                        : kind === "claim"
                          ? "Submit a claim"
                          : kind === "procurement"
                            ? "Request a purchase"
                            : "Request a quote"}
                  </h2>
                  <label className="mt-5 block">
                    {kind === "receipt"
                      ? "Merchant and document reference"
                      : "Describe your request"}
                    <textarea
                      name="description"
                      required
                      maxLength={2000}
                      className={input}
                    />
                  </label>
                  <label className="mt-5 block">
                    Related package
                    <select
                      aria-label="Related package"
                      name="packageId"
                      required={kind === "receipt"}
                      className={input}
                    >
                      <option value="">
                        Choose a package (optional for requests)
                      </option>
                      {data.packages.map((p) => (
                        <option key={p.id} value={p.id}>
                          {String(p.tracking_number)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {kind === "receipt" && (
                    <div className="mt-5 grid gap-5 sm:grid-cols-2">
                      <label>
                        Purchase amount
                        <input
                          name="amountCents"
                          step="0.01"
                          type="number"
                          min="0"
                          required
                          className={input}
                        />
                      </label>
                      <label>
                        Currency
                        <select
                          aria-label="Currency"
                          name="currency"
                          className={input}
                        >
                          <option>USD</option>
                          <option>BSD</option>
                        </select>
                      </label>
                    </div>
                  )}
                  <button disabled={busy} className={`${button} mt-6`}>
                    Submit to team
                  </button>
                </form>
                <div className="space-y-4">
                  {data.records
                    .filter((r) => r.kind === kind)
                    .map((r) => (
                      <article
                        key={r.id}
                        className="rounded-xl border bg-white p-5"
                      >
                        <h2 className="whitespace-pre-wrap break-words font-semibold">
                          {String(r.payload?.description)}
                        </h2>
                        <p className="mt-2 text-teal-700">
                          {r.status}
                          {r.payload?.amountCents !== undefined
                            ? " · " +
                              (Number(r.payload.amountCents) / 100).toFixed(2) +
                              " " +
                              String(r.payload.currency)
                            : ""}
                        </p>
                        {["offered", "quoted"].includes(r.status ?? "") &&
                          ["quote", "procurement"].includes(String(r.kind)) && (
                            <div className="mt-4 flex gap-2">
                              {[true, false].map((accepted) => (
                                <button
                                  key={String(accepted)}
                                  disabled={busy}
                                  className={button}
                                  onClick={() =>
                                    void run(async () => {
                                      await post(
                                        "record.accept",
                                        { accepted },
                                        r.id,
                                      );
                                      await load();
                                      setMessage(
                                        accepted
                                          ? "Offer accepted. The team can proceed."
                                          : "Offer declined.",
                                      );
                                    })
                                  }
                                >
                                  {accepted
                                    ? "Accept price and terms"
                                    : "Decline offer"}
                                </button>
                              ))}
                            </div>
                          )}
                        {Array.isArray(r.payload?.updates) &&
                          (
                            r.payload.updates as {
                              note: string;
                              status: string;
                            }[]
                          ).map((u, i) => (
                            <p
                              key={i}
                              className="mt-3 border-l-2 border-teal-200 pl-3"
                            >
                              {u.status}: {u.note}
                            </p>
                          ))}
                        {["support", "claim"].includes(kind) &&
                          !["resolved", "rejected"].includes(
                            r.status ?? "",
                          ) && (
                            <form
                              className="mt-5"
                              onSubmit={(e) => {
                                e.preventDefault();
                                const form = e.currentTarget,
                                  values = new FormData(form);
                                void run(async () => {
                                  await post(
                                    "record.reply",
                                    { message: values.get("message") },
                                    r.id,
                                  );
                                  form.reset();
                                  await load();
                                  setMessage("Reply saved for the team.");
                                });
                              }}
                            >
                              <label>
                                Add a reply
                                <textarea
                                  name="message"
                                  required
                                  maxLength={2000}
                                  className={input}
                                />
                              </label>
                              <button
                                disabled={busy}
                                className={`${button} mt-3`}
                              >
                                Send reply
                              </button>
                            </form>
                          )}
                        {kind === "receipt" && (
                          <form
                            className="mt-5"
                            onSubmit={(e) => {
                              e.preventDefault();
                              const form = e.currentTarget,
                                values = new FormData(form);
                              values.set("recordId", r.id);
                              if (r.payload?.packageId)
                                values.set(
                                  "packageId",
                                  String(r.payload.packageId),
                                );
                              void run(async () => {
                                const response = await fetch(
                                  "/api/pilot/customer/files",
                                  { method: "POST", body: values },
                                );
                                if (!response.ok)
                                  throw new Error(
                                    (await response.json()).error,
                                  );
                                form.reset();
                                setMessage("Purchase document uploaded.");
                                await load();
                              });
                            }}
                          >
                            <input
                              aria-label="Purchase document file"
                              name="file"
                              type="file"
                              required
                              accept="image/png,image/jpeg,application/pdf"
                              className="block max-w-full"
                            />
                            <p className="mt-2 text-sm text-slate-500">
                              PNG, JPEG or PDF; up to 5 MB. Attach the original
                              document for human review.
                            </p>
                            <button
                              disabled={busy}
                              className={`${button} mt-3`}
                            >
                              Upload document
                            </button>
                          </form>
                        )}
                        {data.files
                          .filter((f) => f.record_id === r.id)
                          .map((f) => (
                            <a
                              className="mt-3 block break-all text-teal-700"
                              key={f.id}
                              href={"/api/pilot/customer/files?id=" + f.id}
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
              <section className="space-y-4">
                {!data.notifications.length && <p>No updates yet.</p>}
                {data.notifications.map((n) => (
                  <article
                    key={n.id}
                    className="rounded-xl border bg-white p-5"
                  >
                    <h2 className="font-bold">{String(n.title)}</h2>
                    <p className="mt-2">{String(n.message)}</p>
                    {!n.read_at && (
                      <button
                        disabled={busy}
                        className={`${button} mt-3`}
                        onClick={() =>
                          run(async () => {
                            await post("notification.read", {}, n.id);
                            await load();
                          })
                        }
                      >
                        Mark read
                      </button>
                    )}
                  </article>
                ))}
              </section>
            )}
            {tab === "Settings" && (
              <section className="rounded-2xl border bg-white p-6">
                <h2 className="text-xl font-bold">
                  Contact and notification preferences
                </h2>
                <form
                  className="my-6 rounded-xl border p-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = e.currentTarget,
                      values = new FormData(form);
                    void run(async () => {
                      const r = await fetch("/api/pilot/customer/password", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          password: values.get("password"),
                        }),
                      });
                      if (!r.ok) throw new Error((await r.json()).error);
                      form.reset();
                      setMessage(
                        "Password saved. Other sessions were revoked.",
                      );
                    });
                  }}
                >
                  <label>
                    Set or reset account password
                    <input
                      name="password"
                      type="password"
                      required
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                      className={input}
                    />
                  </label>
                  <p className="mt-2 text-sm text-slate-500">
                    Use 12–128 characters. Your recorded email becomes your
                    sign-in address.
                  </p>
                  <button disabled={busy} className={`${button} mt-4`}>
                    Save password
                  </button>
                </form>
                <p className="mt-3 break-all">
                  {data.profile.email ?? "No email recorded"} ·{" "}
                  {data.profile.phone ?? "No phone recorded"}
                </p>
                <p className="mt-3 text-slate-600">
                  Contact the team to correct your profile. In-app updates
                  remain available in your account.
                </p>
                <form
                  className="mt-5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const values = new FormData(e.currentTarget);
                    void run(async () => {
                      await post("profile.preferences", {
                        emailNotifications: values.has("emailNotifications"),
                      });
                      await load();
                      setMessage("Notification preference saved.");
                    });
                  }}
                >
                  <label className="flex gap-3">
                    <input
                      name="emailNotifications"
                      type="checkbox"
                      defaultChecked={data.profile.email_notifications}
                    />
                    <span>
                      I want email updates about my packages and service
                      requests.
                    </span>
                  </label>
                  <p className="mt-3 text-sm text-slate-500">
                    Email delivery starts after PCL Imports connects its
                    delivery provider.
                  </p>
                  <button disabled={busy} className={`${button} mt-5`}>
                    Save preferences
                  </button>
                </form>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
