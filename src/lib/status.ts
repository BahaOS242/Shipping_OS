import type { PackageStatus } from "./types";

/**
 * Every status the customer can see, written in plain language.
 * This is the single source of truth for status copy across web, AI and WhatsApp.
 */
export type StatusMeta = {
  status: PackageStatus;
  /** Big, friendly headline. */
  title: string;
  /** Short label for badges and lists. */
  short: string;
  icon: string;
  /** One sentence: what is happening right now. */
  explain: string;
  /** What happens next, in plain words. */
  next: string;
  /** Where the package physically is, in plain words. */
  where: string;
  tone: "waiting" | "good" | "moving" | "done";
};

export const STATUS: Record<PackageStatus, StatusMeta> = {
  incoming: {
    status: "incoming",
    title: "Coming to our warehouse",
    short: "Coming to us",
    icon: "🚚",
    explain: "The store is sending it to our Florida warehouse.",
    next: "When it gets to us, we'll check it in and send you a message.",
    where: "With the store's delivery company",
    tone: "waiting",
  },
  received: {
    status: "received",
    title: "We have it!",
    short: "We have it",
    icon: "📦",
    explain: "Your package is safely at our Florida warehouse.",
    next: "We're getting it ready to travel to The Bahamas.",
    where: "Florida Warehouse",
    tone: "good",
  },
  preparing: {
    status: "preparing",
    title: "We're getting it ready",
    short: "Getting ready",
    icon: "🏷️",
    explain: "We're weighing it, checking it and packing it to travel.",
    next: "It will leave on the next trip to The Bahamas.",
    where: "Florida Warehouse",
    tone: "good",
  },
  in_transit: {
    status: "in_transit",
    title: "Coming to The Bahamas",
    short: "On the way",
    icon: "✈️",
    explain: "Your package is on its way across the water.",
    next: "When it lands, it goes through the government check (customs).",
    where: "On the way to The Bahamas",
    tone: "moving",
  },
  arrived: {
    status: "arrived",
    title: "It's in The Bahamas!",
    short: "In The Bahamas",
    icon: "🏝️",
    explain: "It landed and is going through the government check (customs).",
    next: "We'll tell you the moment it's ready for you.",
    where: "In The Bahamas — at customs",
    tone: "moving",
  },
  ready: {
    status: "ready",
    title: "Ready for you",
    short: "Ready for you",
    icon: "✅",
    explain: "Your package is waiting for you. Come get it, or we can bring it.",
    next: "Pick it up, or ask us to deliver it.",
    where: "Your pickup center",
    tone: "done",
  },
  delivered: {
    status: "delivered",
    title: "Delivered 🎉",
    short: "Delivered",
    icon: "🎉",
    explain: "You have it. Enjoy!",
    next: "Nothing to do. Shop again anytime.",
    where: "With you",
    tone: "done",
  },
};

/** The five simple steps shown on every package timeline. */
export const TIMELINE_STEPS = [
  { key: "bought", label: "Bought", icon: "🛒" },
  { key: "at_link", label: "Arrived at The Link", icon: "📦" },
  { key: "getting_ready", label: "Getting ready", icon: "🏷️" },
  { key: "on_the_way", label: "On the way to The Bahamas", icon: "✈️" },
  { key: "ready", label: "Ready for you", icon: "✅" },
] as const;

export type TimelineStepState = "done" | "current" | "todo";

/** Index of the step that is "happening now" for each status. */
const CURRENT_STEP: Record<PackageStatus, number> = {
  incoming: 1,
  received: 2,
  preparing: 2,
  in_transit: 3,
  arrived: 3,
  ready: 4,
  delivered: 5,
};

export function timelineFor(status: PackageStatus) {
  const current = CURRENT_STEP[status];
  return TIMELINE_STEPS.map((step, i) => {
    let state: TimelineStepState = i < current ? "done" : i === current ? "current" : "todo";
    // "Ready for you" is reached, not pending, once a package is ready.
    if (status === "ready" && i === 4) state = "done";
    return { ...step, state };
  });
}

/** 0–100, for compact progress bars. */
export function progressFor(status: PackageStatus) {
  const order: PackageStatus[] = ["incoming", "received", "preparing", "in_transit", "arrived", "ready", "delivered"];
  return Math.round((order.indexOf(status) / (order.length - 1)) * 100);
}

/** Packages still at (or heading to) the U.S. warehouse can be put together. */
export function canConsolidate(status: PackageStatus) {
  return status === "incoming" || status === "received";
}
