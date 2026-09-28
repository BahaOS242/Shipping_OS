/**
 * LINK ASSISTANT — the channel-agnostic agent.
 *
 *   channel → handleAgentRequest() → planner (what do they want?)
 *                                  → controlled tools (get the facts)
 *                                  → compose a plain-language reply
 *
 * The agent never imports the repository or the database. It can only reach
 * data through `runTool`, scoped to the authenticated customer.
 */
import { ISLANDS, MAIN_ISLANDS, fmtLbs, fmtMoney } from "../pricing";
import { STATUS } from "../status";
import { runTool, type ToolCallTrace, type ToolContext } from "../tools/registry";
import type { Estimate } from "../pricing";
import type { IslandId, Location } from "../types";
import { GREETING, MAIN_MENU } from "./copy";
import { rulePlanner, type Intent, type Planner } from "./planner";
import type { AgentAction, AgentContext, AgentMessage, AgentReply, AgentRequest } from "./types";

type PkgSummary = {
  id: string;
  merchant: string;
  itemName: string;
  status: keyof typeof STATUS;
  statusTitle: string;
  explain: string;
  next: string;
  where: string;
};

const A = {
  findPackage: MAIN_MENU[0],
  another: { id: "menu", label: "Ask Another Question", icon: "💬" },
  human: { id: "human", label: "Talk to a person", icon: "🙋" },
} satisfies Record<string, AgentAction>;

/** What happened, in one friendly sentence. */
function sentenceFor(p: PkgSummary) {
  const it = "Your package";
  switch (p.status) {
    case "incoming":
      return `${it} is on its way to our Florida warehouse.`;
    case "received":
      return `${it} arrived at our Florida warehouse.`;
    case "preparing":
      return `${it} is at our Florida warehouse. We're packing it to travel.`;
    case "in_transit":
      return `${it} is on its way to The Bahamas.`;
    case "arrived":
      return `${it} is in The Bahamas and going through customs.`;
    case "ready":
      return `${it} is ready for you to pick up.`;
    case "delivered":
      return `${it} was delivered. 🎉`;
  }
}

