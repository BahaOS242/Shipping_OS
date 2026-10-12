BEGIN;
ALTER TABLE customers ADD COLUMN archived_at timestamptz, ADD COLUMN merged_into uuid, ADD COLUMN version integer NOT NULL DEFAULT 1, ADD COLUMN email_notifications boolean NOT NULL DEFAULT false;
ALTER TABLE customers ADD FOREIGN KEY (organization_id,merged_into) REFERENCES customers(organization_id,id);
ALTER TABLE packages ADD COLUMN bin text NOT NULL DEFAULT '', ADD COLUMN merchant text NOT NULL DEFAULT '', ADD COLUMN item_description text NOT NULL DEFAULT '', ADD COLUMN destination text NOT NULL DEFAULT '', ADD COLUMN service text NOT NULL DEFAULT 'air' CHECK(service IN ('air','ocean')), ADD COLUMN hold_reason text, ADD COLUMN condition text NOT NULL DEFAULT 'good' CHECK(condition IN ('good','damaged')), ADD COLUMN declared_value_cents bigint CHECK(declared_value_cents>=0), ADD COLUMN version integer NOT NULL DEFAULT 1;
ALTER TABLE shipments ADD COLUMN destination text NOT NULL DEFAULT '', ADD COLUMN service text NOT NULL DEFAULT 'air' CHECK(service IN ('air','ocean')), ADD COLUMN customs_status text NOT NULL DEFAULT 'pending' CHECK(customs_status IN ('pending','review','cleared','blocked')), ADD COLUMN customs_notes text NOT NULL DEFAULT '', ADD COLUMN delivery_method text NOT NULL DEFAULT 'pickup' CHECK(delivery_method IN ('pickup','delivery')), ADD COLUMN delivery_address text NOT NULL DEFAULT '', ADD COLUMN driver text NOT NULL DEFAULT '', ADD COLUMN received_by text, ADD COLUMN delivered_at timestamptz, ADD COLUMN version integer NOT NULL DEFAULT 1;
CREATE TABLE pilot_records (
 organization_id uuid NOT NULL REFERENCES organizations(id), id uuid NOT NULL DEFAULT gen_random_uuid(),
 customer_id uuid, kind text NOT NULL CHECK(kind IN ('bill','payment','receipt','support','claim','procurement','quote','exception','rate','voyage','settings')),
 status text NOT NULL, payload jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(payload)='object'),
 version integer NOT NULL DEFAULT 1, created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id), FOREIGN KEY(organization_id,customer_id) REFERENCES customers(organization_id,id)
);
CREATE INDEX pilot_records_queue_idx ON pilot_records(organization_id,kind,status,updated_at DESC);
CREATE TABLE pilot_attachments (
 organization_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), customer_id uuid NOT NULL,
 package_id uuid, record_id uuid, name text NOT NULL, mime_type text NOT NULL CHECK(mime_type IN ('image/png','image/jpeg','application/pdf')),
 content bytea NOT NULL CHECK(octet_length(content) BETWEEN 1 AND 5242880), checksum text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(organization_id,id),
 FOREIGN KEY(organization_id,customer_id) REFERENCES customers(organization_id,id),
 FOREIGN KEY(organization_id,package_id) REFERENCES packages(organization_id,id),
 FOREIGN KEY(organization_id,record_id) REFERENCES pilot_records(organization_id,id)
);
CREATE TABLE pilot_notifications (
 organization_id uuid NOT NULL, id uuid NOT NULL DEFAULT gen_random_uuid(), customer_id uuid NOT NULL,
 title text NOT NULL, message text NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id), FOREIGN KEY(organization_id,customer_id) REFERENCES customers(organization_id,id)
);
ALTER TABLE pilot_records ENABLE ROW LEVEL SECURITY; ALTER TABLE pilot_records FORCE ROW LEVEL SECURITY;
ALTER TABLE pilot_attachments ENABLE ROW LEVEL SECURITY; ALTER TABLE pilot_attachments FORCE ROW LEVEL SECURITY;
ALTER TABLE pilot_notifications ENABLE ROW LEVEL SECURITY; ALTER TABLE pilot_notifications FORCE ROW LEVEL SECURITY;
CREATE FUNCTION pilot_is_staff() RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT current_setting('app.actor_type',true)='staff' AND EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id::text=current_setting('app.organization_id',true) AND m.user_id=current_setting('app.user_id',true) AND m.role<>'customer')
$$;
REVOKE ALL ON FUNCTION pilot_is_staff() FROM PUBLIC; GRANT EXECUTE ON FUNCTION pilot_is_staff() TO shipping_os_app;
DO $$ DECLARE tab text; BEGIN
 FOREACH tab IN ARRAY ARRAY['customers','packages','package_events','audit_events','operation_requests','notification_outbox','shipments','shipment_packages','pilot_records','pilot_attachments','pilot_notifications'] LOOP
  EXECUTE format('CREATE POLICY operations_read ON %I FOR SELECT TO shipping_os_app USING (organization_id::text=current_setting(''app.organization_id'',true) AND pilot_is_staff())',tab);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['shipments','shipment_packages','pilot_records','pilot_attachments','pilot_notifications'] LOOP
  EXECUTE format('CREATE POLICY operations_write ON %I TO shipping_os_app USING (organization_id::text=current_setting(''app.organization_id'',true) AND pilot_is_staff()) WITH CHECK (organization_id::text=current_setting(''app.organization_id'',true) AND pilot_is_staff())',tab);
 END LOOP;
