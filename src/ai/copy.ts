import type { AgentAction, AgentMessage } from "./types";

export const MAIN_MENU: AgentAction[] = [
  { id: "find_package", label: "Find my package", icon: "📦" },
  { id: "quote", label: "How much will it cost?", icon: "💰" },
  { id: "how_it_works", label: "I'm not sure", icon: "❓" },
];

export const GREETING: AgentMessage[] = [
  { text: "Hi! 👋 I'm **Link Assistant**.\n\nI can help you find your package, estimate shipping costs, or figure out what to do next." },
];

export const SUGGESTIONS = ["Where's my package?", "How much does 20 lbs cost?", "How much do I owe?", "I don't know how this works.", "I was charged twice."];
