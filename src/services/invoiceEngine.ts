/**
 * INVOICE ENGINE — store receipts in, structured data out.
 *
 *   upload → (simulated) AI extraction → structured invoice + field confidence
 *          → match customer → match package → match shipment → classify
 *          → Warehouse / Customs / Accounting views of the SAME record.
 *
 * AI output is a suggestion. Customs-related use always requires human review.
 */
import { nowIso } from "@/data/clock";
import { db, mutate, nextSeq } from "@/data/store";
import { FX_TO_USD, itemsFor } from "@/domain/receipts";
import { can, canActOn } from "@/domain/roles";
import type { Actor, ID, InvoiceField, InvoiceItem, PurchaseInvoice } from "@/domain/types";
import { SYSTEM, emit } from "@/events/bus";
import { BusinessError, byId, round2 } from "./_shared";
import { authorize } from "./access";
import { autoResolve, ensureException } from "./exceptions";

export const AI_DISCLAIMER = "AI-generated suggestion. Human review required.";
export const REVIEW_THRESHOLD = 0.85;

export const getPurchaseInvoice = (id: ID) => byId(db().purchaseInvoices, id, "Invoice");
export const findPurchaseInvoice = (id?: ID) => db().purchaseInvoices.find((i) => i.id === id);

export type ConfidenceLevel = "high" | "review" | "problem";
export const confidenceLevel = (c?: number): ConfidenceLevel => (c === undefined || c < 0.6 ? "problem" : c < REVIEW_THRESHOLD ? "review" : "high");
export const CONFIDENCE_COPY: Record<ConfidenceLevel, { icon: string; label: string }> = {
  high: { icon: "🟢", label: "High confidence" },
  review: { icon: "🟡", label: "Review" },
  problem: { icon: "🔴", label: "Problem" },
};

export function listPurchaseInvoices(f: { customerId?: ID; status?: PurchaseInvoice["status"]; merchant?: string; currency?: string } = {}) {
  return db()
    .purchaseInvoices.filter((i) => (!f.customerId || i.customerId === f.customerId) && (!f.status || i.status === f.status) && (!f.merchant || i.merchant === f.merchant) && (!f.currency || i.currency === f.currency))
    .sort((a, b) => b.source.uploadedAt.localeCompare(a.source.uploadedAt));
}

