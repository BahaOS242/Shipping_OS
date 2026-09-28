/** Storage rules for packages waiting at the U.S. warehouse (DEMO rules). */
import type { Package } from "./types";

export const STORAGE_RULES = {
  freeDays: 14,
  feePerDay: 1,
  /** After this many days past free storage a package is at risk of abandonment. */
  atRiskAfterDays: 30,
} as const;

const DAY = 86_400_000;

export function freeStorageUntil(receivedAt: string) {
  return new Date(new Date(receivedAt).getTime() + STORAGE_RULES.freeDays * DAY).toISOString();
}

export type StorageStatus = {
  applies: boolean;
  daysWaiting: number;
  daysOver: number;
  freeUntil?: string;
  feeAccrued: number;
  feeUncharged: number;
  state: "not_applicable" | "free" | "overdue" | "at_risk" | "on_hold" | "collected";
  customerLine: string;
};

/** Only packages sitting at the warehouse (not yet in a shipment) accrue storage. */
export function storageStatus(pkg: Package, now = Date.now()): StorageStatus {
  const s = pkg.storage;
  const base = { daysWaiting: 0, daysOver: 0, feeAccrued: 0, feeUncharged: 0, freeUntil: s.freeStorageUntil };
  if (s.collectedAt) return { ...base, applies: false, state: "collected", customerLine: "Collected." };
  if (!s.receivedAt || pkg.shipmentId || pkg.status !== "received") return { ...base, applies: false, state: "not_applicable", customerLine: "" };
  const daysWaiting = Math.floor((now - new Date(s.receivedAt).getTime()) / DAY);
  const daysOver = Math.max(0, daysWaiting - STORAGE_RULES.freeDays);
  const feeAccrued = daysOver * STORAGE_RULES.feePerDay;
  const out = { ...base, applies: true, daysWaiting, daysOver, feeAccrued, feeUncharged: Math.max(0, feeAccrued - s.storageFeeCharged) };
  if (s.holdStatus !== "none") return { ...out, state: "on_hold", customerLine: "On hold at our warehouse." };
  if (daysOver === 0) {
    const left = STORAGE_RULES.freeDays - daysWaiting;
    return { ...out, state: "free", customerLine: `Free storage for ${left} more day${left === 1 ? "" : "s"}.` };
  }
  return {
    ...out,
    state: daysOver > STORAGE_RULES.atRiskAfterDays ? "at_risk" : "overdue",
    customerLine: `Your package has been waiting for you for ${daysWaiting} days. Storage is $${STORAGE_RULES.feePerDay}/day after ${STORAGE_RULES.freeDays} free days.`,
  };
}
