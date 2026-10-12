"use client";

import { useSyncExternalStore } from "react";

const key = "pcl-appearance";
const event = "pcl-appearance-change";
function snapshot() {
  try {
    return localStorage.getItem(key) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}
function subscribe(callback: () => void) {
  const storageChanged = () => {
    sessionTheme = undefined;
    callback();
  };
  window.addEventListener("storage", storageChanged);
  window.addEventListener(event, callback);
  return () => {
    window.removeEventListener("storage", storageChanged);
    window.removeEventListener(event, callback);
  };
}
let sessionTheme: "light" | "dark" | undefined;
function currentTheme() {
  return sessionTheme ?? snapshot();
}
function useAppearance() {
  return useSyncExternalStore(subscribe, currentTheme, () => "light");
}
export function PilotAppearance({ children }: { children: React.ReactNode }) {
  const theme = useAppearance();
  return (
    <div className="pilot-appearance" data-theme={theme}>
      {children}
    </div>
  );
}
export function AppearanceToggle() {
  const theme = useAppearance();
  return (
    <button
      type="button"
      className="pilot-theme-toggle"
      aria-label="Dark mode"
      aria-pressed={theme === "dark"}
      onClick={() => {
        sessionTheme = theme === "dark" ? "light" : "dark";
        try {
          localStorage.setItem(key, sessionTheme);
        } catch {
          /* Keep the preference for this session when storage is unavailable. */
        }
        window.dispatchEvent(new Event(event));
      }}
    >
      <span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}
