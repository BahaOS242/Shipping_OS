# SHIPPING OS — Logistics platform (demo)

> **The digital logistics operating system connecting everything from checkout to your doorstep.**
> BUY → SHIP → TRACK → RECEIVE

A working prototype of Shipping OS' customer platform **and** its internal
operations — customer app, warehouse, customs, accounting, delivery, claims,
support, procurement, analytics, AI assistant and WhatsApp — all reading and
writing **one source of truth**.

**DEMO MODE.** Every person, package, price, payment, message and customs
decision is simulated. No real transactions happen.

## Run it

```bash
npm install
npm run dev              # http://localhost:3000
npm run build && npm start
npm run typecheck && npm run lint
npm test                 # journey (30) + platform (32) + hardening (21) + concurrent isolation (9) + demo (8)
node tests/demo-ui.mjs   # interactive prospect demo through the browser (needs Playwright + running server)
node tests/ui-journey.mjs   # same journey through the browser UI (needs Playwright + running server)
```

Use the **“Viewing as”** switcher in the black DEMO MODE bar to pick an
**organization**, then become one of its customers or staff roles. **Reset demo data**
and **Set up a new organization** are in the same menu.

## Interactive prospect demo — `/demo`

A guided, clickable simulation for logistics companies: pick **Freight Forwarder, Mailboat Operator,
Courier, Warehouse, Charter Operator or Full Logistics Company** and work through 6–7 steps of
Shipping OS configured for that operation. You receive cargo, build and close a manifest, fill a sailing
against capacity, dispatch drivers, capture proof of delivery, issue an invoice, and ask the
(simulated) AI. The URL is shareable: `/demo?op=mailboat&step=4`.

- **Scenario registry** (`src/demo/`): each business type is one config file (organization, user,
  modules, steps, simulated data, AI moment, completion copy). Modules come from the real presets,
  and the sidebar is derived from the real navigation, so each demo workspace is the actual product's
  information architecture for that configuration. Adding a seventh type = one config file.
- **Engine** (`src/demo/engine.ts`): a pure reducer for next/back/jump/restart and per-step screen
  state. Back shows what you did; Restart clears it.
- **Screens** (`src/components/demo/screens/`): 17 reusable screen kinds (dashboard, receive,
  manifest, timeline, portal, AI, vessel, bookings, capacity, dispatch, driver, proof of delivery,
  storage, grouping, departure board, connected workflow, billing). They're rendered from config, with no
  business-type branches.
- **Isolated**: demo data never touches the application store, services or AI layer (lint-enforced
  and tested). The AI moment is clearly labelled as simulated, and drafts are shown for review, never applied.

## One platform, many logistics businesses

Shipping OS is multi-tenant. Each organization gets the modules, roles, branding
and navigation it needs from **one codebase and one deployment**. See
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

| Demo organization | Type | What it shows |
|---|---|---|
| Shipping OS Bahamas | Freight Forwarder (+ buy-for-me, AI, API) | The original demo, unchanged |
| ABC Freight | Freight Forwarder | Same features, separate data; no vessels, capacity or driver portal |
| Island Express | Mailboat operator | Trips, bookings, capacity, manifests, vessels, routes, schedules |
| Swift Courier | Courier | Today's deliveries, drivers, dispatch, driver portal with proof of delivery |

- **Modules** (`src/platform/modules.ts`): stable IDs with dependencies. Enabling Capacity turns on Vessels and Routes.
- **Presets** (`src/platform/businessTypes.ts`): onboarding starting points, editable afterwards.
- **Tenant isolation** happens in the store and services. `db()` only returns the active organization's data,
  and `authorize()` checks membership → module → role → ownership on every operation.
- **Navigation, route guards and the dashboard** come from role + enabled modules.
- **Onboarding** at `/onboarding`. Organization settings (profile, modules, members, CSV import) at `/settings`.

## Architecture

```
Website · Customer app · Staff UI · Shipping OS Assistant · WhatsApp · API/MCP
                                  ↓
             Services  (business logic + authorization via roles)
                                  ↓
            Event bus  →  audit log · timelines · notifications · WhatsApp/email (simulated)
                                  ↓
              Store  (demo: browser storage adapter  →  production: PostgreSQL)
```

```
src/
  domain/     types (entities), rates engine, billing & reconciliation, storage rules,
              roles & permissions, plain-language status copy, receipt library
  data/       store (one state, storage adapter), clock, reference data, seed
  events/     event bus (EVENT_TYPES)
  services/   packages · invoiceEngine · shipments(+customs) · billing · exceptions ·
              delivery · claims · support · notifications · procurement · storage ·
              warehouse · customers · customerActions · analytics · search · timeline · quotes · session
  ai/         tools (controlled, customer-scoped) · planner · agent · whatsapp channel
  app/        routes (customer/public under (site), operations at top level, api/)
  components/ shell · ui kit · domain · customer · ops · invoice · chat · shipping · marketing
```

**How “one source of truth” works in the demo.** All entities live in one store.
Only services change it, and every change emits an event. Screens subscribe and
re-read through services, so a package received in `/warehouse` is instantly
“We have it!” for the customer, “Received” in the warehouse queue, linked in
customs, billable in accounting, answerable by the AI, and a message in the
WhatsApp thread. On Vercel the server keeps no memory between requests, so the
demo's storage adapter is the browser (it survives reloads, syncs across tabs, and
**Reset demo data** restores it). The API routes use the same services on an
in-memory copy. Production swaps the adapter for PostgreSQL. No screen code changes.

**The seed replays history.** Demo data isn't hand-typed. `src/data/seed.ts`
runs a script of real actions (pre-alerts, receiving, invoices, consolidation,
customs, departures, deliveries, payments, claims) through the services with a
backdated clock. Every bill, exception, notification and timeline entry is
therefore consistent by construction.

