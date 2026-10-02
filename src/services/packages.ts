/**
 * PACKAGE SERVICE — the package lifecycle up to leaving the warehouse:
 * pre-alert → dock scan → receive (weigh, measure, photograph, detect exceptions)
 * → hold / assign → (shipments.ts takes over).
 */
import { nowIso } from "@/data/clock";
import { db, mutate, nextSeq } from "@/data/store";
import { calculateBillableWeight, isOversized } from "@/domain/rates";
import { can, canActOn } from "@/domain/roles";
import { freeStorageUntil } from "@/domain/storage";
import type { Actor, DestinationId, ID, OpsException, Package, PackageStatus, ServiceLevel } from "@/domain/types";
import { SYSTEM, emit } from "@/events/bus";
import { BusinessError, byId, customerName } from "./_shared";
import { authorize } from "./access";
import { findCustomer, getCustomer, matchCustomerFromLabel } from "./customers";
import { autoResolve, ensureException, raiseException } from "./exceptions";
import { autoMatchInvoiceForPackage, getPurchaseInvoice } from "./invoiceEngine";
import { getDestination } from "./locations";

export const getPackage = (id: ID): Package => byId(db().packages, id.trim().toUpperCase(), "Package");
export const findPackage = (id?: ID) => (id ? db().packages.find((p) => p.id === id.trim().toUpperCase()) : undefined);

