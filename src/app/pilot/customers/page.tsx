"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CustomerOption } from "@/components/pilot/CustomerPicker";
type List = {
  organization: string;
  customers: CustomerOption[];
  nextCursor: string | null;
};
export default function Customers() {
  const [data, setData] = useState<List | null>(null),
    [ready, setReady] = useState(false),
    [query, setQuery] = useState(""),
    [activeQuery, setActiveQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const request = useRef<{ body: string; key: string } | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/pilot/customers", { cache: "no-store" })
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
          setMessage("Unable to load customers. Please reload.");
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function load(q: string, cursor?: string) {
    const params = new URLSearchParams({ q });
    if (cursor) params.set("cursor", cursor);
    const r = await fetch("/api/pilot/customers?" + params, {
        cache: "no-store",
      }),
      result = await r.json();
    if (!r.ok) {
      if (r.status === 401) setData(null);
      throw new Error(result.error);
    }
    setData((current) =>
      cursor && current
        ? { ...result, customers: [...current.customers, ...result.customers] }
        : result,
    );
    setActiveQuery(q);
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
  async function create(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      fields = new FormData(form);
    const body = JSON.stringify({
      displayName: fields.get("displayName"),
      email: fields.get("email"),
      phone: fields.get("phone"),
    });
    if (request.current?.body !== body)
      request.current = { body, key: crypto.randomUUID() };
    await action(async () => {
      const r = await fetch("/api/pilot/customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": request.current!.key,
        },
        body,
      });
      const result = await r.json();
      if (!r.ok) {
        if (r.status === 401) setData(null);
        throw new Error(result.error);
      }
      form.reset();
      request.current = null;
      setQuery(result.display_name);
      setMessage(
        `Saved ${result.display_name}. This customer is ready for package intake.`,
      );
      try {
        await load(result.display_name);
      } catch {
        setMessage(
          `Saved ${result.display_name}. Reload to refresh the customer list.`,
        );
      }
    });
  }
  const input = "mt-2 w-full rounded-lg border border-slate-300 bg-white p-3";
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <Link href="/pilot" className="text-teal-700">
          ← Warehouse intake
        </Link>
        <header className="my-8">
          <p className="text-sm font-semibold text-teal-700">
            {data?.organization ?? "PCL Imports"} · STAFF
          </p>
          <h1 className="mt-2 text-3xl font-bold">Customers</h1>
          <p className="mt-3 text-slate-600">
            Find an existing customer or add one before receiving their package.
          </p>
        </header>
        {message && (
          <p
            role="status"
            className="mb-6 rounded-xl border border-teal-200 bg-teal-50 p-4"
          >
            {message}
          </p>
        )}
        {!ready ? (
          <p>Loading customers…</p>
        ) : !data ? (
          <section className="rounded-2xl border bg-white p-6">
            <h2 className="text-xl font-semibold">Staff sign-in required</h2>
            <Link
              href="/pilot"
              className="mt-4 inline-block rounded-lg bg-teal-700 px-5 py-3 text-white"
            >
              Sign in at warehouse
            </Link>
          </section>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[360px_1fr]">
            <form
              onSubmit={create}
              className="h-fit rounded-2xl border bg-white p-6"
            >
              <h2 className="mb-5 text-xl font-semibold">Add a customer</h2>
              <label htmlFor="customer-name">Customer name</label>
              <input
                id="customer-name"
                name="displayName"
                className={input}
                required
                maxLength={120}
                autoComplete="name"
              />
              <label htmlFor="customer-email" className="mt-5 block">
                Email (optional)
              </label>
              <input
                id="customer-email"
                name="email"
                type="email"
                className={input}
                maxLength={254}
                autoComplete="email"
              />
              <label htmlFor="customer-phone" className="mt-5 block">
                Phone (optional)
              </label>
              <input
                id="customer-phone"
                name="phone"
                type="tel"
                className={input}
                placeholder="+12425550123"
                pattern="\+[1-9][0-9]{6,14}"
                autoComplete="tel"
              />
              <p className="mt-2 text-sm text-slate-500">
                Include the country code. Use digits without spaces.
              </p>
              <button
                disabled={busy}
                className="mt-6 w-full rounded-lg bg-teal-700 p-3 font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save customer"}
              </button>
              <p className="mt-3 text-sm text-slate-500">
                Search first to avoid creating a second record for the same
                person.
              </p>
            </form>
            <section>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(() => load(query));
                }}
                className="mb-6"
              >
                <label htmlFor="directory-search" className="font-semibold">
                  Search customers
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="directory-search"
                    className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white p-3"
                    placeholder="Name, email or phone"
                    maxLength={100}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <button
                    disabled={busy}
                    className="rounded-lg border bg-white px-4 disabled:opacity-50"
                  >
                    Search
                  </button>
                </div>
              </form>
              <div className="space-y-3">
                {!data.customers.length && (
                  <p className="rounded-xl border bg-white p-6">
                    No matching customers. Try another search or add a customer.
                  </p>
                )}
                {data.customers.map((c) => (
                  <article
                    key={c.id}
                    className="rounded-xl border bg-white p-5"
                  >
                    <h2 className="break-words text-lg font-semibold">
                      {c.display_name}
                    </h2>
                    <p className="mt-2 break-all text-slate-600">
                      {c.email ?? "No email recorded"}
                    </p>
                    <p className="mt-1 text-slate-600">
                      {c.phone ?? "No phone recorded"}
                    </p>
                  </article>
                ))}
              </div>
              {data.nextCursor && (
                <button
                  disabled={busy}
                  className="mt-5 rounded-lg border bg-white px-5 py-3 disabled:opacity-50"
                  onClick={() =>
                    action(() => load(activeQuery, data.nextCursor!))
                  }
                >
                  Load more customers
                </button>
              )}
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
