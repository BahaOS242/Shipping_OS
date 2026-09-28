/**
 * LINK ASSISTANT — channel-agnostic agent.
 *
 *   channel → handleAgentRequest → planner (intent) → controlled tools (facts)
 *           → plain-language reply (+ buttons, cards, tool trace)
 *
 * Every fact in a reply comes from a tool result. The agent has no database
 * access and cannot change records except through createQuote /
 * createSupportTicket / escalateToHuman.
 */
import { fmtLb, fmtUsd } from "@/domain/rates";
import type { DestinationId } from "@/domain/types";
import * as svc from "@/services";
import { GREETING, MAIN_MENU } from "./copy";
import { rulePlanner, type Intent, type Planner } from "./planner";
import { runTool, type ToolContext, type ToolTrace } from "./tools";
import type { AgentAction, AgentContext, AgentMessage, AgentReply, AgentRequest } from "./types";

type Pkg = { id: string; merchant: string; itemName: string; status: string; statusTitle: string; explain: string; next: string; where: string; shipmentId?: string; hasReceipt: boolean; receivedAt?: string };

const A = {
  another: { id: "menu", label: "Ask Another Question", icon: "💬" },
  human: { id: "human", label: "Talk to a person", icon: "🙋" },
} satisfies Record<string, AgentAction>;

const SENTENCE: Record<string, string> = {
  incoming: "It's on its way to our Florida warehouse.",
  received: "It's currently at our Florida warehouse.",
  preparing: "It's at our Florida warehouse. We're packing it to travel.",
  in_transit: "It's on its way to The Bahamas.",
  arrived: "It's in The Bahamas.",
  ready: "It's ready for you.",
  delivered: "It was delivered. 🎉",
};

