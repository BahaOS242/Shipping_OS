# THE LINK — Logistics OS demo

> **From checkout to your doorstep. We handle the rest.**

An interactive product prototype for The Link Services (Bahamas). It shows how a customer
buys something in the U.S., ships it, tracks it and receives it. The flow works the same way
on the website, in an AI assistant, on WhatsApp and in the staff dashboard.

**Everything is demo data.** No real packages, prices, payments, addresses or WhatsApp messages.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
npm run typecheck
```

## Demo script

| # | Screen | Where |
|---|--------|-------|
| 1 | "What are you trying to do?" | `/` |
| 2 | I bought something → 3 packages | `/packages` |
| 3 | Amazon → **We have it!** | `/packages/p_1001` |
| 4 | Put my packages together → Done! 🎉 | `/packages/together` |
| 5 | 20 lbs → Nassau → estimate | `/cost` |
| 6 | Link Assistant: "Where's my package?" | `/help` |
| 7 | Same answer on WhatsApp (toggle "webhook payloads") | `/help/whatsapp` |
| 8 | Staff side: live conversation → package → **Message Customer** (it appears in the WhatsApp chat) | `/admin` |

Demo actions (putting packages together, chats, staff messages) are kept in `localStorage`, so every
screen tells the same story, including across browser tabs. The "Clear demo chat" link resets the chat.

## Architecture

```
Channel (web page · web chat · WhatsApp webhook · staff)
   ↓
AI Agent            src/lib/agent       planner → tools → plain-language reply
   ↓
Controlled Tools    src/lib/tools       JSON-schema tools, scoped to the signed-in customer
   ↓
The Link API        src/lib/api         the only business layer
   ↓
Repository          src/lib/data        MockRepository today → Postgres / warehouse system
```

- The AI never touches the database. It can only call the tools in `src/lib/tools/registry.ts`.
  Each tool takes its customer from `ToolContext`, which the channel sets. The model never chooses it,
  so asking for someone else's package returns "Not your package".
- Staff notes and "needs attention" flags are removed before data reaches customers or the AI
  (`CustomerPackage`).
- The agent is channel-agnostic: it returns `messages + actions + context + trace`.
  Channel adapters render that reply for each channel. For example, `src/lib/channels/whatsapp.ts`
  converts `**bold**` to `*bold*` and limits replies to 3 reply buttons of up to 20 characters.
- The planner is swappable (`Planner` interface). Today it is a deterministic keyword planner,
  so live demos behave predictably. Tomorrow it can be an LLM planner that picks tools from the same registry.

### Endpoints

| Route | Purpose |
|-------|---------|
| `POST /api/agent` | Web chat → agent |
| `GET/POST /api/channels/whatsapp/webhook` | WhatsApp Cloud API webhook (verify + inbound). Demo mode returns the outbound payloads instead of sending them |
| `GET /api/tools`, `POST /api/tools/:name` | Tool manifest / invoke |
| `POST /api/mcp` | Minimal MCP-style JSON-RPC (`initialize`, `tools/list`, `tools/call`) |

### Tools

`getCustomer · getPackages · getPackage · getShipment · calculateShipping · getLocations ·
getShippingRules · createQuote · createSupportTicket · escalateToHuman`

## Before production

- Auth: customer login (web) and verified phone → customer mapping (WhatsApp). Replace `src/lib/auth.ts`.
- `PostgresRepository` + migrations from `src/lib/types.ts`; integration with the warehouse system for package events.
- Real rates table behind `getShippingRules()`. Demo prices are placeholders.
- WhatsApp: Meta app, signature verification (`X-Hub-Signature-256`), template messages for proactive
  notifications, persistent conversation store (replace `memoryConversationStore`).
- Staff actions and the realtime inbox as real APIs (replace `src/lib/demo-store.ts`).
- LLM planner with guardrails, evals and audit logging of every tool call. Rate limits on `/api/mcp`.
- Payments provider, invoices and customs documents (duty/VAT).
