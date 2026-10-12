"use client";
import Link from "next/link";
import "./island-modern.css";
import { useRouter } from "next/navigation";
import { useState } from "react";
export default function SignIn() {
  const router = useRouter();
  const [register, setRegister] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [showPassword, setShowPassword] = useState(false);
  const input = "mt-2 w-full rounded-lg border bg-white p-3";
  return (
    <main className="island-login">
      <div className="island-container">
        <header className="island-header">
          <Link
            href="/pilot/account"
            className="island-brand"
            aria-label="PCL Imports customer portal"
          >
            <span className="island-monogram">PCL</span>
            <span>PCL Imports</span>
          </Link>
          <a href="mailto:service@pclimports.com" className="island-help">
            Need a hand? ↗
          </a>
        </header>
        <div className="island-grid">
          <section className="island-intro" aria-label="Welcome to PCL">
            <p className="island-eyebrow">Good things are on their way</p>
            <h1>
              Your shopping.
              <br />
              Your shipping.
              <br />
              <span>All together.</span>
            </h1>
            <p className="island-description">
              A little less wondering. A lot more knowing. Follow your packages
              from our warehouse to your doorstep.
            </p>
            <div className="island-illustration" aria-hidden="true">
              <div className="island-orbit" />
              <div className="island-orbit island-orbit-second" />
              <div className="island-parcel" />
            </div>
            <div className="island-benefits">
              <span>Track your packages</span>
              <span>Manage your receipts</span>
              <span>Plan your next shipment</span>
            </div>
          </section>
          <section className="island-card" aria-labelledby="signin-title">
            <p className="island-eyebrow">My PCL</p>
            <h2 id="signin-title">
              {register ? "Let’s get you started." : "Nice to see you again."}
            </h2>
            <p className="island-card-description">
              {register
                ? "Request your account. Our team verifies your identity before approving access."
                : "Sign in and pick up where you left off."}
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
              className="island-form"
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
                      "/api/pilot/identity" +
                        (register ? "?mode=register" : ""),
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
              <details className="island-company">
                <summary>Shipping company: PCL Imports</summary>
                <label className="mt-3 block">
                  Organization address
                  <input
                    name="organization"
                    required
                    defaultValue="pcl-imports"
                    pattern="[a-z0-9]+(-[a-z0-9]+)*"
                    className={input}
                  />
                </label>
              </details>
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
              <label className="mt-5 block" htmlFor="pcl-password">
                Password
              </label>
              <div className="island-password">
                <input
                  id="pcl-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={register ? 12 : 1}
                  maxLength={128}
                  autoComplete={register ? "new-password" : "current-password"}
                  className={input}
                />
                <button
                  type="button"
                  className="island-password-toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              {!register && (
                <a
                  className="island-recovery"
                  href="mailto:service@pclimports.com?subject=Customer%20account%20recovery"
                >
                  Need help signing in?
                </a>
              )}
              <button disabled={busy} className="island-submit">
                {busy
                  ? "Please wait…"
                  : register
                    ? "Request approval"
                    : "Sign in to My PCL →"}
              </button>
            </form>
            <div className="island-card-footer">
              <button
                disabled={busy}
                className="island-switch"
                onClick={() => {
                  setRegister(!register);
                  setMessage("");
                  setShowPassword(false);
                }}
              >
                {register
                  ? "Already approved? Sign in"
                  : "New customer? Request an account"}
              </button>
              <p className="island-recovery-note">
                Need to reset your password? Contact PCL Imports to verify your
                identity and receive a private recovery code.
              </p>
              <Link href="/pilot/tracking" className="island-code-link">
                Use a private access code instead →
              </Link>
            </div>
          </section>
        </div>
        <footer className="island-footer">
          <span>Florida to The Bahamas. Connected by PCL.</span>
          <Link href="/pilot/tracking">Track a package →</Link>
        </footer>
      </div>
    </main>
  );
}
