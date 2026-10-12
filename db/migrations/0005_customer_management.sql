BEGIN;
-- Existing staff-only WITH CHECK policy limits creation to the session tenant.
GRANT INSERT ON customers TO shipping_os_app;
CREATE INDEX customers_tenant_name_idx ON customers(organization_id,lower(display_name),id);
COMMIT;
