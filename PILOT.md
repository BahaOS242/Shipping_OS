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

An administrator must create the PCL Imports organization, real customer records,
and staff memberships. No demo customers are copied into the pilot:

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
The runtime role has no customer/session provisioning privileges and no event
update/delete privileges. `GET /api/pilot/intake` returns up to 500 customers and
50 recent packages; search/pagination will be needed for larger pilots.

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
```

Tests create fixtures in the disposable database. Never supply a real database.
The PostgreSQL suite checks RLS isolation, forbidden roles, expiry/revocation,
atomic receipt history, duplicate conflicts, tenant-local tracking uniqueness,
concurrent requests, replay and rollback. HTTP tests check cookie security,
origin enforcement, login, receiving, inventory and sign-out revocation.

Still outside this slice: customer signup/login and tracking portal, staff SSO/MFA,
customer administration/import UI, package photos, labels, receiving exceptions,
notifications/outbox delivery, billing/customs/delivery persistence, production
hosting and backup/restore validation. Existing demo APIs remain simulated and
must not be presented as production integrations.
