"use client";

import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Reveal `total` items one by one after an action (e.g. manifest lines populating).
 * The outcome itself lives in step state, so leaving mid-animation and coming
 * back shows the finished result; reduced-motion users get it instantly.
 */
export function useReveal(total: number, finished: boolean, everyMs = 110) {
  const [shown, setShown] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);
  const start = () => {
    if (prefersReducedMotion()) return;
    setShown(0);
    timer.current = setInterval(() => {
      setShown((n) => {
        const next = (n ?? 0) + 1;
        if (next >= total && timer.current) {
          clearInterval(timer.current);
          timer.current = null;
          return null;
        }
        return next;
      });
    }, everyMs);
  };
  return { visible: shown ?? (finished ? total : 0), animating: shown !== null, start };
}

/**
 * A short "thinking" delay for simulated AI answers (skipped for reduced motion).
 * Deliberately not cancelled on unmount: the callback writes to the step's state
 * in the engine, so leaving mid-answer and coming back shows the finished answer.
 */
export function useDelay() {
  return (fn: () => void, ms: number) => {
    if (prefersReducedMotion()) fn();
    else setTimeout(fn, ms);
  };
}
