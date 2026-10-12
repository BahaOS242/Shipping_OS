# Automatic invoicing and customer assistant

## Billing

Confirming a shipment as ready creates an automatic **draft bill** in the same transaction as the shipment update. Customers cannot see drafts. Billing staff review and issue the bill using the existing workflow; issued bills appear in the customer portal and enqueue configured notifications. A ready shipment can also be calculated using Billing → Calculate draft for shipment.

Configure organization-wide pricing in Rates. Choose route destination, air/ocean service, USD/BSD currency, price per billable kilogram or cubic foot, minimum freight, handling per package, delivery per shipment, and a dimensional divisor in cm³/kg. Activate the rate after review. Exactly one active pricing profile must match a route; no profile or multiple matching profiles produces a pricing-pending draft that cannot be issued. Calculate that same draft again after fixing rates. Older flat rate records are not used by the automatic calculator.

Weight billing uses the greater of actual kg and volume / divisor for each package, rounded upward to 0.1 kg. Volume billing converts cm³ to cubic feet and rounds upward to 0.1 cubic feet per package. Freight is the greater of the minimum charge and the total billable units × unit price, rounded to cents. Handling is per package; delivery applies only to delivery shipments. All packages require positive measurements.

Each calculated draft saves the selected rate, package measurements and line items. Repeated/concurrent generation returns the same priced bill without repricing it. One non-void automatic bill is allowed per shipment. Void a priced draft and regenerate it if the pricing must change. Cancelling a shipment voids its automatic draft; an issued automatic bill must first be reconciled and voided, with external refunds recorded if required. Customs duties, taxes, storage, insurance, discounts and unlisted surcharges are excluded and require staff verification/separate billing. No money moves automatically.

### Sample Nassau rates

These invented rates were authorized by the user for preview use and are not PCL's approved prices:

| Service | Unit price | Minimum freight | Handling/package | Delivery/shipment |
| --- | --- | --- | --- | --- |
| Air | BSD 5.50 / billable kg | BSD 15.00 | BSD 2.50 | BSD 10.00 |
| Ocean | BSD 8.00 / cubic ft | BSD 20.00 | BSD 3.00 | BSD 15.00 |

Dimensional divisor: 6000 cm³/kg. Due date defaults to seven days from generation. Rates → Add sample Nassau rates installs missing organization-wide profiles without replacing active profiles. Sample drafts carry a visible warning and require explicit preview-use confirmation before issue. Replace/retire sample profiles before live use.

## Customer assistant

Open `/pilot/account?tab=Assistant`. This first version is a guided account assistant with intent matching and factual replies from the verified customer's PostgreSQL records. It handles tracking numbers, package status, balances, receipts, shipping/consolidation guidance, quotes, shopping requests, notifications and staff handoff links. It does not call an external language model or require an AI key. Unknown questions get a supported-topic prompt. The browser retains the latest ten exchanges until navigation; chat is not stored in the database.

`POST /api/pilot/customer/assistant` accepts only a message (1–1000 characters), requires the configured origin and a valid customer cookie, and returns no-store replies. It does not accept customer/organization identifiers or perform mutations. Replies omit staff identities and internal hold/customs notes. Operational actions remain in their authenticated forms. Summaries use the portal's bounded recent-record lists; they are not a full historical statement.

## Verification

Apply migration 0013 with the administrative migration role, then run the web app with the restricted application role. Tests: `test:billing`, `test:operations`, `test:tracking:http`, `typecheck`, `lint`, `build`, and the demo journey suite. Test databases must be explicitly disposable. SMTP credentials are still required for live email; live WhatsApp, online checkout and a general-purpose model-backed assistant remain unconfigured.
