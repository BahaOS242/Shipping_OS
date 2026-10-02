import {
  normalizeModules,
  ORGANIZATION_PRESETS,
  type ModuleId,
} from "@/domain/modules";

function assert(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

const freight = ORGANIZATION_PRESETS.freight_forwarder;
assert(freight.includes("warehouse"), "freight preset should include warehouse");
assert(freight.includes("manifest"), "freight preset should include manifest");

const mailboat = ORGANIZATION_PRESETS.mailboat_operator;
assert(mailboat.includes("vessels"), "mailboat preset should include vessels");
assert(mailboat.includes("capacity"), "mailboat preset should include capacity");
assert(mailboat.includes("booking"), "mailboat preset should include booking");

const normalized = normalizeModules(["capacity"] as ModuleId[]);
assert(normalized.includes("vessels"), "capacity should require vessels");
assert(normalized.includes("routes"), "capacity should require routes");

console.log("modules: ok");