END $$;
CREATE POLICY customer_records_read ON pilot_records FOR SELECT TO shipping_os_app USING (organization_id::text=current_setting('app.organization_id',true) AND customer_id::text=current_setting('app.customer_id',true) AND kind IN ('bill','payment','receipt','support','claim','procurement','quote'));
CREATE POLICY customer_records_create ON pilot_records FOR INSERT TO shipping_os_app WITH CHECK (organization_id::text=current_setting('app.organization_id',true) AND customer_id::text=current_setting('app.customer_id',true) AND kind IN ('support','claim','procurement','quote','receipt') AND status IN ('open','submitted','requested','draft'));
CREATE POLICY customer_files ON pilot_attachments FOR SELECT TO shipping_os_app USING (organization_id::text=current_setting('app.organization_id',true) AND customer_id::text=current_setting('app.customer_id',true));
CREATE POLICY customer_files_create ON pilot_attachments FOR INSERT TO shipping_os_app WITH CHECK (organization_id::text=current_setting('app.organization_id',true) AND customer_id::text=current_setting('app.customer_id',true) AND (package_id IS NULL OR EXISTS(SELECT 1 FROM packages p WHERE p.organization_id=pilot_attachments.organization_id AND p.id=pilot_attachments.package_id AND p.customer_id=pilot_attachments.customer_id)) AND (record_id IS NULL OR EXISTS(SELECT 1 FROM pilot_records r WHERE r.organization_id=pilot_attachments.organization_id AND r.id=pilot_attachments.record_id AND r.customer_id=pilot_attachments.customer_id)));
CREATE POLICY customer_notifications ON pilot_notifications FOR SELECT TO shipping_os_app USING (organization_id::text=current_setting('app.organization_id',true) AND customer_id::text=current_setting('app.customer_id',true));
CREATE POLICY customer_notification_read ON pilot_notifications FOR UPDATE TO shipping_os_app USING (organization_id::text=current_setting('app.organization_id',true) AND customer_id::text=current_setting('app.customer_id',true)) WITH CHECK (organization_id::text=current_setting('app.organization_id',true) AND customer_id::text=current_setting('app.customer_id',true));
CREATE POLICY customer_shipments ON shipments FOR SELECT TO shipping_os_app USING (organization_id::text=current_setting('app.organization_id',true) AND customer_id::text=current_setting('app.customer_id',true));
CREATE POLICY customer_shipment_links ON shipment_packages FOR SELECT TO shipping_os_app USING (organization_id::text=current_setting('app.organization_id',true) AND EXISTS(SELECT 1 FROM packages p WHERE p.organization_id=shipment_packages.organization_id AND p.id=shipment_packages.package_id AND p.customer_id::text=current_setting('app.customer_id',true)));
CREATE POLICY operations_customer_edit ON customers FOR UPDATE TO shipping_os_app USING (organization_id::text=current_setting('app.organization_id',true) AND pilot_is_staff() AND EXISTS(SELECT 1 FROM organization_members WHERE organization_id=customers.organization_id AND user_id=current_setting('app.user_id',true) AND role IN ('owner','admin','manager','warehouse','support'))) WITH CHECK (organization_id::text=current_setting('app.organization_id',true) AND pilot_is_staff());
CREATE POLICY operations_audit_create ON audit_events FOR INSERT TO shipping_os_app WITH CHECK (organization_id::text=current_setting('app.organization_id',true) AND pilot_is_staff());
CREATE POLICY operations_retry_write ON operation_requests TO shipping_os_app USING (organization_id::text=current_setting('app.organization_id',true) AND pilot_is_staff()) WITH CHECK (organization_id::text=current_setting('app.organization_id',true) AND pilot_is_staff());
CREATE POLICY operations_session_create ON customer_sessions FOR INSERT TO shipping_os_app WITH CHECK (organization_id::text=current_setting('app.organization_id',true) AND pilot_is_staff() AND EXISTS(SELECT 1 FROM organization_members WHERE organization_id=customer_sessions.organization_id AND user_id=current_setting('app.user_id',true) AND role IN ('owner','admin','manager','support')));
CREATE POLICY operations_session_revoke ON customer_sessions FOR DELETE TO shipping_os_app USING (organization_id::text=current_setting('app.organization_id',true) AND pilot_is_staff());
GRANT SELECT,INSERT,UPDATE ON shipments,pilot_records TO shipping_os_app;
GRANT SELECT,INSERT,DELETE ON shipment_packages TO shipping_os_app;
GRANT SELECT,INSERT ON pilot_attachments TO shipping_os_app;
GRANT SELECT,INSERT ON pilot_notifications TO shipping_os_app; GRANT UPDATE(read_at) ON pilot_notifications TO shipping_os_app;
GRANT UPDATE ON customers TO shipping_os_app;
GRANT INSERT ON customer_sessions TO shipping_os_app;
CREATE POLICY customer_prealert ON packages FOR INSERT TO shipping_os_app WITH CHECK(organization_id::text=current_setting('app.organization_id',true) AND customer_id::text=current_setting('app.customer_id',true) AND current_setting('app.actor_type',true)='customer' AND status='expected' AND hold_reason IS NULL AND weight_kg IS NULL);
CREATE POLICY customer_prealert_event ON package_events FOR INSERT TO shipping_os_app WITH CHECK(organization_id::text=current_setting('app.organization_id',true) AND event_type='package.expected' AND actor_user_id IS NULL AND EXISTS(SELECT 1 FROM packages p WHERE p.organization_id=package_events.organization_id AND p.id=package_events.package_id AND p.customer_id::text=current_setting('app.customer_id',true) AND p.status='expected'));
CREATE POLICY operations_package_update ON packages FOR UPDATE TO shipping_os_app USING(organization_id::text=current_setting('app.organization_id',true) AND pilot_is_staff() AND EXISTS(SELECT 1 FROM organization_members WHERE organization_id=packages.organization_id AND user_id=current_setting('app.user_id',true) AND role IN ('owner','admin','manager','warehouse','customs','support','driver'))) WITH CHECK(organization_id::text=current_setting('app.organization_id',true) AND pilot_is_staff());
CREATE POLICY operations_package_event ON package_events FOR INSERT TO shipping_os_app WITH CHECK(organization_id::text=current_setting('app.organization_id',true) AND pilot_is_staff());
CREATE POLICY operations_notification_enqueue ON notification_outbox FOR INSERT TO shipping_os_app WITH CHECK(organization_id::text=current_setting('app.organization_id',true) AND pilot_is_staff());
GRANT UPDATE(customer_id) ON pilot_attachments,pilot_notifications TO shipping_os_app;
CREATE UNIQUE INDEX pilot_payment_reference_unique ON pilot_records(organization_id,(payload->>'reference')) WHERE kind='payment';
COMMIT;
