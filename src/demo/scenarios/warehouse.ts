import { BUSINESS_TYPES } from "@/platform/businessTypes";
import type { ScenarioInput } from "../registry";

export const warehouse: ScenarioInput = {
  id: "warehouse",
  businessType: "warehouse",
  label: "Warehouse",
  icon: "warehouse",
  cardDescription: "Control receiving, storage, inventory movement, manifests and dispatch.",
  exampleWorkflow: ["Receiving", "Bin storage", "Shipment", "Manifest", "Dispatch"],
  organizationName: "Bahamas Central Warehouse",
  tagline: "Every package, in its place.",
  user: { name: "Devon Pratt", role: "Warehouse Lead" },
  enabledModules: BUSINESS_TYPES.warehouse.modules,
  steps: [
    {
      id: "dashboard",
      nav: "overview",
      title: "Warehouse dashboard",
      description: "What's arriving, what's on the shelves, what's going out and what's stuck — one floor view for the whole team.",
      task: "Open an alert to act on it.",
      screen: {
        kind: "dashboard",
        data: {
          heading: "Gladstone Road facility — today",
          metrics: [
            { label: "Packages arriving", value: "34", sub: "3 carriers", icon: "inbox" },
            { label: "Customers", value: "8", sub: "with inbound today", icon: "users" },
            { label: "Shipments", value: "3", sub: "being built", icon: "box" },
            { label: "Manifests", value: "2", sub: "MAN-0912 cutoff 3 PM", icon: "manifest", tone: "warn" },
          ],
          aiSummary: "One package is on the floor without a bin, and MAN-0912 closes at 3:00 PM.",
          alerts: [
            { id: "a1", tone: "warn", area: "Storage", title: "PKG-88213 received but not assigned", detail: "On the floor at dock door 2 for 50 minutes.", action: "Assign bin" },
            { id: "a2", tone: "bad", area: "Shipment · SHP-3307", title: "Missing commercial invoice", detail: "Coral Cay Resort — 1 of 4 packages has no paperwork.", action: "Request invoice" },
            { id: "a3", tone: "warn", area: "Manifest · MAN-0912", title: "Cutoff approaching", detail: "Truck to Potter's Cay leaves 3:00 PM for MV Exuma Pride.", action: "Open manifest" },
          ],
          board: {
            title: "Inbound by carrier",
            columns: ["Carrier", "Reference", "Expected", "Docked", "Received"],
            rows: [
              { cells: ["UPS Freight", "ASN-55120", "12", "12", "6"], status: "Receiving", tone: "info" },
              { cells: ["Tropical Container", "TSC-77812", "16", "0", "0"], status: "ETA 1:30 PM", tone: "neutral" },
              { cells: ["Local drop-off", "Walk-in", "6", "6", "6"], status: "Done", tone: "good" },
            ],
          },
        },
      },
    },
    {
      id: "receiving",
      nav: "warehouse",
      title: "Package receiving",
      description: "Scan in a carrier delivery piece by piece. Weights are captured, customers matched and every package becomes trackable the moment it's on the dock.",
      task: "Scan and receive the delivery.",
      screen: {
        kind: "receive",
        data: {
          ref: "ASN-55120",
          route: "UPS Freight → Dock door 2",
          customer: "6 customers",
          facts: [
            { label: "Carrier", value: "UPS Freight" },
            { label: "Trailer", value: "UPF-2291" },
            { label: "Docked", value: "10:42 AM" },
            { label: "Dock", value: "Door 2" },
          ],
          packages: [
            { id: "PKG-88211", description: "Coral Cay Resort — pool chairs", weightKg: 26 },
            { id: "PKG-88212", description: "Bain Hardware — paint ×12", weightKg: 31 },
            { id: "PKG-88213", description: "Island Hardware — tile saw", weightKg: 19 },
            { id: "PKG-88214", description: "T. Rahming — baby stroller", weightKg: 9 },
            { id: "PKG-88215", description: "Coral Cay Resort — linens", weightKg: 14 },
            { id: "PKG-88216", description: "Dr. P. Gibson — lab supplies", weightKg: 6 },
          ],
          receiveLabel: "Scan & receive all",
          afterReceive: ["6 packages checked in, weights captured", "Customers matched by account", "Ready for bin assignment"],
        },
      },
    },
    {
      id: "storage",
      nav: "warehouse",
      title: "Bin assignment",
      description: "Every package gets a location, so pickers find it in seconds and nothing sits on the floor. Pick a package, then a bin — or let Shipping OS suggest bins.",
      task: "Put every package into a bin.",
      screen: {
        kind: "storage",
        data: {
          packages: [
            { id: "PKG-88211", customer: "Coral Cay Resort", description: "Pool chairs", size: "L" },
            { id: "PKG-88212", customer: "Bain Hardware", description: "Paint ×12", size: "M" },
            { id: "PKG-88213", customer: "Island Hardware", description: "Tile saw", size: "M" },
            { id: "PKG-88214", customer: "T. Rahming", description: "Baby stroller", size: "M" },
            { id: "PKG-88216", customer: "Dr. P. Gibson", description: "Lab supplies", size: "S" },
          ],
          bins: [
            { id: "A-03", zone: "Small parts", free: 2 },
            { id: "B-11", zone: "Medium", free: 2 },
            { id: "B-14", zone: "Medium", free: 1 },
            { id: "C-02", zone: "Bulky", free: 1 },
            { id: "C-07", zone: "Bulky", free: 0 },
          ],
        },
      },
    },
    {
      id: "grouping",
      nav: "shipments",
      title: "Shipment grouping",
      description: "Packages for the same customer and island are grouped into one shipment. Paperwork gaps are caught here, before they reach the dock.",
      task: "Select the ready packages and create the shipment.",
      screen: {
        kind: "grouping",
        data: {
          destination: "Coral Cay Resort · George Town, Exuma · via MV Exuma Pride",
          createLabel: "Create shipment",
          result: { ref: "SHP-3311", next: "ready for manifest MAN-0912" },
          packages: [
            { id: "PKG-88211", customer: "Coral Cay Resort", description: "Pool chairs", weightKg: 26, docs: true },
            { id: "PKG-88215", customer: "Coral Cay Resort", description: "Linens", weightKg: 14, docs: true },
            { id: "PKG-88190", customer: "Coral Cay Resort", description: "Kitchen equipment", weightKg: 48, docs: true },
            { id: "PKG-88177", customer: "Coral Cay Resort", description: "Outdoor lighting", weightKg: 11, docs: false },
          ],
        },
      },
    },
    {
      id: "manifest",
      nav: "manifest",
      title: "Manifest & dispatch",
      description: "Outbound shipments roll into the manifest for the afternoon truck to Potter's Cay. Dispatch sends it to the vessel's purser and the driver at the same time.",
      task: "Build the manifest, then dispatch the truck.",
      screen: {
        kind: "manifest",
        data: {
          trip: { ref: "MAN-0912", route: "Gladstone Rd → Potter's Cay Dock → George Town", vessel: "Truck BCW-3 → MV Exuma Pride", departs: "Today 3:00 PM", cutoff: "2:30 PM" },
          columns: [
            { key: "ref", label: "Shipment" },
            { key: "customer", label: "Customer" },
            { key: "pkgs", label: "Pkgs", numeric: true },
            { key: "kg", label: "Weight (kg)", numeric: true },
            { key: "dest", label: "Destination" },
          ],
          weightKey: "kg",
          lines: [
            { ref: "SHP-3311", customer: "Coral Cay Resort", pkgs: "3", kg: "88", dest: "George Town" },
            { ref: "SHP-3304", customer: "Exuma Building Supply", pkgs: "6", kg: "212", dest: "George Town" },
            { ref: "SHP-3306", customer: "Staniel Cay Yacht Club", pkgs: "2", kg: "37", dest: "Staniel Cay" },
            { ref: "SHP-3309", customer: "L. Knowles", pkgs: "1", kg: "15", dest: "Black Point" },
            { ref: "SHP-3310", customer: "Exuma Medical Centre", pkgs: "4", kg: "29", dest: "George Town" },
          ],
          insight: "5 shipments are complete and ready. SHP-3307 is held until its invoice arrives.",
          buildLabel: "Build Manifest",
          finalize: { label: "Dispatch", done: "Dispatched — truck BCW-3 en route to Potter's Cay; manifest sent to the MV Exuma Pride purser." },
        },
      },
    },
    {
      id: "ai",
      nav: "ai",
      title: "AI operations",
      description: "Ask what needs attention and get the floor's exceptions, ranked — from the same records your team has been scanning all day.",
      task: "Ask what needs attention in the warehouse today.",
      screen: {
        kind: "ai",
        data: {
          prompt: "What needs attention in the warehouse today?",
          suggestions: ["Which packages have been here longest?", "What's left for MAN-0912?"],
          answer: [
            { type: "text", text: "Three exceptions on the floor, plus one storage issue:" },
            {
              type: "items",
              items: [
                { tone: "warn", title: "Package received but not assigned", detail: "PKG-88213 (Island Hardware, tile saw) — on the floor at door 2." },
                { tone: "bad", title: "Shipment missing documentation", detail: "SHP-3307 · Coral Cay Resort — PKG-88177 has no commercial invoice." },
                { tone: "warn", title: "Manifest cutoff approaching", detail: "MAN-0912 closes 2:30 PM for the 3:00 PM truck to Potter's Cay." },
                { tone: "info", title: "Long-stay storage", detail: "4 packages past 30 days free storage — 2 customers to contact." },
              ],
            },
          ],
          draft: { label: "Review suggested tasks", title: "Suggested tasks — draft", lines: ["Floor: put PKG-88213 in B-14", "Support: request invoice for PKG-88177 from Coral Cay Resort", "Dispatch: close MAN-0912 by 2:30 PM", "Accounts: storage notices for 2 customers"] },
          closing: "Suggestions only — your team decides what to act on.",
        },
      },
    },
  ],
  completion: {
    headline: "Every package, in its place.",
    points: ["Receiving captures weight and customer in one scan", "Every package has a bin — nothing lives on the floor", "Paperwork gaps are caught before the dock", "Manifest and dispatch reach the vessel and driver together"],
  },
};