/** Deterministic pseudo-randomness from the file name so demos repeat. */
function hash(s: string) {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export type UploadInput = {
  fileName: string;
  fileType: PurchaseInvoice["source"]["fileType"];
  customerId?: ID;
  packageId?: ID;
  /** Hints the demo "reader" uses; production reads them from the document. */
  merchant?: string;
  orderNumber?: string;
  itemHint?: string;
  currency?: PurchaseInvoice["currency"];
  purchaseDate?: string;
  quality?: "clear" | "blurry";
  uploadedBy?: PurchaseInvoice["source"]["uploadedBy"];
};

/** Simulated extraction: returns what a vision model would, with per-field confidence. */
function extract(input: UploadInput): Omit<PurchaseInvoice, "id" | "organizationId" | "status" | "source" | "reviewNotes" | "customerId" | "packageId" | "shipmentId"> {
  const h = hash(input.fileName + (input.orderNumber ?? ""));
  const pkg = input.packageId ? db().packages.find((p) => p.id === input.packageId) : undefined;
  const merchantGuess =
    input.merchant ??
    pkg?.merchant ??
    Object.keys({ Amazon: 1, Walmart: 1, Target: 1, "Home Depot": 1, "Best Buy": 1, Shein: 1, Wayfair: 1 }).find((m) => input.fileName.toLowerCase().includes(m.toLowerCase().replace(" ", ""))) ??
    "Unknown store";
  const blurry = input.quality === "blurry" || /blur|scan|photo_\d/i.test(input.fileName);
  const items: InvoiceItem[] = itemsFor(merchantGuess, input.itemHint ?? pkg?.itemName);
  const subtotal = round2(items.reduce((s, i) => s + i.totalPrice, 0));
  const shipping = subtotal > 35 ? 0 : 5.99;
  const tax = round2(subtotal * 0.07);
  const discount = h % 5 === 0 ? round2(subtotal * 0.1) : 0;
  const base = blurry ? 0.62 : 0.9 + (h % 9) / 100;
  const fieldConfidence: Partial<Record<InvoiceField, number>> = {
    merchant: merchantGuess === "Unknown store" ? 0.4 : Math.min(0.99, base + 0.06),
    invoiceNumber: Math.min(0.99, base),
    orderNumber: input.orderNumber || pkg?.orderNumber ? Math.min(0.99, base + 0.03) : 0.55,
    purchaseDate: Math.min(0.98, base + 0.02),
    total: Math.min(0.99, base + 0.04),
    items: blurry ? 0.58 : Math.min(0.95, base - 0.04),
  };
  const vals = Object.values(fieldConfidence) as number[];
  return {
    merchant: merchantGuess,
    invoiceNumber: `${merchantGuess.slice(0, 3).toUpperCase()}-${100000 + (h % 899999)}`,
    orderNumber: input.orderNumber ?? pkg?.orderNumber ?? (merchantGuess === "Amazon" ? `112-${1000000 + (h % 8999999)}` : undefined),
    purchaseDate: input.purchaseDate ?? pkg?.createdAt ?? nowIso(),
    currency: input.currency ?? "USD",
    subtotal,
    shipping,
    tax,
    discount,
    total: round2(subtotal + shipping + tax - discount),
    confidence: round2(Math.min(...vals) * 0.5 + (vals.reduce((a, b) => a + b, 0) / vals.length) * 0.5),
    fieldConfidence,
    items,
  };
}

/** Link an invoice to a package (and its shipment) and update everything that depends on it. */
function link(inv: PurchaseInvoice, packageId: ID, actor: Actor) {
  const p = db().packages.find((x) => x.id === packageId);
  if (!p) return;
  inv.packageId = p.id;
  inv.customerId ??= p.customerId;
  inv.shipmentId = p.shipmentId;
  p.purchaseInvoiceId = inv.id;
  if (p.status !== "incoming") p.declaredValue = declaredValueUsd(inv);
  inv.fieldConfidence.customer = inv.customerId ? 0.99 : 0.3;
  autoResolve("MISSING_INVOICE", { packageId: p.id }, `Receipt ${inv.invoiceNumber} linked`);
  if (p.status !== "incoming") {
    inv.items.filter((i) => i.reviewFlag).forEach((i) =>
      ensureException({ type: "PROHIBITED_ITEM", customerId: p.customerId, packageId: p.id, purchaseInvoiceId: inv.id, detail: `"${i.name}" — ${i.reviewFlag}. ${AI_DISCLAIMER}` }),
    );
  }
  onLinkedHooks.forEach((h) => h(inv, actor));
}

const onLinkedHooks: ((inv: PurchaseInvoice, actor: Actor) => void)[] = [];
/** Shipments re-check customs documents when an invoice is linked. */
export const onInvoiceLinked = (h: (inv: PurchaseInvoice, actor: Actor) => void) => onLinkedHooks.push(h);

export const declaredValueUsd = (inv: PurchaseInvoice) => round2(Math.max(0, inv.subtotal - inv.discount) * (FX_TO_USD[inv.currency] ?? 1));

/** Find the best package for an invoice: explicit → order number → same store, not yet linked. */
function matchPackage(inv: PurchaseInvoice, hint?: ID) {
  const pkgs = db().packages.filter((p) => !p.purchaseInvoiceId && (!inv.customerId || p.customerId === inv.customerId));
  if (hint) return pkgs.find((p) => p.id === hint);
  return (
    (inv.orderNumber && pkgs.find((p) => p.orderNumber === inv.orderNumber)) ||
    pkgs.find((p) => p.merchant === inv.merchant && ["incoming", "received"].includes(p.status))
  );
}

export function uploadInvoice(actor: Actor, input: UploadInput) {
  const customerId = actor.role === "customer" ? actor.customerId : input.customerId;
  authorize(actor, "customs", customerId ? canActOn(actor, "invoice.review", { customerId }) : can(actor, "invoice.review"), "You can only upload receipts for your own account.");
  if (!input.fileName.trim()) throw new BusinessError("Choose a file.");
  return mutate((s) => {
    const x = extract(input);
    const inv: PurchaseInvoice = {
      ...x,
      id: `PI-${nextSeq("pi", 3000)}`,
      organizationId: s.organizationId,
      customerId,
      status: "processing",
      source: { fileName: input.fileName, fileType: input.fileType, uploadedBy: input.uploadedBy ?? (actor.role === "customer" ? "customer" : "staff"), uploadedAt: nowIso() },
      reviewNotes: [],
    };
    s.purchaseInvoices.push(inv);
    emit("INVOICE_UPLOADED", { actor, refs: { customerId, purchaseInvoiceId: inv.id, packageId: input.packageId }, summary: `Receipt uploaded: ${input.fileName}`, customerSummary: "You uploaded a receipt." });

    // Match → classify
    const pkg = matchPackage(inv, input.packageId);
    if (pkg) link(inv, pkg.id, actor);
    const lowFields = (Object.entries(inv.fieldConfidence) as [InvoiceField, number][]).filter(([, c]) => c < REVIEW_THRESHOLD).map(([f]) => f);
    const flagged = inv.items.some((i) => i.reviewFlag);
    inv.status = pkg && !lowFields.length && !flagged ? "matched" : "needs_review";
    if (!pkg) inv.reviewNotes.push("No matching package yet — will link automatically when it arrives.");
    if (lowFields.length) inv.reviewNotes.push(`Low confidence: ${lowFields.join(", ")}.`);
    if (flagged) inv.reviewNotes.push(`Item flagged for review. ${AI_DISCLAIMER}`);

    emit("INVOICE_PROCESSED", {
      actor: SYSTEM,
      refs: { customerId: inv.customerId, purchaseInvoiceId: inv.id, packageId: inv.packageId, shipmentId: inv.shipmentId },
      summary: `Extracted ${inv.merchant} ${inv.invoiceNumber}: ${inv.items.length} item(s), ${inv.currency} ${inv.total.toFixed(2)} — confidence ${Math.round(inv.confidence * 100)}%${pkg ? `, linked to ${pkg.id}` : ""}`,
      customerSummary: pkg ? `We read your ${inv.merchant} receipt and linked it to your package.` : `We read your ${inv.merchant} receipt. We'll link it when the package arrives.`,
    });
    return inv;
  });
}

/** Called by receiving: link a waiting invoice to a package that just arrived. */
export function autoMatchInvoiceForPackage(packageId: ID) {
  const p = db().packages.find((x) => x.id === packageId);
  if (!p?.customerId) return undefined;
  const inv = db().purchaseInvoices.find(
    (i) => !i.packageId && i.customerId === p.customerId && i.status !== "rejected" && ((p.orderNumber && i.orderNumber === p.orderNumber) || i.merchant === p.merchant),
  );
  if (inv) {
    link(inv, p.id, SYSTEM);
    if (inv.status === "needs_review" && inv.reviewNotes.every((n) => n.startsWith("No matching package"))) inv.status = "matched";
    emit("INVOICE_PROCESSED", { actor: SYSTEM, refs: { customerId: p.customerId, purchaseInvoiceId: inv.id, packageId: p.id }, summary: `Receipt ${inv.invoiceNumber} matched to ${p.id} on arrival` });
  }
  return inv;
}

export function verifyInvoice(actor: Actor, id: ID, note?: string) {
  authorize(actor, "customs", can(actor, "invoice.review"), "Only staff can verify invoices.");
  return mutate(() => {
    const inv = getPurchaseInvoice(id);
    inv.status = "verified";
    inv.verifiedBy = actor.name;
    Object.keys(inv.fieldConfidence).forEach((k) => (inv.fieldConfidence[k as InvoiceField] = 1));
    if (note) inv.reviewNotes.push(`${actor.name}: ${note}`);
    emit("INVOICE_VERIFIED", { actor, refs: { customerId: inv.customerId, purchaseInvoiceId: inv.id, packageId: inv.packageId, shipmentId: inv.shipmentId }, summary: `Invoice ${inv.invoiceNumber} verified by ${actor.name}` });
    return inv;
  });
}

export function correctInvoice(actor: Actor, id: ID, patch: { total?: number; merchant?: string; orderNumber?: string }) {
  authorize(actor, "customs", can(actor, "invoice.review"));
  return mutate(() => {
    const inv = getPurchaseInvoice(id);
    if (patch.merchant) inv.merchant = patch.merchant;
    if (patch.orderNumber) inv.orderNumber = patch.orderNumber;
    if (patch.total !== undefined && patch.total >= 0) {
      const ratio = inv.total ? patch.total / inv.total : 1;
      inv.subtotal = round2(inv.subtotal * ratio);
      inv.total = round2(patch.total);
    }
    inv.reviewNotes.push(`${actor.name} corrected ${Object.keys(patch).join(", ")}`);
    const p = db().packages.find((x) => x.id === inv.packageId);
    if (p && p.status !== "incoming") p.declaredValue = declaredValueUsd(inv);
    emit("INVOICE_PROCESSED", { actor, refs: { purchaseInvoiceId: inv.id, customerId: inv.customerId, packageId: inv.packageId }, summary: `Invoice corrected by ${actor.name}` });
    return inv;
  });
}

export function linkInvoiceToPackage(actor: Actor, id: ID, packageId: ID) {
  authorize(actor, "customs", can(actor, "invoice.review"));
  return mutate(() => {
    const inv = getPurchaseInvoice(id);
    const p = db().packages.find((x) => x.id === packageId);
    if (!p) throw new BusinessError("Package not found");
    if (p.purchaseInvoiceId && p.purchaseInvoiceId !== id) throw new BusinessError(`${p.id} already has invoice ${p.purchaseInvoiceId}`);
    if (inv.customerId && p.customerId && inv.customerId !== p.customerId) throw new BusinessError("Invoice and package belong to different customers.");
    link(inv, p.id, actor);
    if (inv.status === "needs_review" && inv.reviewNotes.every((n) => n.startsWith("No matching"))) inv.status = "matched";
    emit("INVOICE_PROCESSED", { actor, refs: { purchaseInvoiceId: inv.id, packageId: p.id, customerId: inv.customerId }, summary: `Linked to ${p.id} by ${actor.name}` });
    return inv;
  });
}

export function rejectInvoice(actor: Actor, id: ID, reason: string) {
  authorize(actor, "customs", can(actor, "invoice.review"));
  return mutate(() => {
    const inv = getPurchaseInvoice(id);
    inv.status = "rejected";
    inv.reviewNotes.push(`Rejected by ${actor.name}: ${reason}`);
    const p = db().packages.find((x) => x.id === inv.packageId);
    if (p) {
      p.purchaseInvoiceId = undefined;
      inv.packageId = undefined;
      if (p.status !== "incoming") ensureException({ type: "MISSING_INVOICE", customerId: p.customerId, packageId: p.id, detail: `Receipt rejected: ${reason}` });
    }
    emit("INVOICE_PROCESSED", { actor, refs: { purchaseInvoiceId: inv.id, customerId: inv.customerId }, summary: `Invoice rejected: ${reason}`, customerSummary: "We couldn't use a receipt you uploaded. Please upload a clearer copy." });
    return inv;
  });
}

/* ---------------- One record, three department views ---------------- */

export function departmentViews(inv: PurchaseInvoice) {
  const s = db();
  const p = s.packages.find((x) => x.id === inv.packageId);
  const shipment = s.shipments.find((x) => x.id === (inv.shipmentId ?? p?.shipmentId));
  const bill = shipment ? s.bills.find((b) => b.shipmentId === shipment.id && b.lifecycle !== "void") : undefined;
  return {
    warehouse: {
      question: "What's in the box?",
      customerId: inv.customerId,
      merchant: inv.merchant,
      order: inv.orderNumber,
      items: inv.items.map((i) => ({ name: i.name, quantity: i.quantity })),
      weight: p?.actualWeight,
      destinationId: p?.destinationId,
      packageId: p?.id,
    },
    customs: {
      question: "What is being shipped and what is its declared value?",
      packageId: p?.id,
      shipmentId: shipment?.id,
      items: inv.items,
      declaredValueUsd: declaredValueUsd(inv),
      currency: inv.currency,
      invoice: inv.invoiceNumber,
      documents: [inv.source.fileName],
      reviewFlags: inv.items.filter((i) => i.reviewFlag).map((i) => `${i.name}: ${i.reviewFlag}`),
      disclaimer: AI_DISCLAIMER,
    },
    accounting: {
      question: "What money is associated with this transaction?",
      invoice: inv.invoiceNumber,
      merchant: inv.merchant,
      amount: inv.total,
      currency: inv.currency,
      amountUsd: round2(inv.total * (FX_TO_USD[inv.currency] ?? 1)),
      merchantPayment: "Paid by customer to merchant (per receipt)",
      linkBillId: bill?.id,
      shipmentId: shipment?.id,
    },
  };
}
