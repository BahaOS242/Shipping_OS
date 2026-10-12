# Customer portal

Open `/pilot/account` after customer sign-in or a staff-issued customer access code. The existing demo remains separate.

Includes the dashboard, package search/status filters and pre-alerts, package details with tracking history and associated shipments/documents, shipment details with package links and delivery confirmation, bills with payment history and balances, printable bills, a document library and receipt uploads, support conversations, claims, purchase requests, quote acceptance, notifications and account preferences.

Customers can request shipping of 1–25 ready, unassigned packages without a hold. This creates an open support request for staff review. It does not reserve packages, quote a price, clear customs or dispatch a shipment. Staff must recheck eligibility when creating a shipment. Retries with the same idempotency key return the original request.

Every detail page verifies the customer session and explicitly scopes queries to the organization and customer, in addition to PostgreSQL row policies. Other customers' records and draft bills return 404. Internal customs notes, warehouse hold notes and staff event identities are omitted. Bills subtract confirmed recorded payments; refunded payments do not reduce the balance. Documents use authenticated attachment downloads.

Lists currently show the most recent 100 packages, shipments and bills, 200 service records, and 100 files/notifications. Search filters the loaded package list. Full historical pagination, online checkout, password recovery, automated customer verification and live WhatsApp are incomplete. Email delivery requires configured SMTP credentials. No new credentials or migrations are required for this portal update.

Validation: `npm run typecheck`, `npm run lint`, `npm run build`, `npm test`, `npm run test:tracking` and `npm run test:tracking:http`. Database/HTTP tests require an explicitly disposable migrated PostgreSQL database with the restricted application role.
