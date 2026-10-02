import { BUSINESS_TYPES } from "@/platform/businessTypes";
import type { ScenarioInput } from "../registry";

export const fullLogistics: ScenarioInput = {
  id: "full-logistics",
  businessType: "logistics_company",
  label: "Full Logistics Company",
  icon: "layers",
  cardDescription: "Connect forwarding, warehousing, transport, delivery, billing and customer operations.",
  exampleWorkflow: ["Customer", "Booking", "Warehouse", "Manifest", "Vessel", "Delivery", "Billing"],
  organizationName: "Bahamas Integrated Logistics",
  tagline: "One operation, from booking to billing.",
  user: { name: "Andrea Knowles", role: "Chief Operating Officer" },
  enabledModules: BUSINESS_TYPES.logistics_company.modules,
  steps: [
    {
      id: "dashboard",
      nav: "overview",
      title: "Company-wide operations",
      description: "Forwarding, warehouse, fleet, delivery and finance in one view — the same records each team works in, rolled up for leadership.",
      task: "Open an alert to act on it.",
      screen: {
        kind: "dashboard",
        data: {
          heading: "Bahamas Integrated Logistics — today",
          metrics: [
            { label: "Shipments in motion", value: "148", sub: "Miami · Nassau · Family Islands", icon: "box" },
            { label: "Sailings today", value: "6", sub: "3 vessels", icon: "ship" },
            { label: "Deliveries", value: "41", sub: "Nassau 29 · Exuma 12", icon: "truck" },
            { label: "Receivables", value: "$38,420", sub: "$6,180 overdue", icon: "receipt", tone: "warn" },
          ],
          aiSummary: "2 shipments are delayed, MV Exuma Pride is 91% full, and 4 invoices passed 30 days.",
          alerts: [
            { id: "a1", tone: "bad", area: "Fleet · TRP-3301", title: "MV Exuma Pride 91% full", detail: "6 bookings waiting. Overflow can go on Thursday's sailing.", action: "Rebalance" },
            { id: "a2", tone: "warn", area: "Forwarding", title: "2 shipments delayed in Miami", detail: "Container ISG-2210 rolled to the next vessel.", action: "Notify customers" },
            { id: "a3", tone: "warn", area: "Finance", title: "4 invoices over 30 days", detail: "$6,180 outstanding — 3 business accounts.", action: "Send statements" },
          ],
          board: {
            title: "By division",
            columns: ["Division", "Open work", "On time", "Revenue (MTD)"],
            rows: [
              { cells: ["Forwarding", "62 shipments", "94%", "$118,400"], status: "Good", tone: "good" },
              { cells: ["Inter-island", "6 sailings", "88%", "$64,900"], status: "Watch", tone: "warn" },
              { cells: ["Warehouse", "212 packages", "—", "$12,300"], status: "Good", tone: "good" },
              { cells: ["Delivery", "41 drops", "91%", "$9,750"], status: "Good", tone: "good" },
            ],
          },
        },
      },
    },
    {
      id: "flow",
      nav: "shipments",
      title: "One connected workflow",
      description: "Follow a single order — Coral Cay Resort's pool furniture — from booking to invoice. Every module hands off to the next; nobody re-types anything.",
      task: "Run the shipment through, then click any stage to see what happens there.",
      screen: {
        kind: "flow",
        data: {
          title: "Coral Cay Resort · pool furniture · one order through every module",
          nodes: [
            { id: "customer", label: "Customer", icon: "user", detail: "Coral Cay Resort (business account, Exuma). Credit terms 30 days, WhatsApp updates on.", metric: "Account CCR-104" },
            { id: "booking", label: "Booking", icon: "ticket", detail: "12 pool chairs booked from Miami to George Town via the customer portal.", metric: "BKG-9921" },
            { id: "shipment", label: "Shipment", icon: "box", detail: "Shipment created with invoice attached; customs entry drafted from the supplier invoice.", metric: "SH-20418 · 186 kg" },
            { id: "warehouse", label: "Warehouse", icon: "warehouse", detail: "Received in Miami, weighed, photographed and binned at MIA-D02.", metric: "Bin MIA-D02" },
            { id: "manifest", label: "Manifest", icon: "manifest", detail: "Added to the Nassau → Exuma manifest as cargo line 14.", metric: "MAN-3301" },
            { id: "trip", label: "Trip", icon: "calendar", detail: "Booked on Tuesday's 6:00 PM sailing; capacity checked automatically.", metric: "TRP-3301" },
            { id: "vessel", label: "Vessel", icon: "ship", detail: "MV Exuma Pride — 90,000 kg capacity, crew of 7, departs Potter's Cay.", metric: "91% loaded" },
            { id: "delivery", label: "Delivery", icon: "truck", detail: "Driver assigned in George Town; delivered to the resort with signature and photo.", metric: "DLV-7712" },
            { id: "billing", label: "Billing", icon: "receipt", detail: "Freight, handling, delivery and brokerage billed on one invoice the moment it delivered.", metric: "INV-2026-04417" },
            { id: "portal", label: "Customer Portal", icon: "globe", detail: "The resort saw every step, downloaded documents and paid online — no calls to the office.", metric: "Paid online" },
          ],
        },
      },
    },
    {
      id: "manifest",
      nav: "manifest",
      title: "Warehouse → manifest",
      description: "Cleared cargo from the warehouse flows straight onto Tuesday's Exuma sailing.",
      task: "Build the manifest, then close it.",
      screen: {
        kind: "manifest",
        data: {
          trip: { ref: "TRP-3301", route: "Nassau → George Town, Exuma", vessel: "MV Exuma Pride", departs: "Tue 6:00 PM", cutoff: "4:00 PM" },
          columns: [
            { key: "ref", label: "Shipment / booking" },
            { key: "customer", label: "Customer" },
            { key: "cargo", label: "Cargo" },
            { key: "kg", label: "Weight (kg)", numeric: true },
            { key: "source", label: "Source" },
          ],
          weightKey: "kg",
          lines: [
            { ref: "SH-20418", customer: "Coral Cay Resort", cargo: "Pool chairs ×12", kg: "186", source: "Miami forwarding" },
            { ref: "BKG-9930", customer: "Exuma Building Supply", cargo: "Cement — 60 bags", kg: "2,520", source: "Dock booking" },
            { ref: "SH-20422", customer: "Exuma Medical Centre", cargo: "Medical supplies", kg: "44", source: "Miami forwarding" },
            { ref: "BKG-9934", customer: "Staniel Cay Yacht Club", cargo: "Provisions", kg: "310", source: "Dock booking" },
            { ref: "SH-20425", customer: "L. Knowles", cargo: "Furniture", kg: "128", source: "Nassau warehouse" },
            { ref: "BKG-9937", customer: "Black Point Grocery", cargo: "Groceries — 80 cases", kg: "1,040", source: "Dock booking" },
          ],
          insight: "Forwarded shipments and local dock bookings are on one manifest — 6 lines ready.",
          buildLabel: "Build Manifest",
          finalize: { label: "Close manifest", done: "Manifest MAN-3301 closed and sent to the MV Exuma Pride purser." },
        },
      },
    },
    {
      id: "trips",
      nav: "trips",
      title: "Trips & vessels",
      description: "Every sailing across the fleet on one departure board, with load against each vessel's capacity.",
      task: "Depart the boarding sailing.",
      screen: {
        kind: "schedule",
        data: {
          heading: "Fleet departures · Potter's Cay Dock",
          departLabel: "Depart",
          trips: [
            { id: "TRP-3298", vessel: "MV Island Express", route: "Nassau → Eleuthera", departs: "8:00 AM", booked: "47 bookings", cargo: "1,284 kg", status: "Boarding" },
            { id: "TRP-3299", vessel: "MV Andros Runner", route: "Nassau → Fresh Creek", departs: "10:30 AM", booked: "22 bookings", cargo: "960 kg", status: "Scheduled" },
            { id: "TRP-3301", vessel: "MV Exuma Pride", route: "Nassau → George Town", departs: "6:00 PM", booked: "64 bookings", cargo: "81,900 kg", status: "Scheduled" },
          ],
        },
      },
    },
    {
      id: "delivery",
      nav: "dispatch",
      title: "Island delivery",
      description: "When the vessel lands in George Town, deliveries are ready to assign to the Exuma team.",
      task: "Assign the George Town deliveries.",
      screen: {
        kind: "dispatch",
        data: {
          drivers: [
            { name: "Keith Rolle", vehicle: "Truck · Exuma", area: "George Town", load: 4 },
            { name: "Partner — Staniel Cay", vehicle: "Boat agent", area: "Staniel Cay", load: 1 },
            { name: "Lynn Ferguson", vehicle: "Van · Exuma", area: "Rolleville / North", load: 3 },
          ],
          deliveries: [
            { id: "DLV-7712", customer: "Coral Cay Resort", area: "George Town", window: "Wed AM", size: "12 chairs" },
            { id: "DLV-7715", customer: "Exuma Medical Centre", area: "George Town", window: "Wed AM", size: "Cold box" },
            { id: "DLV-7718", customer: "Staniel Cay Yacht Club", area: "Staniel Cay", window: "Wed PM", size: "Provisions" },
            { id: "DLV-7720", customer: "L. Knowles", area: "Rolleville", window: "Wed PM", size: "Furniture" },
          ],
        },
      },
    },
    {
      id: "billing",
      nav: "billing",
      title: "Billing",
      description: "Charges from every step — freight, handling, delivery, brokerage — land on one invoice the moment the work is done.",
      task: "Issue the invoice, then record the payment.",
      screen: {
        kind: "billing",
        data: {
          customer: "Coral Cay Resort",
          ref: "SH-20418",
          invoiceRef: "INV-2026-04417",
          vatRate: 0.1,
          channel: "WhatsApp and email",
          lines: [
            { description: "Ocean freight Miami → Nassau · 186 kg", amount: 212.0 },
            { description: "Inter-island freight Nassau → George Town", amount: 148.5 },
            { description: "Warehouse handling (Miami)", amount: 35.0 },
            { description: "Customs brokerage", amount: 60.0 },
            { description: "Home delivery — George Town", amount: 40.0 },
          ],
        },
      },
    },
    {
      id: "ai",
      nav: "ai",
      title: "AI operations",
      description: "One question across every division. The assistant answers from shipments, sailings and invoices — and drafts the customer messages for review.",
      task: "Ask which shipments are delayed.",
      screen: {
        kind: "ai",
        data: {
          prompt: "Which shipments are delayed?",
          suggestions: ["What needs my attention today?", "Which customers have overdue invoices?"],
          answer: [
            { type: "text", text: "2 shipments are delayed and 1 is at risk:" },
            {
              type: "items",
              items: [
                { tone: "bad", title: "SH-20431 · Bain Hardware", detail: "Container ISG-2210 rolled to Thursday's vessel in Miami. New ETA Nassau: Monday." },
                { tone: "bad", title: "SH-20436 · Pink Sands Villas", detail: "Same container — Harbour Island delivery moves to next Wednesday." },
                { tone: "warn", title: "BKG-9941 · Rolleville Grocery (at risk)", detail: "Tuesday's Exuma sailing is 91% full; 420 kg may roll to Thursday." },
              ],
            },
          ],
          draft: { label: "Review customer updates", title: "Draft WhatsApp updates — 3 customers", lines: ["Bain Hardware: “Your shipment SH-20431 is now due in Nassau Monday…”", "Pink Sands Villas: “Your delivery moves to next Wednesday…”", "Rolleville Grocery: “Your cargo may travel Thursday…”", "Nothing is sent until you approve"] },
          closing: "Across forwarding, fleet and delivery — one answer, drafted for your review.",
        },
      },
    },
  ],
  completion: {
    headline: "One operation, from booking to billing.",
    points: ["Every module hands off to the next — nothing re-typed", "Forwarded cargo and dock bookings share one manifest", "Billing happens as the work happens", "Customers follow every step themselves"],
  },
};
