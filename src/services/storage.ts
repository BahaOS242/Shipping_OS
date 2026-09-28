/**
 * STORAGE SERVICE + SYSTEM CHECKS
 * Storage status per package, staff storage actions, and the automatic checks
 * that raise exceptions (storage overdue, customer owes money, shipment delayed).
 */
import { DAY, now, nowIso } from "@/data/clock";
import { db, mutate } from "@/data/store";
import { STORAGE_RULES, storageStatus } from "@/domain/storage";
import { assert, can } from "@/domain/roles";
import type { Actor, ID } from "@/domain/types";
import { emit } from "@/events/bus";
import { BusinessError } from "./_shared";
import { addCharge, listBills } from "./billing";
import { autoResolve, ensureException, raiseException } from "./exceptions";
import { getPackage, holdPackage } from "./packages";

export const packageStorage = (id: ID) => storageStatus(getPackage(id), now());

export function storageQueue() {
  return db()
    .packages.map((p) => ({ package: p, storage: storageStatus(p, now()) }))
    .filter((x) => x.storage.applies)
    .sort((a, b) => b.storage.daysWaiting - a.storage.daysWaiting);
}

export function notifyStorage(actor: Actor, packageId: ID) {
  assert(can(actor, "package.hold") || can(actor, "ticket.manage"));
  const p = getPackage(packageId);
  const st = storageStatus(p, now());
  return mutate(() =>
    emit("CUSTOMER_NOTIFIED", {
      actor,
      refs: { customerId: p.customerId, packageId: p.id },
      summary: `Storage reminder sent (${st.daysWaiting} days waiting)`,
      customerSummary: `Your ${p.merchant} package has been waiting for you for ${st.daysWaiting} days. Tap to send it or put it together with other packages.`,
    }),
  );
}

export function applyStorageFee(actor: Actor, packageId: ID) {
  assert(can(actor, "package.edit") || can(actor, "billing.record_payment"));
  const p = getPackage(packageId);
  const st = storageStatus(p, now());
  if (!p.customerId) throw new BusinessError("Match a customer first.");
  if (st.feeUncharged <= 0) throw new BusinessError("No storage fee is due yet.");
  return mutate(() => {
    addCharge(actor, { customerId: p.customerId!, kind: "storage", description: `Storage · ${p.id} · ${st.daysOver} days over ${STORAGE_RULES.freeDays} free`, amount: st.feeUncharged, packageId: p.id });
    p.storage.storageFeeCharged += st.feeUncharged;
    p.storage.storageStartDate ??= p.storage.freeStorageUntil;
    emit("STORAGE_FEE_APPLIED", { actor, refs: { customerId: p.customerId, packageId: p.id }, summary: `Storage fee $${st.feeUncharged.toFixed(2)} applied`, customerSummary: `A storage fee of $${st.feeUncharged.toFixed(2)} was added for your ${p.merchant} package.` });
    return p;
  });
}

export const placeStorageHold = (actor: Actor, packageId: ID, reason: string) => holdPackage(actor, packageId, reason || "Storage review");

/** Customer collected in Florida (or it was otherwise released from storage). */
export function markCollected(actor: Actor, packageId: ID, note: string) {
  assert(can(actor, "package.edit"));
  const p = getPackage(packageId);
  if (p.shipmentId) throw new BusinessError("This package is in a shipment.");
  return mutate(() => {
    p.storage.collectedAt = nowIso();
    p.status = "delivered";
    emit("PACKAGE_DELIVERED", { actor, refs: { customerId: p.customerId, packageId: p.id }, summary: `Collected from warehouse: ${note}`, customerSummary: "You collected your package. Delivered 🎉" });
    autoResolve("STORAGE_OVERDUE", { packageId: p.id }, "Collected");
    return p;
  });
}

export function escalateStorage(actor: Actor, packageId: ID) {
  assert(can(actor, "package.hold"));
  const p = getPackage(packageId);
  return raiseException(actor, { type: "STORAGE_OVERDUE", severity: "high", team: "management", title: "Storage escalated — possible abandonment", customerId: p.customerId, packageId: p.id, detail: `Waiting ${storageStatus(p, now()).daysWaiting} days.` });
}

/** Automatic checks — run after load and on demand. Idempotent. */
export function runSystemChecks() {
  mutate((s) => {
    for (const p of s.packages) {
      const st = storageStatus(p, now());
      if (st.applies && st.daysOver > 0 && st.state !== "on_hold") {
        p.storage.abandonedStatus = st.state === "at_risk" ? "at_risk" : "none";
        ensureException({ type: "STORAGE_OVERDUE", customerId: p.customerId, packageId: p.id, detail: `Waiting ${st.daysWaiting} days — ${st.daysOver} past free storage. $${st.feeUncharged.toFixed(2)} not yet charged.` });
      }
    }
    for (const b of listBills({ status: "overdue" })) {
      const days = Math.floor((now() - new Date(b.dueAt!).getTime()) / DAY);
      if (days >= 7) ensureException({ type: "CUSTOMER_OWES_MONEY", customerId: b.customerId, billId: b.id, detail: `${b.id}: $${b.balance.toFixed(2)} overdue by ${days} days.` });
    }
    for (const sh of s.shipments.filter((x) => x.status === "departed")) {
      const v = s.voyages.find((x) => x.id === sh.voyageId);
      if (v && now() - new Date(v.arrivesAt).getTime() > DAY) ensureException({ type: "SHIPMENT_DELAYED", customerId: sh.customerId, shipmentId: sh.id, detail: `${v.label} was due ${new Date(v.arrivesAt).toLocaleDateString()}.` });
    }
  });
}
