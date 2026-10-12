export function BillingBreakdown({
  payload,
}: {
  payload: Record<string, unknown>;
}) {
  const lines = Array.isArray(payload.lineItems)
    ? (payload.lineItems as { description: string; amountCents: number }[])
    : [];
  return (
    <div className="mt-4 space-y-3">
      {payload.samplePricing === true && (
        <p className="rounded-xl bg-amber-50 p-3 font-semibold text-amber-900">
          Sample pricing · Preview only. Replace with approved PCL rates before
          live use.
        </p>
      )}
      {payload.pricingPending === true && (
        <p className="rounded-xl bg-amber-50 p-3 text-amber-900">
          Pricing pending: {String(payload.pricingMessage)}
        </p>
      )}
      {lines.map((line, i) => (
        <div
          className="flex justify-between gap-4 border-b pb-2 text-sm"
          key={i}
        >
          <span>{line.description}</span>
          <strong className="shrink-0">
            {(line.amountCents / 100).toFixed(2)} {String(payload.currency)}
          </strong>
        </div>
      ))}
      {Boolean(payload.customsMessage) && (
        <p className="text-sm text-slate-500">
          {String(payload.customsMessage)}
        </p>
      )}
    </div>
  );
}
