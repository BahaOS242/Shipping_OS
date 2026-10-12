BEGIN;
CREATE UNIQUE INDEX pilot_automatic_bill_per_shipment ON pilot_records(organization_id,(payload->>'shipmentId')) WHERE kind='bill' AND payload->>'source'='automatic' AND status<>'void';
COMMIT;
