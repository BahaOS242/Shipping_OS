/** LOCATION SERVICE — destinations, pickup points, schedules, voyages. */
import { now } from "@/data/clock";
import { db } from "@/data/store";
import type { Destination, DestinationId, ServiceLevel } from "@/domain/types";
import { byId } from "./_shared";

export const getDestinations = () => db().destinations;
export const getDestination = (id: DestinationId): Destination => byId(db().destinations, id, "Destination");
export const getLocations = () => db().locations;
export const getLocation = (id?: string) => db().locations.find((l) => l.id === id);
export const warehouse = () => db().locations.find((l) => l.kind === "us_warehouse")!;

/** Groups for the simple "Where is it going?" buttons. */
export const DESTINATION_GROUPS = [
  { group: "nassau", label: "Nassau", icon: "🇧🇸", default: "nassau" },
  { group: "abaco", label: "Abaco", icon: "🇧🇸", default: "abaco" },
  { group: "exuma", label: "Exuma", icon: "🇧🇸", default: "exuma" },
  { group: "family_islands", label: "Another Island", icon: "🏝️", default: "eleuthera" },
] as const;

export function pickupLocationsFor(id: DestinationId) {
  return getDestination(id).pickupLocationIds.map((l) => getLocation(l)!).filter(Boolean);
}

export function nextVoyage(destinationId: DestinationId, mode: ServiceLevel) {
  return db()
    .voyages.filter((v) => v.destinationId === destinationId && v.mode === mode && v.status === "scheduled" && new Date(v.departsAt).getTime() > now() - 86_400_000)
    .sort((a, b) => a.departsAt.localeCompare(b.departsAt))[0];
}

export const getVoyage = (id?: string) => db().voyages.find((v) => v.id === id);
