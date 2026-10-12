"use client";
import { useState } from "react";
export type CustomerOption = {
  id: string;
  display_name: string;
  email?: string | null;
  phone?: string | null;
};
export function CustomerPicker({
  initialCustomers,
  value,
  onChange,
}: {
  initialCustomers: CustomerOption[];
  value: CustomerOption | null;
  onChange: (c: CustomerOption | null) => void;
}) {
  const [customers, setCustomers] = useState(initialCustomers),
    [query, setQuery] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [more, setMore] = useState(false);
  async function search() {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(
        "/api/pilot/customers?q=" + encodeURIComponent(query),
        { cache: "no-store" },
      );
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      setCustomers(result.customers);
      setMore(Boolean(result.nextCursor));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to search.");
    } finally {
      setBusy(false);
    }
  }
  const options =
    value && !customers.some((c) => c.id === value.id)
      ? [value, ...customers]
      : customers;
  return (
    <div>
      <label htmlFor="customer-search" className="block">
        Find a customer
      </label>
      <div className="mt-2 flex gap-2">
        <input
          id="customer-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void search();
            }
          }}
          placeholder="Name, email or phone"
          maxLength={100}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 p-3"
        />
        <button
          type="button"
          disabled={busy}
          onClick={search}
          className="rounded-lg border px-3 disabled:opacity-50"
        >
          {busy ? "…" : "Search"}
        </button>
      </div>
      <label htmlFor="intake-customer" className="mt-4 block">
        Customer
      </label>
      <select
        id="intake-customer"
        name="customerId"
        required
        value={value?.id ?? ""}
        onChange={(e) =>
          onChange(options.find((c) => c.id === e.target.value) ?? null)
        }
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-3"
      >
        <option value="" disabled>
          Choose a customer
        </option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.display_name}
            {c.email ? ` · ${c.email}` : ""}
          </option>
        ))}
      </select>
      {error && (
        <p role="status" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {!customers.length && (
        <p className="mt-2 text-sm text-slate-600">
          No matching customers. Try another search or add a customer.
        </p>
      )}
      {more && (
        <p className="mt-2 text-sm text-slate-500">
          More matches available. Narrow your search.
        </p>
      )}
    </div>
  );
}
