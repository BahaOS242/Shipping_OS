/**
 * Reference data — destinations, locations, staff. Plain data (no store), so
 * public pages can be pre-rendered on the server and the seed can reuse it.
 * Production: tables in PostgreSQL, editable per location (rates, delivery, schedules).
 */
import type { Destination, Location, StaffUser } from "@/domain/types";

export const locations: Location[] = [
  { id: "loc_fl", kind: "us_warehouse", name: "Florida Warehouse", purpose: "Where stores send your packages. We check them in here.", addressLines: ["123 Demo Warehouse Way", "Hollywood, FL 33020"], hours: "Mon–Fri 8am–6pm · Sat 9am–1pm" },
  { id: "loc_nassau", kind: "pickup_center", name: "Nassau Pickup Center", purpose: "Pick up your packages in Nassau.", destinationId: "nassau", addressLines: ["10 Demo Harbour Road", "Nassau, New Providence"], hours: "Mon–Fri 9am–6pm · Sat 9am–2pm", phone: "(242) 555-0100" },
  { id: "loc_gb", kind: "pickup_center", name: "Freeport Pickup Center", purpose: "Pick up your packages in Grand Bahama.", destinationId: "grand_bahama", addressLines: ["4 Demo Mall Drive", "Freeport, Grand Bahama"], hours: "Mon–Fri 9am–5pm · Sat 10am–1pm", phone: "(242) 555-0140" },
  { id: "loc_abaco", kind: "partner_agent", name: "Marsh Harbour Pickup Point", purpose: "Our partner in Abaco holds your packages.", destinationId: "abaco", addressLines: ["Demo Bay Street", "Marsh Harbour, Abaco"], hours: "Mon–Fri 9am–5pm", phone: "(242) 555-0120" },
  { id: "loc_exuma", kind: "partner_agent", name: "George Town Pickup Point", purpose: "Our partner in Exuma holds your packages.", destinationId: "exuma", addressLines: ["Demo Queen's Highway", "George Town, Exuma"], hours: "Mon–Fri 9am–5pm · Sat 9am–12pm", phone: "(242) 555-0130" },
  { id: "loc_eleuthera", kind: "partner_agent", name: "Governor's Harbour Pickup Point", purpose: "Our partner in Eleuthera holds your packages.", destinationId: "eleuthera", addressLines: ["Demo Haynes Avenue", "Governor's Harbour, Eleuthera"], hours: "Tue–Sat 10am–4pm", phone: "(242) 555-0150" },
  { id: "loc_andros", kind: "partner_agent", name: "Fresh Creek Pickup Point", purpose: "Our partner in Andros holds your packages.", destinationId: "andros", addressLines: ["Demo Main Road", "Fresh Creek, Andros"], hours: "Mon–Fri 10am–4pm", phone: "(242) 555-0160" },
  { id: "loc_long", kind: "partner_agent", name: "Clarence Town Pickup Point", purpose: "Our partner in Long Island holds your packages.", destinationId: "long_island", addressLines: ["Demo Queen's Highway", "Clarence Town, Long Island"], hours: "Mon–Fri 10am–3pm", phone: "(242) 555-0170" },
  { id: "loc_agents", kind: "partner_agent", name: "Family Island agent network", purpose: "Local agents meet the mailboat and hold your packages.", addressLines: ["Bimini · Cat Island · other islands", "Call to arrange pickup"], hours: "By arrangement", phone: "(242) 555-0199" },
];

const d = (id: Destination["id"], name: string, zone: Destination["zone"], group: Destination["group"], homeDelivery: boolean, fee: number, pickup: string[], schedule: Destination["schedule"]): Destination => ({
  id, name, zone, group, services: ["air", "ocean"], homeDelivery, homeDeliveryFee: fee, pickupLocationIds: pickup, schedule,
});

export const destinations: Destination[] = [
  d("nassau", "Nassau", "hub", "nassau", true, 15, ["loc_nassau"], { air: "Mon · Wed · Fri flights", ocean: "Weekly sailing (Tuesday)" }),
  d("abaco", "Abaco", "family_island", "abaco", false, 0, ["loc_abaco"], { air: "Tue · Thu · Sat flights", ocean: "Every 10 days" }),
  d("exuma", "Exuma", "family_island", "exuma", true, 25, ["loc_exuma"], { air: "Tue · Thu · Sat flights", ocean: "Every 10 days" }),
  d("grand_bahama", "Grand Bahama", "family_island", "family_islands", true, 20, ["loc_gb"], { air: "Tue · Thu · Sat flights", ocean: "Every 10 days" }),
  d("eleuthera", "Eleuthera", "family_island", "family_islands", false, 0, ["loc_eleuthera"], { air: "Tue · Thu · Sat flights", ocean: "Every 10 days" }),
  d("andros", "Andros", "family_island", "family_islands", false, 0, ["loc_andros"], { air: "Tue · Thu · Sat flights", ocean: "Every 10 days" }),
  d("long_island", "Long Island", "family_island", "family_islands", false, 0, ["loc_long"], { air: "Tue · Thu · Sat flights", ocean: "Every 10 days" }),
  d("bimini", "Bimini", "family_island", "family_islands", false, 0, ["loc_agents"], { air: "Thursday flight", ocean: "Every 10 days" }),
  d("cat_island", "Cat Island", "family_island", "family_islands", false, 0, ["loc_agents"], { air: "Thursday flight", ocean: "Every 10 days" }),
];

export const staff: StaffUser[] = [
  { id: "stf_marcus", name: "Marcus Pratt", role: "warehouse", title: "Warehouse lead, Florida" },
  { id: "stf_nadia", name: "Nadia Seymour", role: "customs", title: "Customs coordinator" },
  { id: "stf_colin", name: "Colin Munroe", role: "accounting", title: "Accounts" },
  { id: "stf_shanice", name: "Shanice Wells", role: "support", title: "Customer support" },
  { id: "stf_renee", name: "Renee Thompson", role: "manager", title: "Operations manager" },
  { id: "stf_admin", name: "Demo Admin", role: "admin", title: "Administrator" },
];


export const destinationById = (id: string) => destinations.find((d) => d.id === id);
