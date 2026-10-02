# Shipping OS — modular multi-tenant architecture

One codebase · one core platform · configurable modules · per-organization
entitlements, roles, branding and navigation. A new logistics client is
onboarded through configuration, not a fork.

## 1. Starting point (assessment before the change)

| Area | What existed | What we did with it |
|---|---|---|
| Stack | Next.js 16 / React 19 client app; demo data in the browser | Kept as is |
| Data | One in-memory `DbState` (`src/data/store.ts`), localStorage in the browser, an in-memory copy on the server. **No database / Prisma.** | Partitioned per organization (see §3) |
| Layers | UI → `src/services/*` (logic + `assert(can())`) → `mutate()` → store; event bus → audit, timelines, notifications | Kept. Every service check now runs through `authorize()` |
| Auth | Mock role switcher; 7 roles; `can` / `canActOn` | Reused. Added Owner, Dispatcher and Driver, plus 6 permissions |
| Tenancy | None (one implicit company) | Added `Organization` and `organizationId` on every tenant record |
| Navigation | `OPS_NAV` filtered by role only | Role ∩ modules, and the same table drives the route guard |
| Logistics | Package, Shipment (+customs), Voyage, Destination, Location, Delivery (+POD), Bill/Payment, receipts, exceptions, claims, support, procurement, quotes | Reused. **Voyage is the Trip**, **Destination is the Island**. Only the missing primitives were added: Port, Route, Vessel, Schedule, Booking, Manifest |

The existing business (forwarding to The Bahamas) is now the default organization,
`Shipping OS Bahamas`, on the Freight Forwarder preset plus Buy-for-me, AI
assistant and API. All 30 journey steps and the 26-step UI journey run unchanged.

## 2. Conceptual structure → code

```
Core         Organizations, Users, Roles, Permissions   src/services/organizations.ts, access.ts, domain/roles.ts
             Customers / Contacts                       services/customers.ts
             Documents (store receipts)                 services/invoiceEngine.ts
             Notifications, Audit log                   services/notifications.ts, events/bus.ts (core: always on)
Commercial   Quotes, Rates                              services/quotes.ts, domain/rates.ts
             Invoices, Payments, Receipts               services/billing.ts, domain/billing.ts
Logistics    Shipments, Packages, Cargo                 services/shipments.ts, packages.ts (checkInCargoPackage)
             Warehouse, Receiving                       services/warehouse.ts, packages.ts, storage.ts
             Manifest                                   services/manifests.ts
             Tracking                                   services/timeline.ts + notifications
Network      Islands (= Destination), Ports, Routes,     services/network.ts, locations.ts
             Vessels, Trips (= Voyage), Schedules
             Capacity                                   services/capacity.ts
             Booking                                    services/bookings.ts
Delivery     Drivers, Dispatch, Deliveries, POD          services/delivery.ts
Experience   Admin dashboard (widgets), Customer portal, platform/dashboard.ts, platform/navigation.ts,
             Booking portal (/book), Driver portal       app/*, components/ops/DashboardWidgets.tsx
             (/driver), Public tracking, API/MCP
```

`src/platform/` holds pure configuration with no store access: the module registry, business-type presets,
dashboard widgets and navigation. Pages, navigation, services, API routes, onboarding and dashboards all
read from it.

## 3. Multi-tenancy

* `PlatformState = { organizations, tenants: Record<orgId, TenantState>, session, seq }`.
* **`db()` returns only the active tenant's partition.** Every existing service is
  therefore tenant-scoped without being rewritten. A record from another organization isn't
  reachable by ID; it's reported as *not found*, so IDs can't be probed.
* Every tenant row also carries `organizationId`, and `byId()` checks it again
  (defense in depth; this is the production column).
* The active tenant comes from the innermost `withTenant(orgId, fn)` scope (API requests, jobs, tests),
  falling back to the signed-in session. On the server the scope lives in **AsyncLocalStorage**
  (`app/api/_demo.ts`), so concurrent requests can't leak scope across `await`s.
* Sequences are platform-wide, so IDs never collide across tenants.
* `SCHEMA_VERSION` 3 → 4: browsers holding old demo data reseed automatically.

## 4. Authorization chain (service layer)

```
Authenticated? → Organization member? → Module enabled? → Role permitted? → Record in tenant? → ALLOW
```

`authorize(actor, module, permitted, message)` in `services/access.ts` runs this chain:

1. **Authenticated:** the actor must exist (mock auth in the demo).
2. **Member:** `actor.organizationId` must equal the active tenant, and the user or customer must exist in it.
   Invited users who haven't accepted are rejected. System jobs skip this step but still run inside an explicit tenant scope.
3. **Module:** the organization must be entitled to the module (`ModuleDisabledError`). This applies to every caller, including the system.
4. **Role:** the existing `can` / `canActOn` permission model.
5. **Ownership:** partitioned reads, plus the `byId` stamp check.

