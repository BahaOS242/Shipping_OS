# PCL Imports intake pilot

The production slice is `/pilot`. Existing routes remain a simulated demo.
The pilot uses PostgreSQL directly from the server and never trusts the demo
role switcher, a user ID header, or a tenant ID supplied by the browser.

## Local or staging setup

Use Node 22+ and a **dedicated** PostgreSQL 16+ database. Run `npm ci`.
Supply an administrator connection only to `npm run db:migrate`:

```
ADMIN_DATABASE_URL='postgresql://…' npm run db:migrate
```

The runner applies ordered migrations atomically, stores checksums and rejects
changes to previously applied migrations. If 0001/0002 were applied manually,
review their installed definitions and register their actual source checksums
in `schema_migrations` before using the runner. Do not rerun them against populated
tables. The migration creates a shared NOLOGIN role `shipping_os_app`.
Create a separate runtime login with a strong password:

```sql
CREATE ROLE shipping_os_runtime LOGIN NOSUPERUSER NOBYPASSRLS
 PASSWORD 'replace-with-a-private-generated-password';
GRANT shipping_os_app TO shipping_os_runtime;
```

Configure `DATABASE_URL` and `PILOT_ORIGIN` using `.env.local` (see `.env.example`).
Never run the application as a superuser, migration administrator, or BYPASSRLS
role. For hosted PostgreSQL use certificate-verified TLS, e.g. sslmode=verify-full,
and your provider's CA configuration. Production requires HTTPS for the secure
HttpOnly cookie. Keep administrator credentials out of the application environment.

An administrator must create the PCL Imports organization and staff memberships.
Staff can add real customers at `/pilot/customers` after sign-in. No demo customers are copied into the pilot:

```sql
INSERT INTO organizations(name,slug,organization_type)
 VALUES ('PCL Imports','pcl-imports','freight_forwarder') RETURNING id;
-- Use the returned UUID below:
INSERT INTO organization_members(organization_id,user_id,role)
 VALUES ('organization-uuid','warehouse-staff-id','warehouse');
INSERT INTO customers(organization_id,display_name)
 VALUES ('organization-uuid','Customer name') RETURNING id;
```

Issue an eight-hour private access code for an existing staff member:

```
ADMIN_DATABASE_URL='postgresql://…' npm run pilot:staff -- organization-uuid warehouse-staff-id
```

Share the code securely, then sign in at `/pilot`. Codes are random 256-bit bearer
credentials, stored only as SHA-256 hashes. Sign out revokes the server session.
An administrator can also revoke a session by deleting its `staff_sessions` row.
Membership removal or role changes take effect on the next request. This is
controlled staff provisioning for a pilot; it is not a full SSO/account platform.

## Receiving

Select a tenant customer, scan/type a tracking number, and enter positive kg/cm
measurements. The server normalizes tracking to uppercase. Receipt saves package,
package event, staff audit and idempotency result in one transaction. Existing
expected packages are received in place; duplicates and mismatched customer
assignments return a conflict. Concurrent retries with the same request key return
one saved result. A lost response can be retried with unchanged details in the
same open form. After a page reload, inventory reveals any completed receipt;
a new duplicate submission is rejected. No notification is sent.

RLS applies to customers, packages, events, audit and retry records; tenant and
user context is transaction-local. Other production tables remain deny-by-default.
The runtime role can create customers through staff-only row policies. Session
provisioning remains administrator-only; event update/delete privileges remain
unavailable. `GET /api/pilot/intake` returns the first 25 customers and 50 recent
packages. The intake customer picker searches the entire tenant directory.

## Staff customer directory

Staff can add customers at `/pilot/customers`, search by name/email/phone, and
load further pages of 25 records. Intake includes the same search, so customers
outside the initial list remain selectable. Create requires a name; email and
phone are optional. Phone numbers use international format, e.g. +12425550123.
No customer invitation or message is sent. A customer record does not create a
login credential; private customer access codes still use administrator provisioning.

Customer creation saves an audit event and idempotency result in the same
transaction. Retrying unchanged details in the same open form returns one record.
Search before creating a customer: intentional new submissions may share a name
or contact details (for example family members). Reload after a lost response and
search for the customer before creating another record. Editing, deleting, merging
and bulk importing customers are not yet implemented.

Search is tenant-scoped and treats `%`, `_` and backslash as literal characters.
Pagination uses a name/UUID cursor, avoiding an initial-list size limit. Customer
sessions cannot read the directory or create customer records.

## Customer tracking

`/pilot/tracking` shows each customer's own packages and receipt history from
PostgreSQL. Issue an eight-hour private code for an existing customer:

```
ADMIN_DATABASE_URL='postgresql://…' npm run pilot:customer -- organization-uuid customer-uuid
```

Share the code securely with that customer. Customer and warehouse sessions use
separate cookies and session tables. Customer queries enforce both organization
and customer scope; database row policies permit reads of that customer's profile,
packages and package events only. Customers cannot mutate packages, read staff
identities/audit details, or access warehouse intake. Sign-out revokes the code;
expiry or administrator deletion also ends access. Customer lists show the 50
latest packages and package details show up to 100 latest history entries.

This is controlled customer access for the pilot. Self-service signup, password
login, email verification, account recovery and an invitation delivery service
remain unimplemented. Private codes are bearer credentials; do not send them in
URL parameters or public channels. Changing warehouse or customer mappings must
be handled by an administrator. Apply migration 0004 with the corresponding
server update; it requires an explicit staff/customer transaction context.

## Verification

```
npm run typecheck
npm run lint
npm test
npm run smoke
npm run build
# Migrate a disposable database, connect as a restricted application login:
PILOT_TEST_DISPOSABLE=yes ADMIN_DATABASE_URL='postgresql://…' DATABASE_URL='postgresql://…' npm run test:pilot
# With a running server connected to that same disposable database:
PILOT_TEST_DISPOSABLE=yes ADMIN_DATABASE_URL='postgresql://…' PILOT_TEST_ORIGIN=http://localhost:3000 npm run test:pilot:http
PILOT_TEST_DISPOSABLE=yes ADMIN_DATABASE_URL='postgresql://…' DATABASE_URL='postgresql://…' npm run test:tracking
PILOT_TEST_DISPOSABLE=yes ADMIN_DATABASE_URL='postgresql://…' PILOT_TEST_ORIGIN=http://localhost:3000 npm run test:tracking:http
PILOT_TEST_DISPOSABLE=yes ADMIN_DATABASE_URL='postgresql://…' DATABASE_URL='postgresql://…' npm run test:customers
PILOT_TEST_DISPOSABLE=yes ADMIN_DATABASE_URL='postgresql://…' PILOT_TEST_ORIGIN=http://localhost:3000 npm run test:customers:http
```

Tests create fixtures in the disposable database. Never supply a real database.
The PostgreSQL suite checks RLS isolation, forbidden roles, expiry/revocation,
atomic receipt history, duplicate conflicts, tenant-local tracking uniqueness,
concurrent requests, replay and rollback. HTTP tests check cookie security,
origin enforcement, login, receiving, inventory and sign-out revocation.

Still outside this slice: self-service customer signup/account recovery, staff SSO/MFA,
customer editing/merging/import, package photos, labels, receiving exceptions,
notifications/outbox delivery, billing/customs/delivery persistence, production
hosting and backup/restore validation. Existing demo APIs remain simulated and
must not be presented as production integrations.
