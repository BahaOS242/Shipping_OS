import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/** AI boundary: AI code reaches data only through tools → services, never the store. */
const NO_STORE = { group: ["@/data/store", "@/data/seed", "@/data/seedOrgs", "**/data/store", "**/data/seed*"], message: "AI code must go through tools → services, never the store." };
const ONLY_TOOLS = { group: ["@/services", "@/services/*"], message: "The agent may only act through the tool executor (src/ai/executor.ts)." };

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  { files: ["src/ai/**/*.ts", "src/ai/**/*.tsx"], rules: { "no-restricted-imports": ["error", { patterns: [NO_STORE] }] } },
  { files: ["src/ai/agent.ts", "src/ai/planner.ts", "src/ai/copy.ts", "src/ai/types.ts"], rules: { "no-restricted-imports": ["error", { patterns: [NO_STORE, ONLY_TOOLS] }] } },
];

export default config;
