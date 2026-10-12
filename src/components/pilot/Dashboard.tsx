"use client";
type Row = {
  id: string;
  status?: string;
  payload?: Record<string, unknown>;
  [key: string]: unknown;
};
export function PilotStat({
  label,
  value,
  detail,
  tone,
  onClick,
}: {
  label: string;
  value: string | number;
  detail: string;
  tone?: "money" | "attention";
  onClick: () => void;
}) {
  return (
    <button
      className={"pilot-stat " + (tone ? "pilot-stat-" + tone : "")}
      onClick={onClick}
    >
      <span className="pilot-stat-label">
        {label}
        <span aria-hidden>›</span>
      </span>
      <strong className="pilot-stat-value">{value}</strong>
      <span className="pilot-stat-detail">{detail}</span>
    </button>
  );
}
const money = (v: unknown, c: unknown) =>
  Number(v).toLocaleString("en-US", {
    style: "currency",
    currency: String(c ?? "USD"),
  });
const statuses: Record<string, string> = {
  expected: "Coming to our warehouse",
  received: "We have it!",
  processing: "Getting ready to travel",
  ready: "Ready for shipping",
  in_transit: "On the way to you",
  arrived: "Arrived at your destination",
  delivered: "Delivered",
  exception: "Our team is reviewing it",
};
export function CustomerDashboard({
  data,
  open,
}: {
  data: {
    packages: Row[];
    shipments: Row[];
    bills: Row[];
    records: Row[];
    notifications: Row[];
    files: Row[];
  };
  open: (tab: string) => void;
}) {
  const active = data.packages.filter((p) => p.status !== "delivered"),
    stock = data.packages.filter((p) =>
      ["received", "processing", "ready"].includes(p.status ?? ""),
    ),
    missing = active.filter(
      (p) =>
        !data.records.some(
          (r) =>
            r.kind === "receipt" &&
            r.status !== "rejected" &&
            r.payload?.packageId === p.id &&
            data.files.some((f) => f.record_id === r.id),
        ),
    ),
    offers = data.records.filter((r) =>
      ["offered", "quoted"].includes(r.status ?? ""),
    ),
    unpaid = data.bills.filter((b) => Number(b.balance_cents) > 0);
  const balances = new Map<string, number>();
  for (const b of unpaid) {
    const c = String(b.payload?.currency ?? "USD");
    balances.set(c, (balances.get(c) ?? 0) + Number(b.balance_cents));
  }
  const balance =
    [...balances].map(([c, v]) => money(v / 100, c)).join(" · ") || "$0.00";
  return (
    <section aria-label="Your shipping overview">
      <div className="pilot-stats">
        <PilotStat
          label="📦 My Packages"
          value={active.length}
          detail={`${data.packages.filter((p) => p.status === "delivered").length} delivered`}
          onClick={() => open("Packages")}
        />
        <PilotStat
          label="🚢 My Shipments"
          value={
            data.shipments.filter(
              (s) => !["delivered", "cancelled"].includes(s.status ?? ""),
            ).length
          }
          detail="On the way or getting ready"
          onClick={() => open("Shipments")}
        />
        <PilotStat
          label="💰 My Balance"
          value={balance}
          detail="Outstanding issued bills"
          tone="money"
          onClick={() => open("Bills")}
        />
        <PilotStat
          label="⚠️ Action Needed"
          value={missing.length + offers.length + unpaid.length}
          detail="See your next steps below"
          tone="attention"
          onClick={() =>
            document
              .getElementById("pilot-next-steps")
              ?.scrollIntoView({ behavior: "smooth" })
          }
        />
      </div>
      <h2 id="pilot-next-steps" className="pilot-section-title">
        What to do next
      </h2>
      <div className="pilot-actions">
        {missing.length > 0 && (
          <button className="pilot-action" onClick={() => open("Documents")}>
            <span className="pilot-action-icon" aria-hidden>
              🧾
            </span>
            <span>
              <strong>Add your store receipts</strong>
              <p>
                {missing.length} package{missing.length === 1 ? "" : "s"}{" "}
                {missing.length === 1 ? "needs" : "need"} a store receipt before
                shipping.
              </p>
            </span>
            <span className="pilot-action-arrow">Upload receipt</span>
          </button>
        )}
        {unpaid.length > 0 && (
          <button className="pilot-action" onClick={() => open("Bills")}>
            <span className="pilot-action-icon" aria-hidden>
              💰
            </span>
            <span>
              <strong>Review your shipping bills</strong>
              <p>Arrange payment with the PCL Imports team.</p>
            </span>
            <span className="pilot-action-arrow">View bills</span>
          </button>
        )}
        {offers.length > 0 && (
          <button
            className="pilot-action"
            onClick={() =>
              open(
                offers[0].kind === "procurement"
                  ? "Shopping requests"
                  : "Quotes",
              )
            }
          >
            <span className="pilot-action-icon" aria-hidden>
              ✉️
            </span>
            <span>
              <strong>Your price offer is ready</strong>
              <p>Review the price and terms before accepting.</p>
            </span>
            <span className="pilot-action-arrow">Review offer</span>
          </button>
        )}
        {missing.length + offers.length + unpaid.length === 0 && (
          <div className="pilot-action">
            <span className="pilot-action-icon" aria-hidden>
              ✓
            </span>
            <span>
              <strong>You’re all caught up</strong>
              <p>We’ll let you know when there’s something to do.</p>
            </span>
          </div>
        )}
      </div>
      <section className="pilot-feature">
        <div>
          <span className="eyebrow">📦 Your next delivery</span>
          <h2>
            {stock.length > 1
              ? "Plan your packages together"
              : "Shopping at a U.S. store?"}
          </h2>
          <p>
            {stock.length > 1
              ? `You have ${stock.length} packages at our warehouse. Ask our team to plan them as one shipment.`
              : "Tell us what’s coming so we can match your package when it arrives."}
          </p>
        </div>
        <button
          className="pilot-gold-button"
          onClick={() => open(stock.length > 1 ? "Support" : "Packages")}
        >
          {stock.length > 1
            ? "Ask about consolidation"
            : "Tell us a package is coming"}
        </button>
      </section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="pilot-section-title !mb-0">My Packages</h2>
        <button
          className="font-bold text-sea-700"
          onClick={() => open("Packages")}
        >
          + View packages / add a pre-alert
        </button>
      </div>
      <div className="pilot-package-grid">
        {active.slice(0, 6).map((p) => {
          const stage = [
            "expected",
            "received",
            "processing",
            "ready",
            "in_transit",
            "arrived",
            "delivered",
          ].indexOf(p.status ?? "");
          return (
            <article className="pilot-package" key={p.id}>
              <p className="pilot-package-merchant">
                {String(p.merchant || "Your package")}
              </p>
              <h3>
                {String(p.item_description || p.tracking_number || "Package")}
              </h3>
              <p className="pilot-package-ref">
                {String(p.tracking_number ?? p.id)}
              </p>
              <div className="pilot-progress" aria-hidden>
                {[0, 2, 4, 6].map((n) => (
                  <span key={n} data-complete={stage >= n} />
                ))}
              </div>
              <p className="pilot-package-status">
                {p.hold_reason
                  ? "Our team is reviewing a hold"
                  : (statuses[p.status ?? ""] ?? p.status)}
              </p>
              <p className="mt-2 text-sm text-ink-mute">
                {String(p.destination || "Destination pending")} ·{" "}
                {String(p.service || "air")}
              </p>
            </article>
          );
        })}
        {active.length === 0 && (
          <div className="pilot-dashboard-panel">
            <h3 className="font-bold">No packages on the move</h3>
            <p className="mt-2 text-sm text-ink-mute">
              Add a pre-alert when you place your next order.
            </p>
          </div>
        )}
      </div>
      <div className="pilot-dashboard-grid">
        <section className="pilot-dashboard-panel">
          <div className="mb-5 flex items-center justify-between gap-4">
            <h2 className="pilot-section-title !mb-0">Latest updates</h2>
            <button
              className="text-sm font-bold text-sea-700"
              onClick={() => open("Notifications")}
            >
              All notifications →
            </button>
          </div>
          {data.notifications.slice(0, 5).map((n) => (
            <div className="pilot-activity" key={n.id}>
              <strong>{String(n.title)}</strong>
              <p>{String(n.message)}</p>
            </div>
          ))}
          {data.notifications.length === 0 && (
            <p className="text-sm text-ink-mute">
              Updates will appear here as your packages move.
            </p>
          )}
        </section>
        <section className="pilot-dashboard-panel">
          <p className="text-xs font-black uppercase tracking-wider text-sea-700">
            Your shipping team
          </p>
          <h2 className="mt-3 text-2xl font-black">We’re here to help.</h2>
          <p className="mt-3 text-sm leading-6 text-ink-mute">
            Need your U.S. shipping address, help with a receipt, or a delivery
            update? Get the correct details from PCL Imports before placing an
            order.
          </p>
          <button
            className="pilot-gold-button mt-5"
            onClick={() => open("Support")}
          >
            Contact the team
          </button>
        </section>
      </div>
    </section>
  );
}
