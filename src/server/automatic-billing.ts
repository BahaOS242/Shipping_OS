import "server-only";
import type { PoolClient } from "pg";
import { PilotError } from "./pilot";
export type Pricing = {
  pricingVersion: number;
  description: string;
  destination: string;
  service: string;
  billingBasis: string;
  amountCents: number;
  currency: string;
  minimumCents: number;
  handlingCents: number;
  deliveryCents: number;
  dimensionalDivisor: number;
  samplePricing: boolean;
};
export function validatePricing(p: Record<string, unknown>): Pricing {
  const str = (key: string, allowed?: string[]) => {
    const v = p[key];
    if (
      typeof v !== "string" ||
      !v.trim() ||
      v.length > 500 ||
      (allowed && !allowed.includes(v))
    )
      throw new PilotError(400, "Complete the rate details.");
    return v.trim();
  };
  const num = (key: string, min = 0) => {
    const v = p[key];
    if (!Number.isSafeInteger(v) || Number(v) < min || Number(v) > 100000000)
      throw new PilotError(400, "Enter valid rate amounts.");
    return Number(v);
  };
  if (p.samplePricing !== undefined && typeof p.samplePricing !== "boolean")
    throw new PilotError(400, "Choose whether this is sample pricing.");
  return {
    pricingVersion: 1,
    description: str("description"),
    destination: str("destination"),
    service: str("service", ["air", "ocean"]),
    billingBasis: str("billingBasis", ["kg", "cubic_ft"]),
    amountCents: num("amountCents", 1),
    currency: str("currency", ["USD", "BSD"]),
    minimumCents: num("minimumCents"),
    handlingCents: num("handlingCents"),
    deliveryCents: num("deliveryCents"),
    dimensionalDivisor: num("dimensionalDivisor", 1),
    samplePricing: p.samplePricing === true,
  };
}
export function calculateCharges(
  rate: Pricing,
  packages: Record<string, unknown>[],
  delivery: boolean,
) {
  if (!packages.length)
    throw new PilotError(409, "A shipment needs packages before billing.");
  let units = 0;
  const measurements = packages.map((p) => {
    const values = [p.weight_kg, p.length_cm, p.width_cm, p.height_cm].map(
      Number,
    );
    if (values.some((v) => !Number.isFinite(v) || v <= 0 || v > 1000000))
      throw new PilotError(
        409,
        "Measure every package before generating a bill.",
      );
    const [weight, length, width, height] = values,
      volume = length * width * height;
    const billable =
      Math.ceil(
        (rate.billingBasis === "kg"
          ? Math.max(weight, volume / rate.dimensionalDivisor)
          : volume / 28316.846592) *
          10 -
          1e-9,
      ) / 10;
    units += billable;
    return {
      packageId: p.id,
      trackingNumber: p.tracking_number,
      weightKg: weight,
      lengthCm: length,
      widthCm: width,
      heightCm: height,
      billableUnits: billable,
    };
  });
  units = Math.round(units * 10) / 10;
  const lines = [
    {
      description: `Freight · ${units} ${rate.billingBasis} at ${(rate.amountCents / 100).toFixed(2)} ${rate.currency}${Math.round(units * rate.amountCents) < rate.minimumCents ? ` · minimum ${(rate.minimumCents / 100).toFixed(2)} ${rate.currency}` : ""}`,
      amountCents: Math.max(
        rate.minimumCents,
        Math.round(units * rate.amountCents),
      ),
    },
    {
      description: `Handling · ${packages.length} ${packages.length === 1 ? "package" : "packages"}`,
      amountCents: packages.length * rate.handlingCents,
    },
    {
      description: delivery ? "Delivery" : "Pickup",
      amountCents: delivery ? rate.deliveryCents : 0,
    },
  ];
  const total = lines.reduce((s, l) => s + l.amountCents, 0);
  if (!Number.isSafeInteger(total) || total <= 0 || total > 100000000)
    throw new PilotError(
      409,
      "Calculated charges exceed the supported billing range.",
    );
  return {
    lineItems: lines,
    amountCents: total,
    measurements,
    billableUnits: units,
  };
}
export async function generateBill(
  db: PoolClient,
  tenant: string,
  shipmentId: string,
) {
  const sh = (
    await db.query(
      "SELECT * FROM shipments WHERE organization_id=$1 AND id=$2 FOR UPDATE",
      [tenant, shipmentId],
    )
  ).rows[0];
  if (!sh) throw new PilotError(404, "Shipment not found.");
  if (!["ready", "in_transit", "arrived", "delivered"].includes(sh.status))
    throw new PilotError(409, "Confirm the shipment is ready before billing.");
  const existing = (
    await db.query(
      "SELECT * FROM pilot_records WHERE organization_id=$1 AND kind='bill' AND payload->>'source'='automatic' AND payload->>'shipmentId'=$2 AND status<>'void' FOR UPDATE",
      [tenant, shipmentId],
    )
  ).rows[0];
  if (existing && !existing.payload.pricingPending) return existing;
  const rates = (
    await db.query(
      "SELECT id,payload FROM pilot_records WHERE organization_id=$1 AND kind='rate' AND customer_id IS NULL AND status='active' AND payload->>'pricingVersion'='1' AND lower(payload->>'destination')=lower($2) AND payload->>'service'=$3 ORDER BY id",
      [tenant, sh.destination, sh.service],
    )
  ).rows;
  const base = {
    source: "automatic",
    shipmentId,
    description: `Shipment to ${sh.destination} · ${sh.service}`,
    currency: "BSD",
    amountCents: 0,
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    pricingPending: true,
    pricingMessage:
      rates.length > 1
        ? "Multiple active rates match this route. Retire duplicates, then retry."
        : "No active route rate. Configure pricing, then retry.",
    customsMessage:
      "Customs duties, taxes and unlisted charges are excluded; staff must verify them before issue.",
  };
  let payload: Record<string, unknown> = base;
  if (rates.length === 1) {
    const rate = validatePricing(rates[0].payload);
    const packages = (
      await db.query(
        "SELECT p.* FROM packages p JOIN shipment_packages l ON l.organization_id=p.organization_id AND l.package_id=p.id WHERE l.organization_id=$1 AND l.shipment_id=$2 AND p.customer_id=$3 ORDER BY p.id",
        [tenant, shipmentId, sh.customer_id],
      )
    ).rows;
    payload = {
      ...base,
      ...calculateCharges(rate, packages, sh.delivery_method === "delivery"),
      currency: rate.currency,
      pricingPending: false,
      pricingMessage:
        "Calculated from the saved rate and package measurements.",
      samplePricing: rate.samplePricing,
      rateId: rates[0].id,
      rateSnapshot: rate,
    };
  }
  if (existing)
    return (
      await db.query(
        "UPDATE pilot_records SET payload=$3,version=version+1,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *",
        [tenant, existing.id, JSON.stringify(payload)],
      )
    ).rows[0];
  return (
    await db.query(
      "INSERT INTO pilot_records(organization_id,customer_id,kind,status,payload) VALUES($1,$2,'bill','draft',$3) RETURNING *",
      [tenant, sh.customer_id, JSON.stringify(payload)],
    )
  ).rows[0];
}