## Routes

**Public:** `/` · `/how-it-works` · `/shipping-calculator` · `/business` · `/locations` ·
`/locations/{nassau,abaco,exuma,family-islands}` · `/help` · SEO pages:
`/shipping-to-bahamas` `/amazon-bahamas` `/us-address-bahamas` `/freight-forwarding-bahamas`
`/air-freight-bahamas` `/ocean-freight-bahamas` `/shipping-to-exuma` `/shipping-to-abaco`
`/shipping-to-family-islands` `/business-logistics-bahamas` `/commercial-freight-bahamas`
`/package-consolidation-bahamas`. Redirects: `/shipping` `/package-forwarding` `/air-freight`
`/ocean-freight` `/consolidation` `/family-islands` `/cost` `/account`.

**Customer:** `/dashboard` (personal or business) · `/packages` · `/packages/[id]` ·
`/packages/together` · `/packages/new` · `/shipments` · `/shipments/[id]` · `/invoices`
(receipts) · `/payments` · `/claims` · `/claims/new` · `/support` · `/profile` ·
`/notifications` · `/ship` · `/buy-for-me` · `/assistant` · `/whatsapp-demo`

**Network & platform:** `/trips` · `/bookings` · `/capacity` · `/manifest` · `/vessels` · `/routes` ·
`/schedules` · `/driver` · `/settings` · `/onboarding` · customer booking portal `/book`

**Operations:** `/admin` · `/admin/search` · `/warehouse` · `/warehouse/scan` ·
`/warehouse/packages/[id]` · `/exceptions` · `/customs` · `/customs/[id]` · `/accounting` ·
`/accounting/bills/[id]` · `/accounting/invoices/[id]` · `/delivery` · `/claims` & `/support`
(staff queue when viewing as staff) · `/customers` · `/customers/[id]` · `/procurement` · `/analytics`

**API:** `POST /api/agent` · `GET/POST /api/channels/whatsapp/webhook` · `GET /api/tools` ·
`POST /api/tools/:name` · `POST /api/mcp` (JSON-RPC: initialize, tools/list, tools/call).
In this demo build (`SHIPPING_OS_AUTH_MODE=demo`), `X-Organization: <slug>` (or `?org=<slug>`) is a
**demo transport**: it picks the organization and acts as its demo customer. Responses carry
`x-shipping-os-auth: demo`. In `session` mode, identity comes from authentication and the header only
selects among the caller's memberships. WhatsApp webhooks are routed by the business number. Routes return
403 when the organization lacks the module (`api` / `assistant`). See `docs/ARCHITECTURE.md` §11.

## Demo script (≈10 minutes)

1. **Customer** (Trevor) → `/dashboard`: 3 packages, $82.03 balance, 2 actions needed.
2. `/packages/new` → tell us an Amazon order is coming → `/invoices` → *Use a sample receipt* (simulated AI extraction, confidence per field, auto-linked).
3. **Warehouse** → `/warehouse/scan` → type the tracking number → 9-step receiving wizard (auto-match, receipt found, weigh, measure → billable weight, photo, checks, destination).
4. **Customer** → package shows “We have it!” → `/packages/together` → pick two → **Put These Together** (real shipment + bill).
5. **Customs** → `/customs/[id]` → packet preview → *Request Review* (creates an exception) → `/exceptions` resolve → *Approve*.
6. **Warehouse** → *Ready to send* → **Send** → customer gets notification + WhatsApp message.
7. `/delivery` → *Mark arrived* → *Schedule* → *Dispatch* → *Delivered* (simulated proof).
8. **Customer** → `/payments` → Pay Now (DEMO PAYMENT). **Accounting** → reconciliation shows *Matched*.
9. **Manager** → `/admin` → search the package ID → everything connected + full timeline.
10. `/assistant` and `/whatsapp-demo`: “Where's my package?”, “How much do I owe?”, “I was charged twice.”

## Safety rules the code enforces

- AI code can't touch the store (lint-enforced). It calls **declared tools only** (`src/ai/contract.ts`), and the executor checks organization, module and permission before the service runs. Consequential staff actions are proposals that only the same user can confirm.
- The AI calls **controlled tools only**. The tools call services with an AI actor scoped to one customer. The AI cannot pay, refund, approve customs, reconcile, hold packages or message other customers; its only write powers are opening help requests and saving quotes (`AI_WRITE_PERMISSIONS`).
- Every mutating service goes through `authorize()`: organization membership, module entitlement, then role permission (`can` / `canActOn`). For example, only customs approves, only accounting accepts payment differences, customers only touch their own records, and a user from one organization can never read or change another organization's records.
- Customs is labelled *Demo customs workflow — final clearance decisions remain with authorized personnel*. AI item flags say *AI-generated suggestion. Human review required.*

## Before production (MVP)

- **Data:** PostgreSQL schema from `src/domain/types.ts`, a repository adapter behind the store, migrations, and an event outbox for the bus.
- **Auth:** real customer login plus verified WhatsApp numbers; staff SSO with the role model in `src/domain/roles.ts`.
- **Invoice Engine:** real extraction (vision/PDF model) behind `uploadInvoice`, file storage, and a human review queue.
- **Money:** payment provider (card/online) whose webhooks create payments; official rate cards per route/carrier replace `RATE_CARD`.
- **WhatsApp:** Cloud API sender, signature verification (`X-Hub-Signature-256`), template messages, and a conversation store.
- **Operations:** real scanner hardware/camera input, label printing, and carrier tracking webhooks.

## Future (advanced)

LLM planner behind the same `Planner` interface. A dedicated MCP server with OAuth. Broker/customs system integrations. Driver mobile app with real proof of delivery. Recurring business shipments and statements. Demand forecasting on the analytics data.
