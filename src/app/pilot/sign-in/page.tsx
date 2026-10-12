"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
export default function SignIn() {
  const router = useRouter();
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const input = "mt-2 w-full rounded-lg border bg-white p-3";
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12 text-slate-900">
      <div className="mx-auto max-w-md">
        <p className="text-sm font-semibold text-teal-700">
          PCL IMPORTS · SHIPPING OS
        </p>
        <h1 className="mt-3 text-3xl font-bold">
          {register ? "Request an account" : "Customer sign in"}
        </h1>
        <p className="mt-3 text-slate-600">
          {register
            ? "New accounts require identity verification and approval by your shipping team."
            : "Use your approved customer account."}
        </p>
        {message && (
          <p
            role="status"
            className="mt-5 rounded-xl border border-teal-200 bg-teal-50 p-4"
          >
            {message}
          </p>
        )}
        <form
          className="mt-6 rounded-2xl border bg-white p-6"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget,
              values = new FormData(form),
              body: Record<string, unknown> = {
                organization: values.get("organization"),
                email: values.get("email"),
                password: values.get("password"),
              };
            if (register) {
              body.displayName = values.get("displayName");
              body.phone = values.get("phone");
            }
            setBusy(true);
            setMessage("");
            try {
              const r = await fetch(
                  "/api/pilot/identity" + (register ? "?mode=register" : ""),
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                  },
                ),
                result = await r.json();
              if (!r.ok) throw new Error(result.error);
              if (register) {
                form.reset();
                setMessage(result.message);
              } else router.push("/pilot/account");
            } catch (err) {
              setMessage(
                err instanceof Error ? err.message : "Unable to sign in.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Organization address
            <input
              name="organization"
              required
              defaultValue="pcl-imports"
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              className={input}
            />
          </label>
          {register && (
            <>
              <label className="mt-5 block">
                Your name
                <input
                  name="displayName"
                  required
                  maxLength={120}
                  autoComplete="name"
                  className={input}
                />
              </label>
              <label className="mt-5 block">
                Phone (optional)
                <input
                  name="phone"
                  type="tel"
                  placeholder="+12425550123"
                  className={input}
                />
              </label>
            </>
          )}
          <label className="mt-5 block">
            Email
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className={input}
            />
          </label>
          <label className="mt-5 block">
            Password
            <input
              name="password"
              type="password"
              required
              minLength={register ? 12 : 1}
              maxLength={128}
              autoComplete={register ? "new-password" : "current-password"}
              className={input}
            />
          </label>
          <button
            disabled={busy}
            className="mt-6 w-full rounded-lg bg-teal-700 px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Please wait…" : register ? "Request approval" : "Sign in"}
          </button>
        </form>
        <button
          disabled={busy}
          className="mt-5 text-teal-700"
          onClick={() => {
            setRegister(!register);
            setMessage("");
          }}
        >
          {register
            ? "Already approved? Sign in"
            : "New customer? Request an account"}
        </button>
        <p className="mt-5 text-sm text-slate-600">
          Need to reset your password? Contact PCL Imports to verify your
          identity and receive a private recovery code.
        </p>
        <Link href="/pilot/tracking" className="mt-4 block text-teal-700">
          Use a private access code instead →
        </Link>
      </div>
    </main>
  );
}