export async function handleAgentRequest(req: AgentRequest, planner: Planner = rulePlanner): Promise<AgentReply> {
  const context: AgentContext = { ...(req.context ?? {}) };
  const ctx: ToolContext = { customerId: req.customerId, channel: req.channel };
  const trace: ToolCallTrace[] = [];
  const intent = await planner.plan(req.input, context);

  const reply = (messages: AgentMessage[], actions: AgentAction[], next: AgentContext = {}): AgentReply => ({
    intent: intent.name,
    messages,
    actions,
    context: { lastPackageId: context.lastPackageId, ...next },
    trace,
  });

  try {
    const out = await route(intent);
    // "Hey, where's my package?" → acknowledge the greeting before answering (feels human on every channel).
    const saidHi = req.input.kind === "text" && /^(hi|hey|hello|good (morning|afternoon|evening))\b/i.test(req.input.text.trim());
    if (saidHi && intent.name !== "greet" && intent.name !== "fallback") {
      out.messages.unshift({ text: "Hey! 👋 Let me check that for you." });
    }
    return out;
  } catch {
    return reply(
      [{ text: "Sorry — I couldn't find that just now. A person on our team can help." }],
      [A.human, A.another],
    );
  }

  async function route(intent: Intent): Promise<AgentReply> {
    switch (intent.name) {
      case "greet":
        return reply(GREETING, MAIN_MENU);

      case "find_package": {
        const pkgs = await runTool<PkgSummary[]>("getPackages", {}, ctx, trace);
        const active = pkgs.filter((p) => p.status !== "delivered");
        const match =
          (intent.packageId && pkgs.find((p) => p.id === intent.packageId)) ||
          (intent.merchant && pkgs.find((p) => p.merchant.toLowerCase().replace("’", "'") === intent.merchant)) ||
          (intent.merchant && pkgs.find((p) => p.merchant.toLowerCase().includes(intent.merchant!.replace("'", "")))) ||
          active[0] ||
          pkgs[0];

        if (!match) {
          return reply(
            [{ text: "I don't see any packages yet. 📭\n\nWhen you shop, use your **The Link address** and we'll show your package here." }],
            [{ id: "address", label: "Show my address", icon: "🏠" }, A.another],
          );
        }

        const others = active.filter((p) => p.id !== match.id);
        const messages: AgentMessage[] = [
          {
            text: `I found it! 📦\n\n**${match.merchant} — ${match.itemName}**\nStatus: **${match.statusTitle}**\n\n${sentenceFor(match)}\n\n**Next step:** ${match.next}`,
            card: {
              kind: "package",
              packageId: match.id,
              merchant: match.merchant,
              itemName: match.itemName,
              status: match.status,
              statusTitle: match.statusTitle,
              statusIcon: STATUS[match.status].icon,
              where: match.where,
              next: match.next,
            },
          },
        ];
        if (others.length && !intent.packageId) {
          messages.push({
            text: `You also have ${others.length} other package${others.length > 1 ? "s" : ""}:\n${others
              .map((p) => `• ${p.merchant} — ${STATUS[p.status].short}`)
              .join("\n")}`,
          });
        }
        return reply(
          messages,
          [{ id: `link:/packages/${match.id}`, label: "View Package", icon: "📦", href: `/packages/${match.id}` }, A.another],
          { lastPackageId: match.id },
        );
      }

      case "quote": {
        const weight = intent.weight;
        const destination = intent.destination;
        if (!weight && !destination) {
          return reply(
            [{ text: "I can help with that! 💰\n\n**How heavy is it?** Pick one, or type the weight." }],
            [5, 10, 20, 50].map((w) => ({ id: `weight:${w}`, label: `${w} lbs` })),
            { awaiting: "weight" },
          );
        }
        if (!destination) {
          return reply(
            [{ text: `I can help estimate that.\n\n**Where are you sending it?**` }],
            MAIN_ISLANDS.map((id) => ({ id: `dest:${id}`, label: ISLANDS[id].name, icon: "🇧🇸" })),
            { awaiting: "destination", weight },
          );
        }
        if (!weight) {
          return reply(
            [{ text: `Going to **${ISLANDS[destination].name}**. 👍\n\n**How heavy is it?**` }],
            [5, 10, 20, 50].map((w) => ({ id: `weight:${w}`, label: `${w} lbs` })),
            { awaiting: "weight", destination },
          );
        }
        const [air, sea] = await Promise.all([
          runTool<Estimate>("calculateShipping", { destination, weight, mode: "air" }, ctx, trace),
          runTool<Estimate>("calculateShipping", { destination, weight, mode: "sea" }, ctx, trace),
        ]);
        const place = ISLANDS[destination].name;
        return reply(
          [
            {
              text: `To send **${fmtLbs(weight)}** to **${place}**:\n\n✈️ Faster: about **${fmtMoney(air.total)}** (${air.transitDays})\n🚢 Bigger / slower: about **${fmtMoney(sea.total)}** (${sea.transitDays})\n\nThis is a **demo estimate**. Your final price may change depending on the package.`,
              card: { kind: "estimate", destination: place, weight, mode: "air", total: air.total, transitDays: air.transitDays },
            },
          ],
          [
            { id: "link:/ship", label: "Start Shipping", icon: "🚚", href: `/ship?to=${destination}&weight=${weight}` },
            { id: "link:/cost", label: "See the details", icon: "🧮", href: `/cost?to=${destination}&weight=${weight}&mode=air` },
            A.another,
          ],
          { destination, weight },
        );
      }

      case "how_it_works":
        return reply(
          [
            {
              text: "No problem 😊\n\nThink of The Link like this:\n\n**You buy it → We receive it → We bring it here → You get it.**\n\nThat's it.",
            },
          ],
          [{ id: "link:/#how-it-works", label: "Show Me How", icon: "👀", href: "/#how-it-works" }, A.findPackage, A.human],
        );

      case "address": {
        const c = await runTool<{ shoppingAddress: { name: string; line1: string; line2: string; city: string; state: string; zip: string } }>(
          "getCustomer",
          {},
          ctx,
          trace,
        );
        const a = c.shoppingAddress;
        return reply(
          [
            {
              text: `When you shop online, use this as your shipping address:\n\n**${a.name}**\n${a.line1}\n${a.line2}\n${a.city}, ${a.state} ${a.zip}\n\n_(Demo address — for this prototype only.)_`,
            },
          ],
          [{ id: "link:/account", label: "Copy my address", icon: "📋", href: "/account" }, A.another],
        );
      }

      case "consolidate":
        return reply(
          [
            {
              text: "Yes! We can **put your packages together** so they travel as one. 📦➕📦\n\nIt's often cheaper than sending them one by one.",
            },
          ],
          [{ id: "link:/packages/together", label: "Put Them Together", icon: "📦", href: "/packages/together" }, A.another],
        );

      case "locations": {
        const island: IslandId | undefined = intent.island;
        const locs = await runTool<Location[]>("getLocations", island ? { island } : {}, ctx, trace);
        const pickup = locs.filter((l) => l.kind !== "us_warehouse").slice(0, 3);
        return reply(
          [
            {
              text: `Here's where you can get your packages:\n\n${pickup
                .map((l) => `📍 **${l.name}**\n${l.addressLines.join(", ")}\n🕘 ${l.hours}`)
                .join("\n\n")}\n\n_(Demo locations.)_`,
            },
          ],
          [{ id: "link:/locations", label: "See all locations", icon: "📍", href: "/locations" }, A.another],
        );
      }

      case "human": {
        const out = await runTool<{ ticket: { id: string }; expectedReply: string }>(
          "escalateToHuman",
          { reason: intent.reason ?? "Customer asked for help", packageId: context.lastPackageId },
          ctx,
          trace,
        );
        return {
          ...reply(
            [
              {
                text: `Okay! 🙋 I've asked a person on The Link team to help you.\n\nThey usually reply **${out.expectedReply}**. You can keep chatting here.`,
              },
            ],
            [A.findPackage, A.another],
            { ticketId: out.ticket.id },
          ),
          handoff: { ticketId: out.ticket.id, expectedReply: out.expectedReply },
        };
      }

      case "open_link": {
        // Web opens links directly; message channels (WhatsApp) get a URL.
        const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://thelink.example";
        return reply([{ text: `Here you go 👇\n${base}${intent.href}` }], [A.another]);
      }

      case "thanks":
        return reply([{ text: "You're welcome! 😊 Anything else?" }], MAIN_MENU);

      case "fallback":
        return reply(
          [{ text: "Hmm, I'm not sure I understood. 🤔\n\nI can help with one of these — or I can get a person for you." }],
          [...MAIN_MENU, A.human],
          context.awaiting ? { awaiting: context.awaiting, weight: context.weight, destination: context.destination } : {},
        );
    }
  }
}
