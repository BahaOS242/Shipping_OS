import { BUSINESS_TYPES } from "@/platform/businessTypes";
import type { ScenarioInput } from "../registry";

export const charter: ScenarioInput = {
  id: "charter",
  businessType: "charter_operator",
  label: "Charter Operator",
  icon: "anchor",
  cardDescription: "Manage vessels, bookings, passengers, cargo, capacity and trip operations.",
  exampleWorkflow: ["Booking", "Passengers & cargo", "Vessel", "Capacity", "Manifest", "Departure"],
  organizationName: "Bahamas Charter Co.",
  tagline: "Charters that leave on time, full and documented.",
  user: { name: "Natalie Sweeting", role: "Charter Operations" },
  enabledModules: BUSINESS_TYPES.charter_operator.modules,
  steps: [
    {
      id: "schedule",
      nav: "trips",
      title: "Today's charters",
      description: "Every charter leaving today — vessel, route, seats booked and cargo — on one departure board. The early Andros charter is boarding now.",
      task: "Depart the boarding charter.",
      screen: {
        kind: "schedule",
        data: {
          heading: "Departures · Nassau Harbour",
          departLabel: "Depart",
          trips: [
            { id: "CHR-299", vessel: "MV Out Island Runner", route: "Nassau → Fresh Creek, Andros", departs: "7:30 AM", booked: "11 / 12", cargo: "180 kg", status: "Boarding" },
            { id: "CHR-301", vessel: "MV Bahamas Star", route: "Nassau → George Town, Exuma", departs: "9:00 AM", booked: "18 / 24", cargo: "412 kg", status: "Scheduled" },
            { id: "CHR-302", vessel: "MV Coral Spirit", route: "Nassau → Harbour Island", departs: "11:30 AM", booked: "9 / 16", cargo: "140 kg", status: "Scheduled" },
            { id: "CHR-304", vessel: "MV Out Island Runner", route: "Nassau → Bimini", departs: "2:00 PM", booked: "6 / 12", cargo: "95 kg", status: "Delayed" },
          ],
        },
      },
    },
    {
      id: "bookings",
      nav: "bookings",
      title: "Bookings",
      description: "Passenger and cargo bookings for the 9:00 AM Exuma charter — groups, divers, resort guests and freight — each with what the crew needs to know.",
      task: "Open a pending booking and confirm it.",
      screen: {
        kind: "bookings",
        data: {
          heading: "CHR-301 · MV Bahamas Star · Nassau → Exuma · 9:00 AM",
          columns: ["Lead passenger", "Passengers", "Cargo", "Drop-off"],
          confirmLabel: "Confirm booking",
          items: [
            { id: "BCC-1180", title: "The Albury family", cells: ["Michelle Albury", "4", "Luggage 62 kg", "George Town"], status: "confirmed", detail: [{ label: "Paid", value: "Card · $1,160" }, { label: "Notes", value: "Child seat requested" }] },
            { id: "BCC-1184", title: "Staniel Cay Yacht Club", cells: ["SCYC staff", "6", "Provisions 140 kg", "Staniel Cay"], status: "confirmed", detail: [{ label: "Paid", value: "On account" }] },
            { id: "BCC-1186", title: "Blue Hole Divers", cells: ["Tom Reilly", "3", "Dive gear 96 kg", "Black Point"], status: "pending", detail: [{ label: "Phone", value: "+1 242 555 0620" }, { label: "Requested via", value: "WhatsApp" }, { label: "Cargo", value: "Tanks must be empty (IMDG)" }], note: "Confirm tanks are empty before boarding." },
            { id: "BCC-1187", title: "Coral Cay Resort guests", cells: ["Sasha Ingraham", "5", "Luggage 114 kg", "George Town"], status: "confirmed", detail: [{ label: "Paid", value: "Resort account" }] },
            { id: "BCC-1189", title: "Exuma Medical Centre", cells: ["—", "0", "Medical cargo 18 kg", "George Town"], status: "pending", detail: [{ label: "Handling", value: "Cold chain" }, { label: "Contact", value: "Dr. A. Bowe" }] },
          ],
        },
      },
    },
    {
      id: "vessel",
      nav: "vessels",
      title: "Vessel",
      description: "MV Bahamas Star's record carries seats, cargo limit, crew and certificates — the numbers capacity and the manifest are checked against.",
      task: "Complete the pre-departure checklist.",
      screen: {
        kind: "vessel",
        data: {
          name: "MV Bahamas Star",
          kind: "Passenger & cargo charter",
          facts: [
            { label: "Status", value: "Ready" },
            { label: "Seats", value: "24" },
            { label: "Cargo limit", value: "600 kg" },
            { label: "Captain", value: "Capt. Dwayne Moss" },
            { label: "Crew", value: "3" },
            { label: "Registration", value: "BHS-PC-052" },
          ],
          checklist: ["Life jackets for 24 + crew", "Fuel for round trip + reserve", "Weather briefing: Exuma Sound", "Passenger safety briefing ready", "Cargo secured and weighed"],
          readyLabel: "Mark ready for boarding",
          trips: {
            title: "This week",
            columns: ["Charter", "Route", "Departs", "Booked"],
            rows: [
              { cells: ["CHR-301", "Nassau → George Town", "Today 9:00 AM", "18 / 24"] },
              { cells: ["CHR-303", "George Town → Nassau", "Today 4:30 PM", "12 / 24"] },
              { cells: ["CHR-310", "Nassau → Staniel Cay", "Thu 8:00 AM", "21 / 24"] },
            ],
          },
        },
      },
    },
    {
      id: "capacity",
      nav: "capacity",
      title: "Capacity",
      description: "Seats and cargo weight are both limits. Accepting a request checks both, so a wedding party can't be confirmed onto a boat that only has two seats left.",
      task: "Accept or decline the waiting requests.",
      screen: {
        kind: "capacity",
        data: {
          trip: "CHR-301 · MV Bahamas Star · Nassau → Exuma · 9:00 AM",
          limits: [
            { label: "Seats", unit: "", capacity: 24, used: 18 },
            { label: "Cargo", unit: "kg", capacity: 600, used: 412 },
          ],
          requests: [
            { id: "REQ-71", customer: "Bowe party", detail: "2 passengers + 35 kg luggage", adds: [2, 35] },
            { id: "REQ-72", customer: "Exuma Water Sports", detail: "Kayak rack (cargo only)", adds: [0, 88] },
            { id: "REQ-73", customer: "Knowles wedding party", detail: "6 passengers + 90 kg", adds: [6, 90] },
            { id: "REQ-74", customer: "Island photographer", detail: "1 passenger + 22 kg gear", adds: [1, 22] },
          ],
        },
      },
    },
    {
      id: "manifest",
      nav: "manifest",
      title: "Passenger & cargo manifest",
      description: "Every passenger and every piece of cargo on one manifest, ready for the captain and the harbour master before departure.",
      task: "Build the manifest and clear the charter for departure.",
      screen: {
        kind: "manifest",
        data: {
          trip: { ref: "CHR-301", route: "Nassau → George Town → Staniel Cay → Black Point", vessel: "MV Bahamas Star", departs: "Today 9:00 AM", cutoff: "8:30 AM" },
          columns: [
            { key: "bkg", label: "Booking" },
            { key: "name", label: "Name" },
            { key: "type", label: "Type" },
            { key: "kg", label: "Weight (kg)", numeric: true },
            { key: "dest", label: "Destination" },
          ],
          weightKey: "kg",
          lines: [
            { bkg: "BCC-1180", name: "Michelle Albury +3", type: "4 passengers", kg: "62", dest: "George Town" },
            { bkg: "BCC-1184", name: "Staniel Cay Yacht Club", type: "6 passengers", kg: "140", dest: "Staniel Cay" },
            { bkg: "BCC-1186", name: "Tom Reilly +2", type: "3 passengers", kg: "96", dest: "Black Point" },
            { bkg: "BCC-1187", name: "Sasha Ingraham +4", type: "5 passengers", kg: "114", dest: "George Town" },
            { bkg: "BCC-1189", name: "Exuma Medical Centre", type: "Cargo", kg: "18", dest: "George Town" },
          ],
          insight: "18 passengers and 430 kg on board — within limits for MV Bahamas Star.",
          buildLabel: "Build Manifest",
          finalize: { label: "Clear for departure", done: "Cleared — manifest filed with the harbour master; Capt. Moss notified. Passengers received boarding reminders on WhatsApp." },
        },
      },
    },
    {
      id: "ai",
      nav: "ai",
      title: "AI operations",
      description: "Ask for tomorrow's schedule and get it from real bookings and vessel capacity — ready for planning, nothing changed.",
      task: "Ask for tomorrow's charter schedule.",
      screen: {
        kind: "ai",
        data: {
          prompt: "Show me tomorrow's charter schedule.",
          suggestions: ["Which charters still have seats?", "Any weather risk tomorrow?"],
          answer: [
            { type: "text", text: "Four charters tomorrow. The Staniel Cay run is nearly full; Bimini has the most room." },
            {
              type: "table",
              table: {
                title: "Tomorrow's charters",
                columns: ["Trip", "Vessel", "Departure", "Bookings", "Remaining", "Cargo"],
                rows: [
                  { cells: ["CHR-310", "MV Bahamas Star", "8:00 AM", "21 / 24", "3 seats", "388 kg"], tone: "warn" },
                  { cells: ["CHR-311", "MV Coral Spirit", "9:30 AM", "11 / 16", "5 seats", "160 kg"] },
                  { cells: ["CHR-312", "MV Out Island Runner", "1:00 PM", "4 / 12", "8 seats", "70 kg"], tone: "good" },
                  { cells: ["CHR-313", "MV Bahamas Star", "4:30 PM", "15 / 24", "9 seats", "205 kg"] },
                ],
              },
            },
          ],
          closing: "Read-only answer from your bookings and vessel data — nothing was changed.",
        },
      },
    },
  ],
  completion: {
    headline: "Charters that leave on time, full and documented.",
    points: ["One departure board for every vessel", "Seats and cargo checked together on every booking", "Passenger and cargo manifest ready before boarding", "AI answers schedule questions from live bookings"],
  },
};
