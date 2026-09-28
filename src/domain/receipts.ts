/**
 * DEMO receipt library for the simulated AI extraction.
 * In production the Invoice Engine sends the uploaded PDF/image to a vision
 * model and gets structured JSON back; here we "read" plausible items per store.
 */
import type { InvoiceItem } from "./types";

type ItemSeed = Omit<InvoiceItem, "totalPrice" | "quantity"> & { quantity?: number };

export const RECEIPT_LIBRARY: Record<string, ItemSeed[]> = {
  Amazon: [
    { name: "Wireless keyboard", sku: "B09-KB-2231", unitPrice: 49.99, description: "Bluetooth keyboard, black", category: "Electronics accessories" },
    { name: "USB-C charging cable (2-pack)", sku: "B08-CB-1182", unitPrice: 12.99, description: "6 ft braided cable", category: "Electronics accessories" },
    { name: "Snorkel set", sku: "B07-SN-9910", unitPrice: 34.5, description: "Adult mask and snorkel", category: "Sporting goods" },
    { name: "Baby monitor", sku: "B0C-BM-4410", unitPrice: 89.0, description: "Video baby monitor", category: "Electronics" },
    { name: "Power bank 20,000 mAh", sku: "B0B-PB-2000", unitPrice: 39.99, description: "Portable charger", category: "Electronics", reviewFlag: "Contains lithium battery — check air rules" },
  ],
  Walmart: [
    { name: "Kitchen blender", sku: "WM-55102", unitPrice: 39.0, description: "600W countertop blender", category: "Small appliances" },
    { name: "Patio chairs (set of 2)", sku: "WM-88311", unitPrice: 119.0, description: "Outdoor resin chairs", category: "Furniture" },
    { name: "School backpack", sku: "WM-22019", unitPrice: 24.97, description: "Kids backpack", category: "Bags" },
  ],
  Target: [
    { name: "Kids' sneakers", sku: "TG-081-339", unitPrice: 34.99, description: "Size 2Y", category: "Footwear" },
    { name: "School uniforms (3)", sku: "TG-551-020", unitPrice: 17.33, quantity: 3, description: "Polo shirts", category: "Apparel" },
  ],
  "Best Buy": [
    { name: "Noise-cancelling headphones", sku: "BBY-6505", unitPrice: 199.99, description: "Over-ear, wireless", category: "Electronics" },
    { name: "65-inch 4K TV", sku: "BBY-6501-65", unitPrice: 549.99, description: "LED smart TV", category: "Electronics" },
  ],
  Apple: [{ name: "iPad (10th gen)", sku: "APL-IPD-10", unitPrice: 349.0, description: "64GB Wi-Fi", category: "Electronics" }],
  Frontgate: [{ name: "Outdoor lounge chair", sku: "FG-LC-12", unitPrice: 320.0, quantity: 12, description: "Teak lounge chair", category: "Outdoor furniture" }],
  "Macy's": [{ name: "Dress shoes", sku: "MC-DS-771", unitPrice: 79.0, description: "Women's heels", category: "Footwear" }],
  Roots: [{ name: "Fleece hoodie", sku: "RT-HD-2201", unitPrice: 88.0, description: "Unisex hoodie", category: "Apparel" }],
  "Home Depot": [
    { name: "Cordless drill kit", sku: "HD-1004-5521", unitPrice: 129.0, description: "20V drill with 2 batteries", category: "Tools", reviewFlag: "Contains lithium batteries — check air rules" },
    { name: "PVC pipe bundle", sku: "HD-PVC-40", unitPrice: 8.5, quantity: 20, description: "1/2 in × 10 ft", category: "Building materials" },
  ],
  "Lowe's": [{ name: "Ceiling fan", sku: "LW-4410-22", unitPrice: 149.0, description: "52 in with light", category: "Home fixtures" }],
  Shein: [{ name: "Summer dresses (3)", sku: "SH-DR-903", unitPrice: 14.99, quantity: 3, description: "Cotton dresses", category: "Apparel" }],
  Wayfair: [{ name: "Bedside lamp", sku: "WF-LMP-778", unitPrice: 64.0, description: "Ceramic table lamp", category: "Home decor" }],
  Uline: [{ name: "Shipping boxes (bundle of 50)", sku: "S-4128", unitPrice: 1.84, quantity: 150, description: "12×12×12 corrugated", category: "Packaging supplies" }],
  Grainger: [
    { name: "Airless paint sprayer", sku: "GR-5ZL81", unitPrice: 389.0, description: "Commercial sprayer", category: "Tools" },
    { name: "Aerosol spray paint (case)", sku: "GR-1ARX2", unitPrice: 7.25, quantity: 12, description: "Enamel, white", category: "Paint", reviewFlag: "Aerosols are restricted on flights — ocean only" },
  ],
  "Amazon Business": [{ name: "Label printer", sku: "AB-LP-4450", unitPrice: 179.0, description: "Thermal label printer", category: "Office equipment" }],
  "WebstaurantStore": [{ name: "Commercial reach-in refrigerator", sku: "WS-RF-49", unitPrice: 2150.0, description: "2-door, stainless", category: "Commercial kitchen equipment" }],
  ASOS: [{ name: "Linen shirt", sku: "AS-LS-201", unitPrice: 32.0, quantity: 2, description: "Men's linen shirt", category: "Apparel" }],
};

export function itemsFor(merchant: string, hint?: string): InvoiceItem[] {
  const lib = RECEIPT_LIBRARY[merchant] ?? [{ name: hint ?? "Item", sku: "UNKNOWN", unitPrice: 25, description: "Read from receipt", category: "General merchandise" }];
  const pick = hint ? lib.filter((i) => hint.toLowerCase().includes(i.name.toLowerCase().split(" ")[0].replace(/'s$/, "")) || i.name.toLowerCase().includes(hint.toLowerCase())) : [];
  const chosen = pick.length ? pick : [lib[0]];
  return chosen.map((i) => {
    const quantity = i.quantity ?? 1;
    return { ...i, quantity, totalPrice: Math.round(i.unitPrice * quantity * 100) / 100 };
  });
}

/** Demo FX rates to USD for declared value. */
export const FX_TO_USD: Record<string, number> = { USD: 1, BSD: 1, CAD: 0.74, GBP: 1.27 };
