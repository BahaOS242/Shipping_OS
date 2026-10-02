/**
 * INTERACTIVE DEMO — scenario registry + engine tests (no browser).
 *   npx tsx tests/demo.ts
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { demoReducer, initialDemoState, type DemoState } from "@/demo/engine";
import { DEMO_SCENARIOS, defineScenario, getScenario, scenarioProblems } from "@/demo/registry";
import { mailboat } from "@/demo/scenarios/mailboat";
import type { ScreenKind } from "@/demo/types";
import { presetModules } from "@/platform/businessTypes";
import { validateModules } from "@/platform/modules";

let n = 0;
const test = (label: string, fn: () => void) => {
  fn();
  n++;
  console.log(`✓ ${label}`);
};

test("six scenarios, unique ids, every business type in the brief", () => {
  assert.equal(DEMO_SCENARIOS.length, 6);
  assert.equal(new Set(DEMO_SCENARIOS.map((s) => s.id)).size, 6);
  assert.deepEqual(DEMO_SCENARIOS.map((s) => s.label), ["Freight Forwarder", "Mailboat Operator", "Courier", "Warehouse", "Charter Operator", "Full Logistics Company"]);
});

test("every scenario is structurally valid (5–7 steps, nav exists in its sidebar, AI moment)", () => {
  for (const s of DEMO_SCENARIOS) assert.deepEqual(scenarioProblems(s), [], s.id);
});

test("scenario modules come from the real presets and are dependency-complete", () => {
  for (const s of DEMO_SCENARIOS) {
    assert.deepEqual(s.enabledModules, presetModules(s.businessType), s.id);
    assert.deepEqual(validateModules(s.enabledModules), [], s.id);
  }
  const ff = getScenario("freight-forwarder")!;
  assert.ok(!ff.sidebarItems.some((i) => ["vessels", "capacity", "driver"].includes(i.key)), "forwarder doesn't see fleet screens");
  assert.ok(getScenario("mailboat")!.sidebarItems.some((i) => i.key === "vessels"));
});

test("the screen kinds used are all registered (static check of the screen registry)", () => {
  const registry = readFileSync("src/components/demo/screens/index.tsx", "utf8");
  const used = new Set<ScreenKind>(DEMO_SCENARIOS.flatMap((s) => s.steps.map((x) => x.screen.kind)));
  for (const k of used) assert.ok(new RegExp(`\\b${k}: \\{ Component`).test(registry), `screen kind ${k} not registered`);
});

test("brief numbers: forwarder manifest 12 shipments / 684 kg; mailboat 1,284 of 1,650 kg (78%)", () => {
  const ff = getScenario("freight-forwarder")!;
  const m = ff.steps.find((s) => s.screen.kind === "manifest")!.screen;
  if (m.kind !== "manifest") throw new Error();
  assert.equal(m.data.lines.length, 12);
  assert.equal(m.data.lines.reduce((a, l) => a + Number(l[m.data.weightKey]), 0), 684);
  const r = ff.steps.find((s) => s.screen.kind === "receive")!.screen;
  if (r.kind !== "receive") throw new Error();
  assert.equal(r.data.packages.length, 6);
  assert.equal(r.data.packages.reduce((a, p) => a + p.weightKg, 0), 84);
  const cap = getScenario("mailboat")!.steps.find((s) => s.screen.kind === "capacity")!.screen;
  if (cap.kind !== "capacity") throw new Error();
  assert.equal(Math.round((cap.data.limits[0].used / cap.data.limits[0].capacity) * 100), 78);
});

test("a seventh business type is just configuration", () => {
  const seventh = defineScenario({ ...mailboat, id: "ferry", label: "Ferry Operator", organizationName: "Abaco Ferries" });
  assert.deepEqual(scenarioProblems(seventh), []);
  const broken = defineScenario({ ...mailboat, id: "bad", steps: mailboat.steps.slice(0, 3) });
  assert.match(scenarioProblems(broken)[0], /needs 5–7 steps/);
});

test("engine: next / back / goto / finish / restart, state per step survives navigation", () => {
  const reduce = demoReducer(6);
  let s: DemoState = initialDemoState();
  s = reduce(s, { type: "back" });
  assert.equal(s.stepIndex, 0, "can't go before step 1");
  s = reduce(s, { type: "screen", stepId: "receiving", value: { received: true } });
  s = reduce(s, { type: "complete", stepId: "receiving" });
  for (let i = 0; i < 5; i++) s = reduce(s, { type: "next" });
  assert.equal(s.stepIndex, 5);
  s = reduce(s, { type: "next" });
  assert.equal(s.finished, true);
  assert.equal(reduce(s, { type: "next" }), s, "next after finish is a no-op");
  s = reduce(s, { type: "back" });
  assert.equal(s.finished, false);
  assert.equal(s.stepIndex, 5);
  s = reduce(s, { type: "goto", index: 99 });
  assert.equal(s.stepIndex, 5, "goto is clamped");
  assert.deepEqual(s.screens.receiving, { received: true });
  assert.equal(s.done.receiving, true);
  s = reduce(s, { type: "restart" });
  assert.deepEqual(s, initialDemoState());
});

test("demo code is isolated from application data (no store / services / AI imports)", () => {
  const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)]));
  for (const f of [...files("src/demo"), ...files("src/components/demo"), ...files("src/app/demo")]) {
    const src = readFileSync(f, "utf8");
    assert.ok(!/from "@\/(data|services|ai|server)\b/.test(src), `${f} imports application data`);
  }
});

console.log(`\nAll ${n} demo tests passed.`);