Module entitlement is not permission. With `manifest` enabled, Customer Service still can't close a manifest,
and a driver can only work deliveries assigned to them. The UI uses the same tables
(`opsPathAccess`, `customerPathMissing`) but is never the boundary.

Modules also drive **behavior through configuration, not branching**. Without `customs`, shipments skip
review. Without `billing`, nothing is billed. Without `delivery`, arrival doesn't create a last-mile delivery.
With `capacity`, bookings, load planning and `nextVoyage` refuse full trips.

## 5. Modules, presets, entitlements

* Registry: `platform/modules.ts` defines stable IDs plus label, description, category, dependencies and
  availability (`carrier_network` is *planned*: it can be granted, but has no screens yet).
* `resolveModules()` adds dependencies (capacity → vessels + routes). `toggleModule(off)` also turns off
  dependents. `validateModules()` reports invalid stored configurations. Unknown IDs are rejected.
* Presets (`platform/businessTypes.ts`): Freight Forwarder, Mailboat/Vessel Operator, Charter Operator,
  Courier, Warehouse, Full Logistics Company, Custom. Each preset is only a starting point. Afterwards,
  `Organization.modules` is the source of truth, editable in **Organization → Modules**.
* Dashboard emphasis is preset config (`dashboard: WidgetId[]`), filtered by enabled modules. An organization can override it.

## 6. Onboarding (`/onboarding`)

1. Business type → 2. Organization (name, slug, logo text, brand color, contact, locations, owner)
→ 3. Modules (preset, editable, with dependencies shown) → **create** (one transaction:
organization, entitlements, partition, owner) → 4. Invite users (Owner, Admin, Manager,
Dispatcher, Warehouse Staff, Driver, Accountant, Customer Service, Customs) → 5. Initial data
(basic CSV import for customers, vessels and ports, run through the normal services).

## 7. Inter-island flow

```
Customer → Booking (requested → confirmed: capacity check) → check-in at the dock
→ Package + Shipment (existing services: billing, tracking, notifications) on the booked Trip
→ Manifest (derived lines; close = no more loading) → departTrip → arriveTrip → (Delivery + POD if enabled)
```

Forwarders use the same primitives: `assignShipmentToTrip` plans a shipment onto a specific flight or
sailing, and `departShipment` honors that plan.

## 8. Production schema plan (PostgreSQL)

The repository has no database yet. When the store adapter moves to PostgreSQL:

* One table per entity in `domain/types.ts`. Every tenant table gets
  `organization_id uuid not null references organizations(id)`. Use composite foreign keys
  `(organization_id, id)` so a row can only reference rows in the same tenant.
* `organization_modules (organization_id, module_id)` as a join table, with `module_id` an enum of `MODULE_IDS`
  (not a JSON blob). Enums for statuses that are already closed unions (`shipment_status`,
  `booking_status`, `trip_status`, …).
* Row-level security: `using (organization_id = current_setting('app.organization_id')::uuid)`. This is
  the same semantics as `withTenant()`.
* Indexes, from the query patterns in the services (not everywhere):
  `packages (organization_id, status)`, `(organization_id, customer_id)`, `(organization_id, inbound_tracking)` ·
  `shipments (organization_id, status)`, `(organization_id, voyage_id)` · `bills (organization_id, customer_id)` ·
  `trips (organization_id, departs_at)` · `bookings (organization_id, trip_id)`, `(organization_id, status)` ·
  `deliveries (organization_id, status)`, `(organization_id, driver)` · `events (organization_id, at)` ·
  `organizations (slug) unique`.
* Event bus → transactional outbox per tenant.

## 9. Deployment

Git repository → one application → one production deployment → many organizations. Each organization gets
an `organizationId`, enabled modules, roles, branding and configuration. Isolated enterprise deployments
remain possible later, but aren't the default.

## 10. Known limitations (demo)

* Auth is still mocked (organization switcher + role switcher). API routes pick the organization from
  `X-Organization` / `?org=` and act as a demo customer. Production must derive both from a token.
* Some customer-facing copy is forwarder-specific ("left Florida"), and staff deep links point at
  `/customs/[id]` for shipments. These should become per-organization copy and a neutral shipment page.
* The public marketing pages and footer links (SEO pages, "Your U.S. address", …) are the original
  forwarder's content for every organization. Only the customer portal's logo, color and tagline are branded.
* Islands (`Destination`) are seeded from the Bahamas template for every organization.
* CSV import covers customers, vessels and ports. Rates, services, routes and existing shipments are next.
* The WhatsApp conversation context cache is keyed by phone number, not by organization and phone.
* Capacity is weight only (no volume or deck space). Bookings that are checked in heavier than booked are
  allowed if the trip has room for the difference.
