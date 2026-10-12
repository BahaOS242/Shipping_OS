"use client";
import { useEffect, useState } from "react";
type Package = {
  id: string;
  tracking_number: string | null;
  status: string;
  weight_kg: string | null;
  updated_at: string;
};
type Inventory = {
  customer: string;
  organization: string;
  packages: Package[];
};
type Detail = {
  package: Package;
  events: {
    id: string;
    event_type: string;
    to_status: string | null;
    occurred_at: string;
  }[];
};
const status: Record<string, string> = {
  expected: "On its way to our warehouse",
  received: "We have your package",
  processing: "We’re preparing your package",
  ready: "Ready for shipping",
  in_transit: "On its way",
  arrived: "Arrived at destination",
  delivered: "Delivered",
  exception: "Our team is reviewing this package",
};
const date = (value: string) => new Date(value).toLocaleString();
export default function CustomerTracking() {
  const [data, setData] = useState<Inventory | null>(null),
    [detail, setDetail] = useState<Detail | null>(null);
  const [ready, setReady] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    let active = true;
    fetch("/api/pilot/tracking", { cache: "no-store" })
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
  async function inventory() {
    const r = await fetch("/api/pilot/tracking", { cache: "no-store" });
    const result = await r.json();
    if (!r.ok) {
      if (r.status === 401) {
        setData(null);
        setDetail(null);
      }
      throw new Error(result.error);
    }
    setData(result);
    setDetail(null);
  }
  async function action(work: () => Promise<void>) {
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
  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const token = new FormData(form).get("token");
    await action(async () => {
      const r = await fetch("/api/pilot/customer-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      form.reset();
      await inventory();
    });
  }
  async function open(id: string) {
    await action(async () => {
      const r = await fetch(
        "/api/pilot/tracking?packageId=" + encodeURIComponent(id),
        { cache: "no-store" },
      );
      const result = await r.json();
      if (!r.ok) {
        if (r.status === 401) {
          setData(null);
          setDetail(null);
        }
        throw new Error(result.error);
      }
      setDetail(result);
    });
  }
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal-700">
              {data?.organization ?? "PCL Imports"} · CUSTOMER TRACKING
            </p>
            <h1 className="mt-3 text-3xl font-bold">Your packages</h1>
            <p className="mt-3 text-slate-600">
              {data
                ? `Welcome, ${data.customer}. Follow your packages from our warehouse.`
                : "Sign in to see your latest warehouse updates."}
            </p>
          </div>
          {data && (
            <button
              disabled={busy}
              className="shrink-0 whitespace-nowrap rounded-lg border p-3 disabled:opacity-50"
              onClick={() =>
                action(async () => {
                  const r = await fetch("/api/pilot/customer-session", {
                    method: "DELETE",
                  });
                  if (!r.ok) throw new Error((await r.json()).error);
                  setData(null);
                  setDetail(null);
                })
              }
            >
              Sign out
            </button>
          )}
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
          <p>Loading your packages…</p>
        ) : !data ? (
          <form
            onSubmit={login}
            className="max-w-md rounded-2xl border bg-white p-6"
          >
            <h2 className="text-xl font-semibold">Private customer access</h2>
            <p className="mt-3 text-slate-600">
              Enter the time-limited code provided by PCL Imports. Contact the
              team if you need a new code.
            </p>
            <label htmlFor="customer-code" className="mt-5 block">
              Customer access code
            </label>
            <input
              id="customer-code"
              name="token"
              type="password"
              required
              autoComplete="off"
              className="mt-2 w-full rounded-lg border border-slate-300 p-3"
            />
            <button
              disabled={busy}
              className="mt-5 rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Signing in…" : "View my packages"}
            </button>
          </form>
        ) : detail ? (
          <section className="rounded-2xl border bg-white p-6">
            <button
              disabled={busy}
              onClick={() => setDetail(null)}
              className="mb-6 text-teal-700"
            >
              ← All packages
            </button>
            <h2 className="break-all text-xl font-bold">
              {detail.package.tracking_number ?? "Tracking number pending"}
            </h2>
            <p className="mt-3 text-lg font-semibold text-teal-700">
              {status[detail.package.status] ?? "Status update"}
            </p>
            {detail.package.weight_kg && (
              <p className="mt-2 text-slate-600">
                Recorded weight: {detail.package.weight_kg} kg
              </p>
            )}
            <h3 className="mt-8 text-lg font-semibold">Package history</h3>
            {!detail.events.length ? (
              <p className="mt-3 text-slate-600">
                No warehouse updates yet. Check back after your package arrives.
              </p>
            ) : (
              <ol className="mt-4 space-y-4">
                {detail.events.map((event) => (
                  <li
                    key={event.id}
                    className="border-l-2 border-teal-200 pl-4"
                  >
                    <p className="font-semibold">
                      {event.event_type === "package.received"
                        ? "Received at our warehouse"
                        : (status[event.to_status ?? ""] ?? "Package update")}
                    </p>
                    <time
                      className="mt-1 block text-sm text-slate-500"
                      dateTime={event.occurred_at}
                    >
                      {date(event.occurred_at)}
                    </time>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-8 text-sm text-slate-500">
              Showing up to 100 latest updates. Need help? Contact your PCL
              Imports team.
            </p>
          </section>
        ) : (
          <section>
            <div className="mb-5 flex items-center justify-between gap-3">
              <p className="text-sm text-slate-600">
                50 most recently updated packages
              </p>
              <button
                disabled={busy}
                onClick={() => action(inventory)}
                className="rounded-lg border bg-white px-4 py-2 disabled:opacity-50"
              >
                {busy ? "Loading…" : "Refresh"}
              </button>
            </div>
            {!data.packages.length ? (
              <div className="rounded-2xl border bg-white p-6">
                <h2 className="text-lg font-semibold">No packages yet</h2>
                <p className="mt-2 text-slate-600">
                  Your packages will appear here when they are registered or
                  received by the warehouse.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {data.packages.map((pkg) => (
                  <article
                    key={pkg.id}
                    className="rounded-2xl border bg-white p-6"
                  >
                    <h2 className="break-all text-lg font-bold">
                      {pkg.tracking_number ?? "Tracking number pending"}
                    </h2>
                    <p className="mt-2 font-semibold text-teal-700">
                      {status[pkg.status] ?? "Status update"}
                    </p>
                    <p className="mt-3 text-sm text-slate-500">
                      Updated {date(pkg.updated_at)}
                      {pkg.weight_kg ? ` · ${pkg.weight_kg} kg` : ""}
                    </p>
                    <button
                      disabled={busy}
                      onClick={() => open(pkg.id)}
                      className="mt-4 rounded-lg bg-teal-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
                      aria-label={`View history for ${pkg.tracking_number ?? "package"}`}
                    >
                      View history
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
