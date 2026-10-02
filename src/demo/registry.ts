/**
 * DEMO SCENARIO REGISTRY — every business type the interactive demo supports.
 * To add a seventh: write one config with `defineScenario` and list it here.
 */
import { resolveModules } from "@/platform/modules";
import { sidebarFor } from "./nav";
import type { DemoScenario } from "./types";
import { charter } from "./scenarios/charter";
import { courier } from "./scenarios/courier";
import { freightForwarder } from "./scenarios/freightForwarder";
import { fullLogistics } from "./scenarios/fullLogistics";
import { mailboat } from "./scenarios/mailboat";
import { warehouse } from "./scenarios/warehouse";

export type ScenarioInput = Omit<DemoScenario, "sidebarItems">;

/** Resolve modules with the real dependency resolver and derive the sidebar from the real navigation. */
export function defineScenario(input: ScenarioInput): DemoScenario {
  const enabledModules = resolveModules(input.enabledModules);
  return { ...input, enabledModules, sidebarItems: sidebarFor(enabledModules) };
}

/** Structural problems in a scenario (empty = valid). Checked by tests/demo.ts. */
export function scenarioProblems(s: DemoScenario): string[] {
  const p: string[] = [];
  if (s.steps.length < 5 || s.steps.length > 7) p.push(`${s.id}: needs 5–7 steps, has ${s.steps.length}`);
  const keys = new Set(s.sidebarItems.map((i) => i.key));
  const ids = new Set<string>();
  for (const step of s.steps) {
    if (ids.has(step.id)) p.push(`${s.id}: duplicate step ${step.id}`);
    ids.add(step.id);
    if (!keys.has(step.nav)) p.push(`${s.id}/${step.id}: nav "${step.nav}" isn't in this workspace's sidebar`);
    if (!step.title || !step.description || !step.task) p.push(`${s.id}/${step.id}: title, description and task are required`);
  }
  if (!s.steps.some((x) => x.screen.kind === "ai")) p.push(`${s.id}: every scenario has an AI moment`);
  return p;
}

export const DEMO_SCENARIOS: DemoScenario[] = [freightForwarder, mailboat, courier, warehouse, charter, fullLogistics].map(defineScenario);

export const getScenario = (id: string | null | undefined) => DEMO_SCENARIOS.find((s) => s.id === id);
