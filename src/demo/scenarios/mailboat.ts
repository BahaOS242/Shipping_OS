import { BUSINESS_TYPES } from "@/platform/businessTypes";
import type { ScenarioInput } from "../registry";

export const mailboat: ScenarioInput = {
  id: "mailboat",
  businessType: "mailboat_operator",
  label: "Mailboat Operator",
  icon: "ship",
  cardDescription: "Manage vessels, routes, bookings, capacity, manifests and cargo across the islands.",
  exampleWorkflow: ["Booking", "Cargo check-in", "Capacity", "Manifest", "Sail", "Island dock"],
  organizationName: "Island Express Marine",
  tagline: "Every sailing, booked and balanced.",
  user: { name: "Shawn Ferguson", role: "Dispatcher, Potter's Cay" },
  enabledModules: BUSINESS_TYPES.mailboat_operator.modules,
  steps: [
    {
      id: "dashboard",
      nav: "overview",
      title: "Today's vessel operations",
      description: "Every sailing leaving Potter's Cay today, how full it is and what could hold it up — before the first truck reaches the dock.",
      task: "Open an alert to act on it.",
      screen: {
        kind: "dashboard",
        data: {
          heading: "Potter's Cay Dock — today",
          metrics: [
            { label: "Sailings today", value: "3", sub: "Eleuthera · Andros · Exuma", icon: "ship" },
            { label: "Bookings · Eleuthera", value: "47", sub: "MV Island Express, 8:00 AM", icon: "ticket" },
            { label: "Cargo booked", value: "1,284 kg", sub: "of 1,650 kg", icon: "box" },
            { label: "Capacity used", value: "78%", sub: "366 kg still free", icon: "gauge", tone: "warn" },
          ],
          aiSummary: "MV Island Express is 78% loaded. 3 bookings still need cargo details before the 7:00 AM cutoff.",
          alerts: [
            { id: "a1", tone: "warn", area: "Bookings · TRP-2214", title: "3 bookings missing cargo details", detail: "BKG-4407, BKG-4411, BKG-4415 — weight or description not given.", action: "Chase customers" },
            { id: "a2", tone: "bad", area: "Weather · Exuma Sound", title: "Small craft advisory this afternoon", detail: "Affects the 6:00 PM Exuma sailing. Decision needed by 2:00 PM.", action: "Review sailing" },
            { id: "a3", tone: "info", area: "Dock · Harbour Island", title: "Dunmore Town drop needs confirmation", detail: "Agent hasn't confirmed someone will meet the boat.", action: "Call agent" },
          ],
          board: {
            title: "Sailings",
            columns: ["Trip", "Vessel", "Route", "Departs", "Bookings", "Load"],
            rows: [
              { cells: ["TRP-2214", "MV Island Express", "Nassau → Eleuthera", "8:00 AM", "47", "78%"], status: "Boarding", tone: "info" },
              { cells: ["TRP-2216", "MV Andros Runner", "Nassau → Fresh Creek", "10:30 AM", "22", "41%"], status: "Scheduled", tone: "neutral" },
              { cells: ["TRP-2215", "MV Exuma Pride", "Nassau → George Town", "6:00 PM", "31", "54%"], status: "Weather watch", tone: "warn" },
            ],
          },
        },
      },
    },
    {
      id: "vessel",
      nav: "vessels",
      title: "Vessel management",
      description: "The vessel record holds capacity, crew and certificates, so every booking and manifest knows exactly what the boat can carry.",
      task: "Run the pre-departure checklist and mark the vessel ready.",
      screen: {
        kind: "vessel",
        data: {
          name: "MV Island Express",
          kind: "Mailboat",
          facts: [
            { label: "Status", value: "Ready" },
            { label: "Cargo capacity", value: "1,650 kg" },
            { label: "Passengers", value: "40" },
            { label: "Home port", value: "Potter's Cay Dock, Nassau" },
            { label: "Registration", value: "BHS-MB-114" },
            { label: "Master", value: "Capt. Leroy Pinder" },
          ],
          checklist: ["Safety equipment inspected", "Fuel and water confirmed", "Crew of 6 signed on", "Cargo deck clear and secured", "Port clearance filed"],
          readyLabel: "Mark ready for boarding",
          trips: {
            title: "Next sailings",
            columns: ["Trip", "Route", "Departs", "Bookings"],
            rows: [
              { cells: ["TRP-2214", "Nassau → Governor's Harbour → Harbour Island", "Today 8:00 AM", "47"] },
              { cells: ["TRP-2221", "Nassau → Governor's Harbour → Harbour Island", "Wed 8:00 AM", "38"] },
              { cells: ["TRP-2228", "Nassau → Rock Sound", "Fri 8:00 AM", "12"] },
            ],
          },
        },
      },
    },
    {
      id: "bookings",
      nav: "bookings",
      title: "Bookings",
      description: "Bookings arrive from the counter, the customer portal and WhatsApp into one list per sailing — with cargo, weight and drop-off attached.",
      task: "Open a pending booking and confirm it.",
      screen: {
        kind: "bookings",
        data: {
          heading: "TRP-2214 · Nassau → Eleuthera · 8:00 AM",
          columns: ["Customer", "Cargo", "Weight", "Drop-off"],
          confirmLabel: "Confirm booking",
          items: [
            { id: "BKG-4398", title: "Seymour's Grocery", cells: ["Seymour's Grocery", "Groceries — 40 cases", "180 kg", "Governor's Harbour"], status: "confirmed", detail: [{ label: "Phone", value: "+1 242 555 0401" }, { label: "Paid", value: "On account" }] },
            { id: "BKG-4403", title: "Eleuthera Hardware", cells: ["Eleuthera Hardware", "Cement — 10 bags", "420 kg", "Governor's Harbour"], status: "confirmed", detail: [{ label: "Phone", value: "+1 242 555 0466" }, { label: "Paid", value: "Invoice IX-7781" }] },
            { id: "BKG-4409", title: "Kevin Johnson", cells: ["Kevin Johnson", "Used refrigerator", "75 kg", "Gregory Town"], status: "pending", detail: [{ label: "Phone", value: "+1 242 555 0404" }, { label: "Requested via", value: "WhatsApp, 6:12 AM" }, { label: "Paid", value: "Pay at dock" }], note: "Customer is bringing the fridge to the dock by 7:00 AM." },
            { id: "BKG-4412", title: "Harbour Island Resort", cells: ["Harbour Island Resort", "Linens — 6 bales", "64 kg", "Harbour Island"], status: "pending", detail: [{ label: "Phone", value: "+1 242 555 0477" }, { label: "Requested via", value: "Customer portal" }, { label: "Paid", value: "On account" }] },
            { id: "BKG-4414", title: "Tarpum Bay Clinic", cells: ["Tarpum Bay Clinic", "Medical supplies", "18 kg", "Governor's Harbour"], status: "confirmed", detail: [{ label: "Handling", value: "Keep cool" }, { label: "Paid", value: "Government account" }] },
            { id: "BKG-4416", title: "Marvin Seymour", cells: ["Marvin Seymour", "Generator", "96 kg", "Rock Sound"], status: "pending", detail: [{ label: "Phone", value: "+1 242 555 0488" }, { label: "Requested via", value: "Counter" }] },
          ],
        },
      },
    },
    {
      id: "capacity",
      nav: "capacity",
      title: "Capacity",
      description: "Capacity is checked as bookings are accepted — no more loading the deck past what the vessel can carry, or turning cargo away that would have fit.",
      task: "Accept or decline the waiting requests and watch the load.",
      screen: {
        kind: "capacity",
        data: {
          trip: "TRP-2214 · MV Island Express · Nassau → Eleuthera · 8:00 AM",
          limits: [
            { label: "Cargo", unit: "kg", capacity: 1650, used: 1284 },
            { label: "Bookings", unit: "", capacity: 60, used: 47 },
          ],
          requests: [
            { id: "BKG-4419", customer: "Seymour's Grocery", detail: "Groceries — 22 cases", adds: [96, 1] },
            { id: "BKG-4420", customer: "Eleuthera Hardware", detail: "Rebar bundle", adds: [180, 1] },
            { id: "BKG-4421", customer: "Kevin Johnson", detail: "Used refrigerator", adds: [75, 1] },
            { id: "BKG-4422", customer: "Tarpum Bay Clinic", detail: "Medical supplies", adds: [18, 1] },
            { id: "BKG-4423", customer: "Harbour Island Resort", detail: "Pool furniture", adds: [64, 1] },
          ],
        },
      },
    },
    {
      id: "manifest",
      nav: "manifest",
      title: "Manifest",
      description: "Checked-in bookings become the manifest the captain signs — customer, cargo, weight, destination and booking number, ready before the lines are cast off.",
      task: "Build the manifest and clear the vessel for departure.",
      screen: {
        kind: "manifest",
        data: {
          trip: { ref: "TRP-2214", route: "Nassau → Governor's Harbour → Harbour Island", vessel: "MV Island Express", departs: "Today 8:00 AM", cutoff: "7:00 AM" },
          columns: [
            { key: "bkg", label: "Booking" },
            { key: "who", label: "Customer / passenger" },
            { key: "cargo", label: "Cargo" },
            { key: "kg", label: "Weight (kg)", numeric: true },
            { key: "dest", label: "Destination" },
          ],
          weightKey: "kg",
          lines: [
            { bkg: "BKG-4398", who: "Seymour's Grocery", cargo: "Groceries — 40 cases", kg: "180", dest: "Governor's Harbour" },
            { bkg: "BKG-4403", who: "Eleuthera Hardware", cargo: "Cement — 10 bags", kg: "420", dest: "Governor's Harbour" },
            { bkg: "BKG-4405", who: "Patrice Rahming (pax)", cargo: "2 suitcases", kg: "38", dest: "Harbour Island" },
            { bkg: "BKG-4409", who: "Kevin Johnson", cargo: "Used refrigerator", kg: "75", dest: "Gregory Town" },
            { bkg: "BKG-4412", who: "Harbour Island Resort", cargo: "Linens — 6 bales", kg: "64", dest: "Harbour Island" },
            { bkg: "BKG-4414", who: "Tarpum Bay Clinic", cargo: "Medical supplies", kg: "18", dest: "Governor's Harbour" },
            { bkg: "BKG-4416", who: "Marvin Seymour", cargo: "Generator", kg: "96", dest: "Rock Sound" },
            { bkg: "BKG-4417", who: "Cove Eleuthera Resort", cargo: "Kitchen equipment", kg: "143", dest: "Gregory Town" },
            { bkg: "BKG-4418", who: "Gina Cartwright (pax)", cargo: "Mail sacks ×4 (BPC)", kg: "52", dest: "Governor's Harbour" },
            { bkg: "BKG-4424", who: "Island Bakery", cargo: "Flour — 12 sacks", kg: "198", dest: "Governor's Harbour" },
          ],
          insight: "All checked-in bookings are on the manifest. 3 bookings without cargo details are held back.",
          buildLabel: "Build Manifest",
          finalize: { label: "Clear for departure", done: "Cleared — manifest signed by Capt. Pinder and filed with the Port Department. Customers notified on WhatsApp." },
        },
      },
    },
    {
      id: "ai",
      nav: "ai",
      title: "AI operations",
      description: "The assistant prepares tomorrow's sailing from bookings, cargo and capacity — and hands you a draft. It never changes the manifest on its own.",
      task: "Ask it to prepare tomorrow's Eleuthera operation.",
      screen: {
        kind: "ai",
        data: {
          prompt: "Prepare tomorrow's Eleuthera operation.",
          suggestions: ["Which bookings are missing cargo details?", "Is the Exuma sailing at risk?"],
          answer: [
            { type: "text", text: "Tomorrow's trip has 38 confirmed bookings and 1,012 kg of cargo. I've prepared a draft manifest and identified 3 bookings missing cargo details." },
            {
              type: "items",
              items: [
                { tone: "warn", title: "Missing cargo details", detail: "BKG-4501 (Rock Sound Pharmacy), BKG-4507 (M. Bethel), BKG-4512 (Gregory Town Grocery)." },
                { tone: "good", title: "Capacity", detail: "1,012 of 1,650 kg (61%) — room for ~600 kg of walk-up cargo." },
                { tone: "info", title: "Dock", detail: "Harbour Island agent confirmed for tomorrow's 1:15 PM drop." },
              ],
            },
          ],
          draft: { label: "Review Draft Manifest", title: "Draft manifest — TRP-2221 · Nassau → Eleuthera · Wed 8:00 AM", lines: ["38 bookings · 1,012 kg · 9 passengers", "35 lines ready, 3 held for cargo details", "WhatsApp reminders drafted for the 3 customers", "Status: DRAFT — waiting for dispatcher review"] },
          closing: "The assistant prepares recommendations. Nothing changes until a dispatcher reviews and confirms.",
        },
      },
    },
  ],
  completion: {
    headline: "Every sailing, booked and balanced.",
    points: ["Vessel capacity drives every booking decision", "Bookings from counter, portal and WhatsApp land in one list", "The manifest builds from checked-in cargo", "AI prepares tomorrow — your dispatcher approves it"],
  },
};
