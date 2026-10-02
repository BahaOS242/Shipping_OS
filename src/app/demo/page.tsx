"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useReducer } from "react";
import { DemoLanding } from "@/components/demo/DemoLanding";
import { DemoShell } from "@/components/demo/DemoShell";
import { demoReducer, initialDemoState } from "@/demo/engine";
import { getScenario } from "@/demo/registry";
import type { DemoScenario } from "@/demo/types";

/**
 * /demo                     → landing + business-type selection
 * /demo?op=<id>&step=<n>    → that scenario's interactive workspace (shareable / refresh-safe)
 */
export default function DemoPage() {
  return (
    <Suspense>
      <DemoRouter />
    </Suspense>
  );
}

function DemoRouter() {
  const params = useSearchParams();
  const scenario = getScenario(params.get("op"));
  if (!scenario) return <DemoLanding />;
  const step = Number.parseInt(params.get("step") ?? "1", 10);
  return <DemoExperience key={scenario.id} scenario={scenario} initialStep={Number.isFinite(step) ? step - 1 : 0} />;
}

function DemoExperience({ scenario, initialStep }: { scenario: DemoScenario; initialStep: number }) {
  const router = useRouter();
  const reducer = useMemo(() => demoReducer(scenario.steps.length), [scenario.steps.length]);
  const [state, dispatch] = useReducer(reducer, Math.max(0, Math.min(scenario.steps.length - 1, initialStep)), initialDemoState);

  // Keep the URL in step with the demo (replace, so Back leaves the demo instead of stepping through it).
  useEffect(() => {
    const query = `?op=${scenario.id}${state.finished ? "&done=1" : `&step=${state.stepIndex + 1}`}`;
    if (window.location.search !== query) router.replace(`/demo${query}`, { scroll: false });
  }, [router, scenario.id, state.stepIndex, state.finished]);

  const exit = useCallback(() => router.push("/demo#operations"), [router]);
  return <DemoShell scenario={scenario} state={state} dispatch={dispatch} onExit={exit} />;
}
