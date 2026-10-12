# PCL Imports operational pilot

The PostgreSQL pilot lives under `/pilot`. Existing demo pages and demo APIs remain simulated. Do not use the demo role switcher, AI tools or WhatsApp demo to operate pilot records.

## What works

- `/pilot`: receive pre-alerted or new packages, persistent measurements, customer search and duplicate protection.
- `/pilot/operations`: inventory/bin/detail updates, damage review and holds, preparation, shipments by customer/route, document-based customs clearance, dispatch/arrival/delivery with recipient confirmation, manifests and inventory exports.
- Customer directory: create/search, edit, archive, merge, issue/revoke private access codes. Merge moves operational records and revokes the source customer's access. Keep audit records instead of destructive deletion.
- Billing: draft/issue/void bills, record confirmed external cash/bank/card payments, outstanding balances, external refund records and CSV export. No funds are moved by the application.
- Documents: authenticated PNG/JPEG/PDF uploads up to 5 MB, package/receipt association and review. Customs clearance requires a verified purchase record with an attached original for every shipment package. Files are stored in PostgreSQL and downloaded as attachments; no OCR or malware scanning is implemented.
- Service queues: customer/staff support and claims, customer replies, staff resolutions, exceptions, purchase requests and quotes. Managers price offers; customers accept or decline prices and terms before purchasing progresses. Rates and voyages have manual lifecycle management; rates are a catalog, not an automatic freight or duty calculation engine.
- `/pilot/account`: own packages/pre-alerts, shipments, bills/payments, documents, service/purchase/quote requests, offer acceptance, notifications and email preferences.
- `/pilot/sign-in`: customer registration request, manual identity verification/approval, password login. Customers with a privately provisioned access code can establish/change a password from Settings. Password changes revoke other sessions. Recovery requires staff verification and a replacement private code; there is no email reset flow.
- QR package labels, role-checked exports, managerial audit history, notification delivery queue and manual retries.

## Setup

Use Node 22+ and a dedicated PostgreSQL 16+ database. Install locked dependencies with `npm ci`. Supply an administrator connection only to migration/provision commands:

```
ADMIN_DATABASE_URL='postgresql://…' npm run db:migrate
```

Migrations 0001–0012 apply in order, atomically per file, with source checksums. Do not edit applied migrations or rerun manual table creation against populated tables. If 0001/0002 were applied manually, compare installed definitions and register their actual checksums before using the runner.

Create a restricted application login:

```sql
CREATE ROLE shipping_os_runtime LOGIN NOSUPERUSER NOBYPASSRLS
 PASSWORD 'replace-with-a-private-generated-password';
GRANT shipping_os_app TO shipping_os_runtime;
```