export function listPackages(f: { customerId?: ID; status?: PackageStatus | PackageStatus[]; shipmentId?: ID } = {}) {
  const statuses = f.status ? ([] as PackageStatus[]).concat(f.status) : undefined;
  return db()
    .packages.filter((p) => (!f.customerId || p.customerId === f.customerId) && (!statuses || statuses.includes(p.status)) && (!f.shipmentId || p.shipmentId === f.shipmentId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export const billableFor = (p: Package, service: ServiceLevel = p.service) => calculateBillableWeight(p, service);

/** Customer-visible packages that can be put together right now. */
export const consolidationCandidates = (customerId: ID) =>
  listPackages({ customerId, status: "received" }).filter((p) => !p.shipmentId && p.storage.holdStatus === "none");

function newPackage(input: Omit<Package, "id" | "organizationId" | "photos" | "condition" | "storage" | "createdAt" | "status"> & { status?: PackageStatus }): Package {
  return {
    ...input,
    id: `TL-PKG-${nextSeq("pkg", 10470)}`,
    organizationId: db().organizationId,
    status: input.status ?? "incoming",
    photos: [],
    condition: "good",
    storage: { storageFeeCharged: 0, holdStatus: "none", abandonedStatus: "none" },
    createdAt: nowIso(),
  };
}

/** Customer (or staff) tells us a package is coming. */
export function preAlert(
  actor: Actor,
  input: { customerId: ID; merchant: string; itemName: string; carrier: Package["carrier"]; inboundTracking: string; orderNumber?: string; expectedAt?: string; destinationId?: DestinationId; service?: ServiceLevel; carrierWeight?: number },
) {
  authorize(actor, "shipments", canActOn(actor, "package.receive", { customerId: input.customerId }), "You can only add packages to your own account.");
  const c = getCustomer(input.customerId);
  return mutate((s) => {
    const pkg = newPackage({
      customerId: c.id,
      labelName: customerName(c),
      labelSuite: c.accountNumber,
      merchant: input.merchant.trim(),
      itemName: input.itemName.trim(),
      orderNumber: input.orderNumber?.trim() || undefined,
      carrier: input.carrier,
      inboundTracking: input.inboundTracking.trim(),
      carrierWeight: input.carrierWeight,
      destinationId: input.destinationId ?? c.homeDestination,
      service: input.service ?? c.preferredService,
      expectedAt: input.expectedAt,
    });
    s.packages.push(pkg);
    emit("PACKAGE_EXPECTED", {
      actor,
      refs: { customerId: c.id, packageId: pkg.id },
      summary: `${pkg.merchant} package expected (${pkg.carrier} ${pkg.inboundTracking})`,
      customerSummary: `You told us your ${pkg.merchant} package is on the way.`,
    });
    return pkg;
  });
}

/**
 * Step 1 of receiving: a box is scanned at the dock. Finds the expected
 * package by carrier tracking, or creates one and matches the customer from the label.
 */
export function dockScan(
  actor: Actor,
  input: { inboundTracking: string; carrier: Package["carrier"]; labelName: string; labelSuite?: string; merchant: string; itemName?: string; carrierWeight?: number },
) {
  authorize(actor, "warehouse", can(actor, "package.receive"), "Only warehouse staff can scan packages in.");
  return mutate((s) => {
    const tracking = input.inboundTracking.trim();
    const expected = s.packages.find((p) => p.inboundTracking === tracking && p.status === "incoming");
    if (expected) {
      if (input.carrierWeight) expected.carrierWeight = input.carrierWeight;
      expected.dockedAt ??= nowIso();
      return { package: expected, matched: !!expected.customerId, method: "pre-alert" as const };
    }
    const match = matchCustomerFromLabel(input.labelName, input.labelSuite);
    const c = match?.customer;
    const pkg = newPackage({
      customerId: c?.id,
      labelName: input.labelName,
      labelSuite: input.labelSuite,
      merchant: input.merchant,
      itemName: input.itemName ?? "Contents to be confirmed",
      carrier: input.carrier,
      inboundTracking: tracking,
      carrierWeight: input.carrierWeight,
      destinationId: c?.homeDestination ?? "nassau",
      service: c?.preferredService ?? "air",
      dockedAt: nowIso(),
    });
    s.packages.push(pkg);
    if (!c) {
      raiseException(SYSTEM, {
        type: "CUSTOMER_NOT_MATCHED",
        packageId: pkg.id,
        detail: `Label says "${input.labelName}"${input.labelSuite ? ` / #${input.labelSuite}` : ""} — no matching account.`,
      });
    }
    return { package: pkg, matched: !!c, method: match?.method ?? ("none" as const) };
  });
}

export function matchCustomer(actor: Actor, packageId: ID, customerId: ID) {
  authorize(actor, "warehouse", can(actor, "package.edit"));
  return mutate(() => {
    const p = getPackage(packageId);
    const c = getCustomer(customerId);
    p.customerId = c.id;
    p.destinationId = c.homeDestination;
    p.service = c.preferredService;
    emit("PACKAGE_UPDATED", { actor, refs: { packageId: p.id, customerId: c.id }, summary: `Matched to ${customerName(c)} (${c.accountNumber})` });
    autoResolve("CUSTOMER_NOT_MATCHED", { packageId: p.id }, `Matched to ${c.accountNumber}`);
    return p;
  });
}

export type ReceiveInput = {
  actualWeight: number;
  length?: number;
  width?: number;
  height?: number;
  photos?: number;
  damaged?: boolean;
  conditionNote?: string;
  destinationId?: DestinationId;
  service?: ServiceLevel;
  bin?: string;
};

/** Steps 2–9 of receiving, in one business transaction. */
export function receivePackage(actor: Actor, packageId: ID, input: ReceiveInput) {
  authorize(actor, "warehouse", can(actor, "package.receive"), "Only warehouse staff can receive packages.");
  if (!(input.actualWeight > 0)) throw new BusinessError("Enter the weight.");
  return mutate((s) => {
    const p = getPackage(packageId);
    if (p.status !== "incoming") throw new BusinessError(`${p.id} was already received.`);
    const raised: OpsException[] = [];
    const refs = { customerId: p.customerId, packageId: p.id };

    // Measurements → billable weight
    if (input.destinationId) p.destinationId = input.destinationId;
    if (input.service) p.service = input.service;
    Object.assign(p, { actualWeight: input.actualWeight, length: input.length, width: input.width, height: input.height });
    const bw = calculateBillableWeight(p, p.service);
    p.dimensionalWeight = bw.dimensional;
    p.billableWeight = bw.billable;
    p.bin = input.bin || `FL-${String.fromCharCode(65 + (s.packages.length % 6))}${(s.packages.length % 20) + 1}`;

    // Photos
    const n = Math.max(1, input.photos ?? 1);
    for (let i = 0; i < n; i++) p.photos.push(`photo:${p.id}:${p.photos.length + 1}`);

    // Status + storage clock
    p.dockedAt ??= nowIso();
    p.status = "received";
    p.condition = input.damaged ? "damaged" : "good";
    p.storage.receivedAt = nowIso();
    p.storage.freeStorageUntil = freeStorageUntil(p.storage.receivedAt);

    const c = findCustomer(p.customerId);
    emit("PACKAGE_RECEIVED", {
      actor,
      refs,
      summary: `Received ${p.merchant} — ${p.itemName} into bin ${p.bin}${c ? "" : " (customer not matched)"}`,
      customerSummary: "Your package has arrived at our Florida warehouse. We have it!",
    });
    emit("PACKAGE_WEIGHT_UPDATED", {
      actor,
      refs,
      summary: `Weighed ${input.actualWeight} lb${input.length ? `, ${input.length}×${input.width}×${input.height} in` : ""} → billable ${bw.billable} lb (${bw.basis})`,
      data: { ...bw },
    });
    emit("PACKAGE_PHOTOGRAPHED", { actor, refs, summary: `${n} photo${n > 1 ? "s" : ""} taken` });

    // Invoice → declared value
    if (!p.purchaseInvoiceId) autoMatchInvoiceForPackage(p.id);
    if (p.purchaseInvoiceId) {
      const inv = getPurchaseInvoice(p.purchaseInvoiceId);
      p.declaredValue = Math.max(0, inv.subtotal - inv.discount);
      inv.items.filter((i) => i.reviewFlag).forEach((i) =>
        raised.push(ensureException({ type: "PROHIBITED_ITEM", ...refs, purchaseInvoiceId: inv.id, detail: `"${i.name}" — ${i.reviewFlag}. AI-generated suggestion. Human review required.` })),
      );
    } else if (p.customerId) {
      raised.push(ensureException({ type: "MISSING_INVOICE", ...refs, detail: `No store receipt for ${p.merchant} order${p.orderNumber ? ` ${p.orderNumber}` : ""}. Customer asked to upload it.` }));
    }

    // Automatic checks
    if (!p.customerId) raised.push(ensureException({ type: "CUSTOMER_NOT_MATCHED", packageId: p.id, detail: `Label "${p.labelName}" not matched to an account.` }));
    if (p.carrierWeight && Math.abs(input.actualWeight - p.carrierWeight) > Math.max(2, p.carrierWeight * 0.25)) {
      raised.push(ensureException({ type: "WEIGHT_MISMATCH", ...refs, detail: `Carrier said ${p.carrierWeight} lb, we weighed ${input.actualWeight} lb.` }));
    }
    if (isOversized(p, "air") && p.service === "air") {
      raised.push(ensureException({ type: "OVERSIZED_ITEM", ...refs, detail: `Too big or heavy to fly (${input.actualWeight} lb, longest side ${Math.max(p.length ?? 0, p.width ?? 0, p.height ?? 0)} in). Suggest ocean.` }));
    }
    if (input.damaged) raised.push(ensureException({ type: "DAMAGED_PACKAGE", ...refs, detail: input.conditionNote || "Box damaged on arrival. Photos taken." }));
    const dup = s.packages.find((x) => x.id !== p.id && x.inboundTracking === p.inboundTracking && x.status !== "incoming");
    if (dup) raised.push(ensureException({ type: "DUPLICATE_PACKAGE", ...refs, detail: `Same tracking as ${dup.id}.` }));

    return { package: p, billable: bw, exceptions: raised };
  });
}

export function updateMeasurements(actor: Actor, packageId: ID, m: { actualWeight: number; length?: number; width?: number; height?: number }) {
  authorize(actor, "warehouse", can(actor, "package.edit"));
  return mutate(() => {
    const p = getPackage(packageId);
    Object.assign(p, m);
    const bw = calculateBillableWeight(p, p.service);
    p.dimensionalWeight = bw.dimensional;
    p.billableWeight = bw.billable;
    emit("PACKAGE_WEIGHT_UPDATED", { actor, refs: { packageId: p.id, customerId: p.customerId }, summary: `Re-weighed: ${m.actualWeight} lb → billable ${bw.billable} lb`, data: { ...bw } });
    return p;
  });
}

export function addPhoto(actor: Actor, packageId: ID) {
  authorize(actor, "warehouse", can(actor, "package.edit"));
  return mutate(() => {
    const p = getPackage(packageId);
    p.photos.push(`photo:${p.id}:${p.photos.length + 1}`);
    emit("PACKAGE_PHOTOGRAPHED", { actor, refs: { packageId: p.id, customerId: p.customerId }, summary: "Photo added" });
    return p;
  });
}

export function holdPackage(actor: Actor, packageId: ID, reason: string) {
  const p = getPackage(packageId);
  const byCustomer = actor.role === "customer";
  authorize(actor, "warehouse", byCustomer ? canActOn(actor, "package.hold", p) : can(actor, "package.hold"));
  if (p.shipmentId) throw new BusinessError("This package is already in a shipment.");
  return mutate(() => {
    p.storage.holdStatus = byCustomer ? "customer_hold" : "staff_hold";
    p.storage.holdReason = reason;
    emit("PACKAGE_HELD", { actor, refs: { packageId: p.id, customerId: p.customerId }, summary: `On hold: ${reason}`, customerSummary: byCustomer ? "You asked us to hold this package." : "We placed your package on hold." });
    if (byCustomer) ensureException({ type: "CUSTOMER_HOLD", customerId: p.customerId, packageId: p.id, detail: reason || "Customer asked us to hold it." });
    return p;
  });
}

export function releaseHold(actor: Actor, packageId: ID) {
  const p = getPackage(packageId);
  authorize(actor, "warehouse", canActOn(actor, "package.hold", p));
  return mutate(() => {
    p.storage.holdStatus = "none";
    p.storage.holdReason = undefined;
    emit("PACKAGE_RELEASED", { actor, refs: { packageId: p.id, customerId: p.customerId }, summary: "Hold released", customerSummary: "Your package is no longer on hold." });
    autoResolve("CUSTOMER_HOLD", { packageId: p.id }, "Hold released");
    return p;
  });
}

/** Where it's going and how — customer or staff, before it's in a shipment. */
export function assignDestination(actor: Actor, packageId: ID, destinationId: DestinationId, service: ServiceLevel) {
  const p = getPackage(packageId);
  authorize(actor, "shipments", canActOn(actor, "package.edit", p));
  if (p.shipmentId) throw new BusinessError("Already in a shipment.");
  if (!getDestination(destinationId).services.includes(service)) throw new BusinessError("That service isn't available to this island.");
  return mutate(() => {
    p.destinationId = destinationId;
    p.service = service;
    const bw = calculateBillableWeight(p, service);
    p.dimensionalWeight = bw.dimensional;
    p.billableWeight = p.actualWeight ? bw.billable : undefined;
    emit("PACKAGE_UPDATED", { actor, refs: { packageId: p.id, customerId: p.customerId }, summary: `Assigned to ${getDestination(destinationId).name} by ${service}` });
    if (service === "ocean") autoResolve("OVERSIZED_ITEM", { packageId: p.id }, "Switched to ocean");
    return p;
  });
}

/**
 * Cargo dropped at a dock or counter (bookings, courier pickups): the package is
 * created already received, weighed by the person checking it in. No warehouse
 * module needed — this is the shipments module's own intake.
 */
export function checkInCargoPackage(actor: Actor, input: { customerId: ID; description: string; actualWeight: number; destinationId: DestinationId; service: ServiceLevel; reference: string }) {
  authorize(actor, "shipments", can(actor, "shipment.create_any"), "Only staff can check cargo in.");
  if (!(input.actualWeight > 0)) throw new BusinessError("Enter the weight.");
  const c = getCustomer(input.customerId);
  return mutate((s) => {
    const pkg = newPackage({
      customerId: c.id,
      labelName: customerName(c),
      labelSuite: c.accountNumber,
      merchant: "Customer cargo",
      itemName: input.description.trim(),
      carrier: "Freight",
      inboundTracking: input.reference,
      destinationId: input.destinationId,
      service: input.service,
      actualWeight: input.actualWeight,
      billableWeight: input.actualWeight,
      status: "received",
    });
    pkg.dockedAt = nowIso();
    pkg.storage.receivedAt = nowIso();
    pkg.photos.push(`photo:${pkg.id}:1`);
    s.packages.push(pkg);
    emit("PACKAGE_RECEIVED", { actor, refs: { customerId: c.id, packageId: pkg.id }, summary: `Cargo checked in: ${pkg.itemName}, ${input.actualWeight} lb (${input.reference})`, customerSummary: "Your cargo was checked in. We have it!" });
    return pkg;
  });
}
