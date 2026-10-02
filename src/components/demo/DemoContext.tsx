"use client";

import { createContext, useCallback, useContext } from "react";

type StepCtx = {
  stepId: string;
  done: boolean;
  highlight?: string;
  state: unknown;
  setState: (value: unknown) => void;
  complete: () => void;
};

const Ctx = createContext<StepCtx | null>(null);

export const StepProvider = Ctx.Provider;

function useCtx() {
  const c = useContext(Ctx);
  if (!c) throw new Error("Demo screens must render inside a demo step.");
  return c;
}

/**
 * Screen state that belongs to the current step and survives Back/Next
 * (stored in the engine, keyed by step id). Restart clears it.
 */
export function useStepState<T>(initial: () => T): [T, (next: T | ((prev: T) => T)) => void] {
  const c = useCtx();
  const value = (c.state ?? initial()) as T;
  const set = useCallback(
    (next: T | ((prev: T) => T)) => c.setState(typeof next === "function" ? (next as (p: T) => T)(value) : next),
    [c, value],
  );
  return [value, set];
}

/** Completion + spotlight for the current step. */
export function useStep() {
  const c = useCtx();
  /** Spotlight ring for the element the step asks the visitor to use (until the task is done). */
  const spot = (id: string) => (c.highlight === id && !c.done ? "relative z-[1] outline outline-2 outline-offset-2 outline-sun-400 motion-safe:animate-[demo-pulse_1.8s_ease-in-out_infinite]" : "");
  return { done: c.done, complete: c.complete, spot, stepId: c.stepId };
}