Set `DATABASE_URL` and exact `PILOT_ORIGIN` in `.env.local`. Keep administrator and worker credentials outside the web application environment. Hosted PostgreSQL needs certificate-verified TLS (`sslmode=verify-full` and the provider's CA configuration). Production cookies require HTTPS. The server rejects superuser/BYPASSRLS database credentials.

Create the real organization and initial staff through an administrator connection:

```sql
INSERT INTO organizations(name,slug,organization_type)
 VALUES ('PCL Imports','pcl-imports','freight_forwarder') RETURNING id;
INSERT INTO organization_members(organization_id,user_id,role)
 VALUES ('returned-organization-uuid','staff-identity','owner');
```

Membership roles are owner, admin, manager, warehouse, customs, accounting, support and driver. Initial staff provisioning and later membership changes use an administrator connection; no staff SSO/MFA or team-management UI exists yet.

```
ADMIN_DATABASE_URL='postgresql://…' npm run pilot:staff -- organization-uuid staff-identity
```

The command prints a private eight-hour access code once. Share it privately, sign in at `/pilot/operations`, and create customers through the directory. Managers/support staff can issue customer codes from the Customers module. An administrator can also provision one:

```
ADMIN_DATABASE_URL='postgresql://…' npm run pilot:customer -- organization-uuid customer-uuid
```

Codes are 256-bit bearer credentials, stored only as SHA-256 hashes. Never put them in URLs or public messages. Staff/customer cookies and session tables are separate. Sign-out, expiry and revocation end access. Membership changes take effect on the next request. Customer registration must be approved only after an actual identity check, especially when matching an existing customer. Email/contact values are not automatically verified.

## Security and concurrency

The server derives organization, identity and customer from verified sessions. Database row policies enforce tenant and customer boundaries; context is transaction-local. Role checks govern actions and exports. Staff may read tenant operational records, including financial records in the workspace response; this is tenant isolation, not fine-grained departmental confidentiality. Configure narrower read policies before a deployment requiring that separation.

Mutating JSON operations require exact configured Origin and bounded request bodies. Idempotency keys protect retries; changes, audit/events and results commit together. Customer offers lock records and preserve price/terms. Financial amounts use integer cents internally and decimal money in the UI. Payments serialize on bills and reject overpayment or duplicate references. UI edits submit versions to detect stale records. Private codes are returned once and excluded from persisted retry results; if a response is lost, issue a replacement.

Workspace lists show latest 100 packages/shipments/customers, 300 staff records and 200 files; customer lists are also bounded. Search covers the tenant package/customer directory. CSV exports cover all matching inventory, manifests, billing or audit rows. Operational queue pagination and large-file/object-storage capacity are future work.

## Notifications

Package receipt/status, shipments, records and payments create customer in-app updates. Email is queued only when the customer has an email and opts in. Opt-out, contact changes, archive and merge cancel pending/failed messages; delivery already in progress may finish.

Create a separate worker login inheriting the migration-created `shipping_os_worker` NOLOGIN role:

```sql
CREATE ROLE shipping_os_delivery LOGIN NOSUPERUSER NOBYPASSRLS
 PASSWORD 'replace-with-a-private-generated-password';
GRANT shipping_os_worker TO shipping_os_delivery;
```

Set worker-only `WORKER_DATABASE_URL`, `SMTP_HOST`, `SMTP_PORT` (465 or 587), `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`. Set `EMAIL_DELIVERY_ENABLED=true` only after configuring a real sender and reviewing the queue. Then run `npm run notifications:deliver` in a worker environment. The command processes one batch of up to ten emails concurrently; production scheduling and monitoring remain to be configured. It does not run automatically in Next.js.

SMTP uses verified TLS, bounded timeouts, plain text and no file/URL attachment access. The worker claims rows with SKIP LOCKED, retries with backoff, leases abandoned work for five minutes and stops after eight attempts. Managers can retry failed jobs after checking the provider. SMTP is at-least-once: a crash after acceptance can cause duplicates; deterministic Message-ID is not a provider delivery guarantee. Mock worker tests send no external email. Live SMTP delivery has not been verified. See [Nodemailer SMTP documentation](https://nodemailer.com/smtp).

## Verification

```
npm run typecheck
npm run lint
npm test
npm run smoke
npm run build
```

Against a freshly migrated disposable database, export `PILOT_TEST_DISPOSABLE=yes`, `ADMIN_DATABASE_URL` and restricted `DATABASE_URL`. Run `test:pilot`, `test:tracking`, `test:customers`, and `test:operations`. The operations test additionally requires a restricted `WORKER_DATABASE_URL`. It cancels other due notification fixtures before testing mocked global worker claims; never point this test at real data.

With a production-built local server connected to the same disposable database, set `PILOT_TEST_ORIGIN` to its origin and run `test:pilot:http`, `test:tracking:http`, `test:customers:http`, and `test:operations:http`. Tests create fictional records. They require real PostgreSQL rather than an in-memory substitute.

## Remaining production work

Live payment checkout/webhooks/reconciliation, WhatsApp delivery and inbound conversations, carrier tracking, automated OCR/AI invoice extraction, staff SSO/MFA, email verification/self-service reset, staff administration UI, customer bulk import, automatic tariffs/duties/storage fees, delivery signature/photo proof, analytics across date ranges, long-term document storage/scanning, production hosting/worker scheduler, backup/restore validation, operational monitoring and load testing are not complete. Customer receipt review and customs clearance are operational records, not government customs submissions.

Provide real database and deployment access, verified PCL staff identities, approved rates/fees/customs rules, payment/carrier/AI/messaging provider decisions and credentials before connecting these services. Do not merge or deploy solely because the local tests pass.
