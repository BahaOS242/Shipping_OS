"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CustomerPicker,
  type CustomerOption,
} from "@/components/pilot/CustomerPicker";
type Inventory = {
  organization: string;
  customers: { id: string; display_name: string }[];
  packages: {
    id: string;
    tracking_number: string;
    status: string;
    weight_kg: string;
    display_name: string;
  }[];
};
export default function Pilot() {
  const [data, setData] = useState<Inventory | null>(null);
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const request = useRef<{ body: string; key: string } | null>(null);
  async function load() {
    const response = await fetch("/api/pilot/intake", { cache: "no-store" });
    const result = await response.json();
    if (response.ok) setData(result);
    else if (response.status === 401) setData(null);
    else setMessage(result.error);
    setReady(true);
  }
  useEffect(() => {
    let active = true;
    fetch("/api/pilot/intake", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!active) return;
        if (response.ok) setData(result);
        else if (response.status !== 401) setMessage(result.error);
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setMessage("Unable to connect. Please reload.");
          setReady(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = event.currentTarget;
    try {
      const response = await fetch("/api/pilot/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: new FormData(form).get("token") }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      form.reset();
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }
  async function intake(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = event.currentTarget,
      fields = new FormData(form);
    const body = JSON.stringify({
      customerId: fields.get("customerId"),
      trackingNumber: fields.get("trackingNumber"),
      weightKg: Number(fields.get("weightKg")),
      lengthCm: Number(fields.get("lengthCm")),
      widthCm: Number(fields.get("widthCm")),
      heightCm: Number(fields.get("heightCm")),
    });
    if (request.current?.body !== body)
      request.current = { body, key: crypto.randomUUID() };
    try {
      const response = await fetch("/api/pilot/intake", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": request.current.key,
        },
        body,
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 401) setData(null);
        throw new Error(result.error);
      }
      setMessage(
        `Received ${result.tracking_number}. Saved to warehouse inventory.`,
      );
      form.reset();
      request.current = null;
      setCustomer(null);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Connection interrupted. Retry with the same details.",
      );
    } finally {
      setBusy(false);
    }
  }
  const input =
    "mt-2 w-full rounded-lg border border-slate-300 bg-white p-3 text-slate-900";
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/pilot/operations"
          className="mb-5 block font-semibold text-teal-700"
        >
          Open full operations workspace →
        </Link>
        <header className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-teal-700">
              SHIPPING OS · LIVE PILOT
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              {data?.organization ?? "PCL Imports"} warehouse
            </h1>
            <p className="mt-2 text-slate-600">
              Receive packages and confirm every arrival.
            </p>
          </div>
          {data && (
            <button
              disabled={busy}
              className="shrink-0 whitespace-nowrap rounded-lg border p-3"
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await fetch("/api/pilot/session", {
                    method: "DELETE",
                  });
                  if (!r.ok) throw new Error("Unable to sign out.");
                  setData(null);
                  setCustomer(null);
                } catch (e) {
                  setMessage((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Sign out
            </button>
          )}
        </header>
        {message && (
          <p
            role="status"
            className="mb-6 rounded-lg border border-teal-200 bg-teal-50 p-4"
          >
            {message}
          </p>
        )}
        {!ready ? (
          <p>Connecting to warehouse…</p>
        ) : !data ? (
          <form
            onSubmit={login}
            className="max-w-md rounded-2xl border bg-white p-6"
          >
            <h2 className="text-xl font-semibold">Staff sign in</h2>
            <p className="my-3 text-slate-600">
              Enter the private, time-limited access code issued by your
              administrator.
            </p>
            <label>
              Staff access code
              <input
                className={input}
                name="token"
                type="password"
                required
                autoComplete="off"
              />
            </label>
            <button
              disabled={busy}
              className="mt-5 rounded-lg bg-teal-700 px-5 py-3 text-white"
            >
              {busy ? "Signing in…" : "Open warehouse"}
            </button>
          </form>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
            <form onSubmit={intake} className="rounded-2xl border bg-white p-6">
              <h2 className="mb-5 text-xl font-semibold">Receive a package</h2>
              <CustomerPicker
                initialCustomers={data.customers}
                value={customer}
                onChange={setCustomer}
              />
              <Link
                href="/pilot/customers"
                className="mt-3 block text-sm font-semibold text-teal-700"
              >
                Add or manage customers →
              </Link>
              <label className="mt-5 block">
                Tracking number
                <input
                  name="trackingNumber"
                  className={input}
                  required
                  minLength={3}
                  maxLength={100}
                  placeholder="Scan or type tracking number"
                />
              </label>
              <div className="mt-5 grid grid-cols-2 gap-4">
                {[
                  ["weightKg", "Weight (kg)", "0.001"],
                  ["lengthCm", "Length (cm)", "0.01"],
                  ["widthCm", "Width (cm)", "0.01"],
                  ["heightCm", "Height (cm)", "0.01"],
                ].map(([name, label, step]) => (
                  <label key={name}>
                    {label}
                    <input
                      className={input}
                      name={name}
                      type="number"
                      min={step}
                      step={step}
                      max="10000"
                      required
                    />
                  </label>
                ))}
              </div>
              <button
                disabled={busy || !customer}
                className="mt-6 w-full rounded-lg bg-teal-700 p-3 font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Confirm receipt"}
              </button>
              <p className="mt-3 text-sm text-slate-500">
                Saves a package record and staff audit history.
              </p>
            </form>
            <section>
              <h2 className="mb-4 text-xl font-semibold">
                Warehouse inventory
              </h2>
              <p className="mb-4 text-sm text-slate-600">
                50 most recently updated packages
              </p>
              <div className="space-y-3">
                {!data.packages.length && (
                  <p className="rounded-xl border bg-white p-6">
                    No packages yet. Receive your first arrival.
                  </p>
                )}
                {data.packages.map((p) => (
                  <article
                    key={p.id}
                    className="rounded-xl border bg-white p-5"
                  >
                    <div className="flex justify-between gap-3">
                      <strong className="break-all">{p.tracking_number}</strong>
                      <span className="rounded-full bg-teal-50 px-3 py-1 text-sm text-teal-800">
                        {p.status}
                      </span>
                    </div>
                    <p className="mt-2 text-slate-600">
                      {p.display_name} · {p.weight_kg ?? "—"} kg
                    </p>
                    <p className="mt-2 break-all text-xs text-slate-400">
                      {p.id}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
