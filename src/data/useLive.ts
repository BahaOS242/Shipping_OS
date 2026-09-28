"use client";

import { useSyncExternalStore } from "react";
import { storeVersion, subscribeStore } from "./store";

/**
 * Subscribe a component to the store. Returns false during server render and
 * the first client pass (show a loading state), true once data is live.
 * Every mutation re-renders subscribers, so all screens stay in sync.
 */
export function useLive(): boolean {
  return useSyncExternalStore(subscribeStore, storeVersion, () => -1) >= 0;
}
