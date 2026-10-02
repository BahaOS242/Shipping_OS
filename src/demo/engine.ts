/**
 * DEMO ENGINE — pure state machine for any scenario (no React, unit-testable).
 *
 * - One step on screen at a time; Next / Back / jump only move between steps.
 * - Each step's screen keeps its own state (keyed by step id), so going Back
 *   shows exactly what the visitor did; Restart clears everything.
 * - Next is always allowed (nobody gets stuck); a step's task just marks it done.
 */
export type DemoState = {
  stepIndex: number;
  finished: boolean;
  done: Record<string, true>;
  screens: Record<string, unknown>;
};

export type DemoAction =
  | { type: "next" }
  | { type: "back" }
  | { type: "goto"; index: number }
  | { type: "complete"; stepId: string }
  | { type: "screen"; stepId: string; value: unknown }
  | { type: "restart" };

export const initialDemoState = (stepIndex = 0): DemoState => ({ stepIndex, finished: false, done: {}, screens: {} });

export function demoReducer(stepCount: number) {
  const clamp = (i: number) => Math.max(0, Math.min(stepCount - 1, i));
  return (s: DemoState, a: DemoAction): DemoState => {
    switch (a.type) {
      case "next":
        return s.finished ? s : s.stepIndex >= stepCount - 1 ? { ...s, finished: true } : { ...s, stepIndex: s.stepIndex + 1 };
      case "back":
        return s.finished ? { ...s, finished: false } : { ...s, stepIndex: clamp(s.stepIndex - 1) };
      case "goto":
        return { ...s, finished: false, stepIndex: clamp(a.index) };
      case "complete":
        return s.done[a.stepId] ? s : { ...s, done: { ...s.done, [a.stepId]: true } };
      case "screen":
        return { ...s, screens: { ...s.screens, [a.stepId]: a.value } };
      case "restart":
        return initialDemoState();
    }
  };
}
