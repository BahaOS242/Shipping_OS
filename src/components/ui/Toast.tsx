"use client";

import { createContext, useCallback, useContext, useState } from "react";

type T = { id: number; text: string; kind: "ok" | "error" };
const Ctx = createContext<(text: string, kind?: T["kind"]) => void>(() => {});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((text: string, kind: T["kind"] = "ok") => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, text, kind }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), kind === "error" ? 5000 : 3000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} role={t.kind === "error" ? "alert" : "status"} className={`pointer-events-auto max-w-md animate-pop rounded-2xl px-4 py-3 text-[15px] font-semibold shadow-[var(--shadow-lift)] ${t.kind === "error" ? "bg-coral-700 text-white" : "bg-ink text-white"}`}>
            {t.kind === "error" ? "⚠ " : "✓ "}
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);

/** Run a service call; show success or the business error. Returns the result or undefined. */
export function useAction() {
  const toast = useToast();
  return useCallback(
    <R,>(fn: () => R, ok?: string | ((r: R) => string)): R | undefined => {
      try {
        const r = fn();
        if (ok) toast(typeof ok === "function" ? ok(r) : ok);
        return r;
      } catch (e) {
        toast((e as Error).message || "Something went wrong", "error");
        return undefined;
      }
    },
    [toast],
  );
}