export async function handleAgentRequest(req: AgentRequest, planner: Planner = rulePlanner): Promise<AgentReply> {
  const context: AgentContext = { ...(req.context ?? {}) };
  const ctx: ToolContext = { customerId: req.customerId, channel: req.channel };
  const trace: ToolTrace[] = [];
  const intent = planner.plan(req.input, context);
  const tool = <T,>(name: string, input: Record<string, unknown> = {}) => runTool<T>(name, input, ctx, trace);
  const reply = (messages: AgentMessage[], actions: AgentAction[], next: AgentContext = {}): AgentReply => ({
    intent: intent.name,
    messages,
    actions,
    context: { lastPackageId: context.lastPackageId, ...next },
    trace,
  });

  const route = (i: Intent): AgentReply => {
    switch (i.name) {
      case "greet":
        return reply(GREETING, MAIN_MENU);

      case "find_package": {
        const pkgs = tool<Pkg[]>("getPackages");
        const active = pkgs.filter((p) => p.status !== "delivered");
        const match =
          (i.packageId && pkgs.find((p) => p.id === i.packageId)) ||
          (i.merchant && active.find((p) => p.merchant.toLowerCase().replace("’", "'").startsWith(i.merchant!))) ||
          // Default: the package that has been waiting at our warehouse the longest.
          active.filter((p) => p.status === "received").sort((a, b) => (a.receivedAt ?? "").localeCompare(b.receivedAt ?? ""))[0] ||
          active[0] ||
          pkgs[0];
        if (!match) {
          return reply([{ text: "I don't see any packages yet. 📭\n\nWhen you shop, use your **The Link address** and your package shows up here." }], [{ id: "address", label: "Show my address", icon: "🏠" }, A.another]);
        }
        if (match.id !== i.packageId && i.packageId) tool("getPackage", { packageId: i.packageId });
        const others = active.filter((p) => p.id !== match.id);
        const messages: AgentMessage[] = [
          {
            text: `Found it! 📦\n\n**${match.merchant} — ${match.itemName}**\nStatus: **${match.statusTitle}**\n\n${SENTENCE[match.status]}\n\n**Next step:** ${match.next}${!match.hasReceipt && match.status !== "delivered" ? "\n\n⚠️ We still need the store receipt for this one." : ""}`,
            card: { kind: "package", packageId: match.id, merchant: match.merchant, itemName: match.itemName, status: match.status as never, statusTitle: match.statusTitle, where: match.where, next: match.next },
          },
        ];
        if (others.length && !i.packageId) messages.push({ text: `You also have ${others.length} other package${others.length > 1 ? "s" : ""}:\n${others.map((p) => `• ${p.merchant} — ${p.statusTitle}`).join("\n")}` });
        return reply(messages, [{ id: `link:/packages/${match.id}`, label: "View Package", icon: "📦", href: `/packages/${match.id}` }, A.another], { lastPackageId: match.id });
      }

      case "quote": {
        const weights = [5, 10, 20, 50];
        if (!i.weight && !i.destinationId) return reply([{ text: "I can help with that! 💰\n\n**How heavy is it?** Pick one, or type the weight." }], weights.map((w) => ({ id: `quote:${w}`, label: `${w} lbs` })), { awaiting: "weight" });
        if (!i.destinationId) {
          return reply(
            [{ text: "I can help estimate that.\n\n**Where are you sending it?**" }],
            (["nassau", "abaco", "exuma"] as DestinationId[]).map((id) => ({ id: `quote:${i.weight}:${id}`, label: svc.getDestination(id).name, icon: "🇧🇸" })),
            { awaiting: "destination", weight: i.weight },
          );
        }
        if (!i.weight) return reply([{ text: `Going to **${svc.getDestination(i.destinationId).name}**. 👍\n\n**How heavy is it?**` }], weights.map((w) => ({ id: `quote:${w}:${i.destinationId}`, label: `${w} lbs` })), { awaiting: "weight", destinationId: i.destinationId });
        type Est = { total: number; transit: string; billableWeight: number };
        const air = tool<Est>("calculateShipping", { destinationId: i.destinationId, weight: i.weight, service: "air" });
        const ocean = tool<Est>("calculateShipping", { destinationId: i.destinationId, weight: i.weight, service: "ocean" });
        const place = svc.getDestination(i.destinationId).name;
        return reply(
          [{
            text: `To send **${fmtLb(i.weight)}** to **${place}**:\n\n✈️ Faster (air): about **${fmtUsd(air.total)}** (${air.transit})\n🚢 Bigger / slower (ocean): about **${fmtUsd(ocean.total)}** (${ocean.transit})\n\nThis is a **demo estimate**. Your final price depends on the real weight and size.`,
            card: { kind: "estimate", destination: place, weight: i.weight, billableWeight: air.billableWeight, total: air.total, transit: air.transit },
          }],
          [
            { id: "link:/ship", label: "Start Shipping", icon: "🚚", href: `/ship?to=${i.destinationId}&weight=${i.weight}` },
            { id: "link:/shipping-calculator", label: "See the details", icon: "🧮", href: `/shipping-calculator?to=${i.destinationId}&weight=${i.weight}` },
            A.another,
          ],
          { destinationId: i.destinationId, weight: i.weight },
        );
      }

      case "balance": {
        const b = tool<{ balance: number; overdue: number; openBills: { id: string; balance: number; dueAt?: string }[] }>("getBalance");
        if (b.balance <= 0) return reply([{ text: "You're all paid up ✅\n\nNothing to pay right now.", card: { kind: "balance", balance: 0, overdue: 0 } }], [A.another]);
        const next = b.openBills[0];
        return reply(
          [{
            text: `Your balance is **${fmtUsd(b.balance)}**${b.overdue ? ` (**${fmtUsd(b.overdue)} overdue**)` : ""}.\n\n${b.openBills.map((x) => `• ${x.id} — ${fmtUsd(x.balance)}${x.dueAt ? `, due ${new Date(x.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}`).join("\n")}`,
            card: { kind: "balance", balance: b.balance, overdue: b.overdue },
          }],
          [{ id: "link:/payments", label: "Pay Now", icon: "💳", href: "/payments" }, { id: `link:/payments`, label: "View Invoice", icon: "🧾", href: next ? `/payments?bill=${next.id}` : "/payments" }, A.another],
        );
      }

      case "billing_problem": {
        const pays = tool<{ id: string; amount: number; billId?: string; receivedAt: string }[]>("getPayment");
        const byBill = new Map<string, typeof pays>();
        pays.forEach((p) => p.billId && byBill.set(p.billId, [...(byBill.get(p.billId) ?? []), p]));
        const dup = [...byBill.entries()].find(([, ps]) => ps.length > 1 && ps.some((x, _, arr) => arr.filter((y) => y.amount === x.amount).length > 1));
        const t = tool<{ id: string }>("createSupportTicket", { subject: dup ? "Customer says they were charged twice" : "Billing question", message: i.text, billId: dup?.[0] });
        svc.markEscalated(req.customerId, req.channel === "whatsapp" ? "whatsapp" : "web", t.id);
        return {
          ...reply(
            [{ text: dup ? `I can see two payment records for bill **${dup[0]}** (${dup[1].map((p) => fmtUsd(p.amount)).join(" and ")}). I'm going to send this to our support team so they can review it.\n\nYour request number is **${t.id}**.` : `I'm sorry about that. I've sent this to our support team so a person can check your bill.\n\nYour request number is **${t.id}**.` }],
            [{ id: "link:/payments", label: "See my payments", icon: "💳", href: "/payments" }, A.another],
            { ticketId: t.id },
          ),
          handoff: { ticketId: t.id, expectedReply: "within 15 minutes during opening hours" },
        };
      }

      case "delivery": {
        const pkgs = tool<Pkg[]>("getPackages").filter((p) => p.shipmentId && p.status !== "delivered");
        if (!pkgs.length) return reply([{ text: "None of your packages are on the way to you yet. When a shipment reaches The Bahamas, I'll show the delivery or pickup details here." }], [{ id: "find_package", label: "Find my package", icon: "📦" }, A.another]);
        const d = tool<{ status: string; window?: { date: string; from: string; to: string }; driver?: string; method: string }>("getDeliveryStatus", { shipmentId: pkgs[0].shipmentId });
        return reply([{ text: `**${d.status}**${d.window && d.method === "home_delivery" ? `\n\n🗓️ ${new Date(d.window.date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}, ${d.window.from}–${d.window.to}${d.driver ? `\n🚚 ${d.driver}` : ""}` : ""}` }], [{ id: `link:/shipments/${pkgs[0].shipmentId}`, label: "View shipment", icon: "🚚", href: `/shipments/${pkgs[0].shipmentId}` }, A.another]);
      }

      case "storage": {
        const waiting = tool<Pkg[]>("getPackages").filter((p) => p.status === "received");
        if (!waiting.length) return reply([{ text: "You have nothing waiting at our warehouse right now. You get free storage for the first days after a package arrives." }], [A.another]);
        const st = tool<{ customerLine: string }>("getStorageStatus", { packageId: waiting[0].id });
        return reply([{ text: `**${waiting[0].merchant} — ${waiting[0].itemName}**\n${st.customerLine}` }], [{ id: "link:/packages/together", label: "Send my packages", icon: "📦", href: "/packages/together" }, A.another]);
      }

      case "claim":
        return reply([{ text: "I'm sorry! 💔 You can report a problem and our team will review it — add a photo if you can." }], [{ id: "link:/claims/new", label: "Report a problem", icon: "🛟", href: "/claims/new" }, A.human]);

      case "how_it_works":
        return reply([{ text: "No problem 😊\n\nThink of The Link like this:\n\n**You buy it → We receive it → We bring it here → You get it.**\n\nThat's it." }], [{ id: "link:/how-it-works", label: "Show Me How", icon: "👀", href: "/how-it-works" }, { id: "find_package", label: "Find my package", icon: "📦" }, A.human]);

      case "address": {
        const c = tool<{ shoppingAddress: { name: string; line1: string; line2: string; cityLine: string } }>("getCustomer");
        const a = c.shoppingAddress;
        return reply([{ text: `When you shop online, use this as your shipping address:\n\n**${a.name}**\n${a.line1}\n${a.line2}\n${a.cityLine}\n\n_(Demo address — for this prototype only.)_` }], [{ id: "link:/profile", label: "Copy my address", icon: "📋", href: "/profile" }, A.another]);
      }

      case "consolidate":
        return reply([{ text: "Yes! We can **put your packages together** so they travel as one. 📦➕📦\n\nIt's often cheaper than sending them one by one." }], [{ id: "link:/packages/together", label: "Put Them Together", icon: "📦", href: "/packages/together" }, A.another]);

      case "locations": {
        const c = svc.getCustomer(req.customerId);
        const locs = tool<{ name: string; addressLines: string[]; hours: string; kind: string }[]>("getLocations", { destinationId: c.homeDestination }).filter((l) => l.kind !== "us_warehouse");
        return reply([{ text: `Here's where you can get your packages:\n\n${locs.map((l) => `📍 **${l.name}**\n${l.addressLines.join(", ")}\n🕘 ${l.hours}`).join("\n\n")}\n\n_(Demo locations.)_` }], [{ id: "link:/locations", label: "All locations", icon: "📍", href: "/locations" }, A.another]);
      }

      case "human": {
        const out = tool<{ ticketId: string; expectedReply: string }>("escalateToHuman", { reason: i.reason, packageId: context.lastPackageId });
        return { ...reply([{ text: `Okay! 🙋 I've asked a person on The Link team to help you.\n\nThey usually reply **${out.expectedReply}**.` }], [{ id: "find_package", label: "Find my package", icon: "📦" }, A.another], { ticketId: out.ticketId }), handoff: { ticketId: out.ticketId, expectedReply: out.expectedReply } };
      }

      case "open_link": {
        const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://shipping-os-kappa.vercel.app";
        return reply([{ text: `Here you go 👇\n${base}${i.href}` }], [A.another]);
      }

      case "thanks":
        return reply([{ text: "You're welcome! 😊 Anything else?" }], MAIN_MENU);

      case "fallback":
        return reply([{ text: "Hmm, I'm not sure I understood. 🤔\n\nI can help with one of these — or I can get a person for you." }], [...MAIN_MENU, A.human], context.awaiting ? { awaiting: context.awaiting, weight: context.weight, destinationId: context.destinationId } : {});
    }
  };

  try {
    const out = route(intent);
    const saidHi = req.input.kind === "text" && /^(hi|hey|hello|good (morning|afternoon|evening))\b/i.test(req.input.text.trim());
    if (saidHi && !["greet", "fallback"].includes(intent.name)) out.messages.unshift({ text: "Hey! 👋 Let me check that for you." });
    return out;
  } catch {
    return reply([{ text: "Sorry — I couldn't find that just now. A person on our team can help." }], [A.human, A.another]);
  }
}
