"use client";

/**
 * DEMO STATE (browser only).
 *
 * Holds the things a presenter does during the demo — putting packages
 * together, chat transcripts, staff interventions — in localStorage so every
 * screen (customer web, WhatsApp mock, /admin) sees the same story, even across
 * tabs. Production replaces this with the Link API + a realtime channel.
 */
import { useSyncExternalStore } from "react";
import type { Channel, ConversationAuthor } from "./types";

export type DemoMessage = { id: string; author: ConversationAuthor; text: string; at: string; staffName?: string };

export type DemoConversation = {
  id: string;
  channel: Exclude<Channel, "staff">;
  customerId: string;
  messages: DemoMessage[];
  escalated: boolean;
  packageId?: string;
  updatedAt: string;
};

export type DemoState = {
  consolidations: { id: string; packageIds: string[]; createdAt: string }[];
  conversations: DemoConversation[];
  escalatedPackages: string[];
  staffNotes: Record<string, string[]>;
};

const KEY = "thelink-demo-v1";
const EMPTY: DemoState = { consolidations: [], conversations: [], escalatedPackages: [], staffNotes: {} };

let cache: DemoState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load(): DemoState {
  if (loaded) return cache;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) cache = { ...EMPTY, ...(JSON.parse(raw) as DemoState) };
  } catch {
    /* private mode — keep in memory */
  }
  return cache;
}

function save(next: DemoState) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== KEY) return;
    loaded = false;
    load();
    l();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useDemoStore(): DemoState {
  return useSyncExternalStore(subscribe, load, () => EMPTY);
}

const id = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();

export const demo = {
  consolidate(packageIds: string[]) {
    const s = load();
    const group = { id: `grp_${id()}`, packageIds, createdAt: now() };
    save({
      ...s,
      consolidations: [...s.consolidations.filter((g) => !g.packageIds.some((p) => packageIds.includes(p))), group],
    });
    return group;
  },

  groupFor(state: DemoState, packageId: string) {
    return state.consolidations.find((g) => g.packageIds.includes(packageId));
  },

  /** Append to (or start) the customer's conversation on a channel. */
  log(channel: DemoConversation["channel"], customerId: string, author: ConversationAuthor, text: string, extra?: { staffName?: string; packageId?: string }) {
    const s = load();
    const existing = s.conversations.find((c) => c.channel === channel && c.customerId === customerId);
    const msg: DemoMessage = { id: id(), author, text, at: now(), staffName: extra?.staffName };
    const conv: DemoConversation = existing
      ? { ...existing, messages: [...existing.messages, msg], updatedAt: msg.at, packageId: extra?.packageId ?? existing.packageId }
      : { id: `conv_${id()}`, channel, customerId, messages: [msg], escalated: false, packageId: extra?.packageId, updatedAt: msg.at };
    save({ ...s, conversations: [conv, ...s.conversations.filter((c) => c.id !== conv.id)] });
  },

  escalateConversation(channel: DemoConversation["channel"], customerId: string) {
    const s = load();
    save({
      ...s,
      conversations: s.conversations.map((c) => (c.channel === channel && c.customerId === customerId ? { ...c, escalated: true } : c)),
    });
  },

  escalatePackage(packageId: string) {
    const s = load();
    if (!s.escalatedPackages.includes(packageId)) save({ ...s, escalatedPackages: [...s.escalatedPackages, packageId] });
  },

  addStaffNote(packageId: string, note: string) {
    const s = load();
    save({ ...s, staffNotes: { ...s.staffNotes, [packageId]: [...(s.staffNotes[packageId] ?? []), note] } });
  },

  clearConversation(channel: DemoConversation["channel"], customerId: string) {
    const s = load();
    save({ ...s, conversations: s.conversations.filter((c) => !(c.channel === channel && c.customerId === customerId)) });
  },

  reset() {
    save(EMPTY);
  },
};
