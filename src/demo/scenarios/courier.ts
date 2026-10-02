import { BUSINESS_TYPES } from "@/platform/businessTypes";
import type { ScenarioInput } from "../registry";

export const courier: ScenarioInput = {
  id: "courier",
  businessType: "courier",
  label: "Courier",
  icon: "truck",
  cardDescription: "Dispatch drivers, manage deliveries, capture proof of delivery and keep customers updated.",
  exampleWorkflow: ["Order", "Dispatch", "Driver", "Delivery", "Proof", "Customer notified"],
  organizationName: "BahaFast Delivery",
  tagline: "Across Nassau, on time, with proof.",
  user: { name: "Ramon Davis", role: "Dispatcher" },
  enabledModules: BUSINESS_TYPES.courier.modules,
  steps: [
    {
      id: "dashboard",
      nav: "overview",
      title: "Dispatch dashboard",
      description: "Every delivery, every driver and every exception on one screen — so dispatch runs from facts instead of phone calls.",
      task: "Open an alert to act on it.",
      screen: {
        kind: "dashboard",
        data: {
          heading: "BahaFast — today across New Providence",
          metrics: [
            { label: "Deliveries", value: "27", sub: "today", icon: "box" },
            { label: "Drivers", value: "4", sub: "on shift", icon: "users" },
            { label: "Active", value: "8", sub: "out for delivery", icon: "truck", tone: "info" },
            { label: "Pending", value: "19", sub: "6 not yet assigned", icon: "clock", tone: "warn" },
          ],
          aiSummary: "6 afternoon deliveries have no driver yet, and Kayla is 3 stops behind.",
          alerts: [
            { id: "a1", tone: "warn", area: "Dispatch", title: "6 deliveries unassigned for the 1–5 PM window", detail: "Carmichael, Cable Beach and Eastern Road.", action: "Assign drivers" },
            { id: "a2", tone: "bad", area: "Delivery · DLV-5523", title: "Failed attempt — gate locked", detail: "Sandyport, unit 14. Customer not answering.", action: "Message customer" },
            { id: "a3", tone: "info", area: "Driver · Kayla Moss", title: "Running 3 stops behind", detail: "Traffic on East Bay Street.", action: "Rebalance" },
          ],
          board: {
            title: "Drivers",
            columns: ["Driver", "Vehicle", "Area", "Stops", "Done"],
            rows: [
              { cells: ["Kayla Moss", "Van 1", "Eastern Nassau", "9", "4"], status: "Behind", tone: "warn" },
              { cells: ["Andre Knowles", "Van 2", "Cable Beach / West", "7", "5"], status: "On time", tone: "good" },
              { cells: ["Tia Bain", "Scooter 3", "Downtown", "6", "4"], status: "On time", tone: "good" },
              { cells: ["Marco Rolle", "Truck 1", "Carmichael / South", "5", "1"], status: "Loading", tone: "info" },
            ],
          },
        },
      },
    },
    {
      id: "queue",
      nav: "dispatch",
      title: "Delivery queue",
      description: "Orders from merchants, the website and WhatsApp land in one queue with the address, window and parcel size dispatch needs.",
      task: "Open an order and mark it ready for dispatch.",
      screen: {
        kind: "bookings",
        data: {
          heading: "Today · 1–5 PM window",
          columns: ["Customer", "Area", "Window", "Size"],
          confirmLabel: "Mark ready for dispatch",
          items: [
            { id: "DLV-5531", title: "Bain Pharmacy", cells: ["Bain Pharmacy", "Mackey Street", "1–3 PM", "3 boxes"], status: "ready", detail: [{ label: "Merchant", value: "Pharmacy restock" }, { label: "Collect", value: "Prepaid" }] },
            { id: "DLV-5534", title: "Zara Moxey", cells: ["Zara Moxey", "Village Road", "2–4 PM", "Envelope"], status: "pending", detail: [{ label: "Phone", value: "+1 242 555 0501" }, { label: "Collect", value: "$12.00 COD" }], note: "Gate code 4471. Leave with security if out." },
            { id: "DLV-5536", title: "Lena Curry", cells: ["Lena Curry", "Cable Beach", "3–5 PM", "Cake (fragile)"], status: "pending", detail: [{ label: "Phone", value: "+1 242 555 0503" }, { label: "Handling", value: "Keep upright" }] },
            { id: "DLV-5537", title: "Carmichael Auto Parts", cells: ["Carmichael Auto Parts", "Carmichael Road", "1–5 PM", "Pallet"], status: "pending", detail: [{ label: "Vehicle", value: "Truck only" }, { label: "Collect", value: "On account" }] },
            { id: "DLV-5540", title: "Dr. Neville Ferguson", cells: ["Dr. N. Ferguson", "Eastern Road", "1–3 PM", "2 boxes"], status: "pending", detail: [{ label: "Phone", value: "+1 242 555 0510" }, { label: "Signature", value: "Required" }] },
            { id: "DLV-5542", title: "Sandyport Boutique", cells: ["Sandyport Boutique", "Sandyport", "4–5 PM", "Garment bag"], status: "ready", detail: [{ label: "Collect", value: "Prepaid" }] },
          ],
        },
      },
    },
    {
      id: "dispatch",
      nav: "dispatch",
      title: "Assign drivers",
      description: "See each driver's area and workload before assigning. Every assignment updates the driver's phone and the customer's tracking link at once.",
      task: "Assign the waiting deliveries to drivers.",
      screen: {
        kind: "dispatch",
        data: {
          drivers: [
            { name: "Kayla Moss", vehicle: "Van 1", area: "Eastern Nassau", load: 9 },
            { name: "Andre Knowles", vehicle: "Van 2", area: "Cable Beach / West", load: 7 },
            { name: "Tia Bain", vehicle: "Scooter 3", area: "Downtown", load: 6 },
            { name: "Marco Rolle", vehicle: "Truck 1", area: "Carmichael / South", load: 5 },
          ],
          deliveries: [
            { id: "DLV-5534", customer: "Zara Moxey", area: "Village Road", window: "2–4 PM", size: "Envelope" },
            { id: "DLV-5536", customer: "Lena Curry", area: "Cable Beach", window: "3–5 PM", size: "Cake (fragile)" },
            { id: "DLV-5537", customer: "Carmichael Auto Parts", area: "Carmichael Road", window: "1–5 PM", size: "Pallet" },
            { id: "DLV-5540", customer: "Dr. N. Ferguson", area: "Eastern Road", window: "1–3 PM", size: "2 boxes" },
            { id: "DLV-5542", customer: "Sandyport Boutique", area: "Sandyport", window: "4–5 PM", size: "Garment bag" },
          ],
        },
      },
    },
    {
      id: "driver",
      nav: "driver",
      title: "Driver view",
      description: "This is Kayla's phone. Her run, the addresses, windows and gate codes — and it keeps working with patchy signal, syncing when she's back in coverage.",
      task: "Start the run and arrive at the first stop.",
      screen: {
        kind: "driver",
        data: {
          driver: "Kayla Moss",
          vehicle: "Van 1",
          stops: [
            { id: "DLV-5518", customer: "Bain Pharmacy", address: "Mackey Street, Nassau", window: "1–3 PM", note: "Deliver to rear door" },
            { id: "DLV-5540", customer: "Dr. N. Ferguson", address: "Eastern Road, Nassau", window: "1–3 PM", note: "Signature required" },
            { id: "DLV-5534", customer: "Zara Moxey", address: "12 Village Road, Nassau", window: "2–4 PM", note: "Gate code 4471" },
            { id: "DLV-5529", customer: "Fox Hill Bakery", address: "Fox Hill Road, Nassau", window: "3–5 PM" },
          ],
        },
      },
    },
    {
      id: "pod",
      nav: "driver",
      title: "Proof of delivery",
      description: "Recipient, signature, photo, time and location are captured at the door — and the customer is told on WhatsApp before Kayla is back in the van.",
      task: "Capture the recipient, signature and photo, then complete.",
      screen: { kind: "pod", data: { ref: "DLV-5518", customer: "Bain Pharmacy", address: "Mackey Street, Nassau", items: "3 boxes · pharmacy restock", notify: "Hi Omar 👋 Your BahaFast delivery DLV-5518 was received by {recipient} at {time}. Photo and signature are in your tracking link." } },
    },
    {
      id: "ai",
      nav: "ai",
      title: "AI dispatch assistant",
      description: "Ask for a plan and get a suggestion based on areas, windows and each driver's current load. It's a starting point for dispatch — not an automatic route optimizer.",
      task: "Ask it to plan today's deliveries.",
      screen: {
        kind: "ai",
        data: {
          prompt: "Plan today's deliveries.",
          suggestions: ["Which deliveries are at risk of missing their window?", "Who has capacity this afternoon?"],
          answer: [
            { type: "text", text: "Suggested dispatch plan — grouped by area and current load. Review and adjust before dispatching." },
            {
              type: "table",
              table: {
                title: "Suggested dispatch plan",
                columns: ["Driver", "Deliveries", "Area", "Estimated workload"],
                rows: [
                  { cells: ["Kayla Moss", "5 (+DLV-5540)", "Eastern Nassau", "Heavy — 3 behind"], tone: "warn" },
                  { cells: ["Andre Knowles", "4 (+DLV-5536, 5542)", "Cable Beach / Sandyport", "Moderate"], tone: "good" },
                  { cells: ["Tia Bain", "4 (+DLV-5534)", "Downtown / Village Rd", "Light"], tone: "good" },
                  { cells: ["Marco Rolle", "3 (+DLV-5537)", "Carmichael", "Light — truck needed"], tone: "info" },
                ],
              },
            },
            { type: "items", items: [{ tone: "warn", title: "Window at risk", detail: "DLV-5540 (1–3 PM) if Kayla stays behind — consider moving to Tia." }] },
          ],
          draft: { label: "Review dispatch plan", title: "Suggested dispatch plan — draft", lines: ["4 drivers · 16 afternoon deliveries", "Moves: DLV-5540 → Kayla, DLV-5536/5542 → Andre, DLV-5534 → Tia, DLV-5537 → Marco", "Driver apps update only after you confirm"] },
          closing: "Suggested dispatch plan only. Dispatch reviews and confirms; Shipping OS doesn't claim optimized routing.",
        },
      },
    },
  ],
  completion: {
    headline: "Across Nassau, on time, with proof.",
    points: ["One queue for every order channel", "Assignments update the driver's phone and the customer at once", "Proof of delivery captured at the door", "AI suggests a plan — dispatch stays in control"],
  },
};
