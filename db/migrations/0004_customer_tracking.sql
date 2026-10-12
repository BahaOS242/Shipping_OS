-- Customer access uses separate sessions and SELECT-only row policies.
BEGIN;
CREATE TABLE customer_sessions (
 token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
 organization_id uuid NOT NULL,
 customer_id uuid NOT NULL,
 expires_at timestamptz NOT NULL,
 FOREIGN KEY (organization_id,customer_id) REFERENCES customers(organization_id,id) ON DELETE CASCADE
);
ALTER TABLE customer_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY customer_session_lookup ON customer_sessions FOR SELECT TO shipping_os_app
 USING (token_hash=current_setting('app.session_hash',true) AND expires_at>now());
CREATE POLICY customer_session_revoke ON customer_sessions FOR DELETE TO shipping_os_app
 USING (token_hash=current_setting('app.session_hash',true));
GRANT SELECT,DELETE ON customer_sessions TO shipping_os_app;
CREATE POLICY customer_profile ON customers FOR SELECT TO shipping_os_app
 USING (organization_id::text=current_setting('app.organization_id',true) AND id::text=current_setting('app.customer_id',true));
CREATE POLICY customer_packages ON packages FOR SELECT TO shipping_os_app
 USING (organization_id::text=current_setting('app.organization_id',true) AND customer_id::text=current_setting('app.customer_id',true));
CREATE POLICY customer_package_history ON package_events FOR SELECT TO shipping_os_app
 USING (organization_id::text=current_setting('app.organization_id',true) AND EXISTS (
  SELECT 1 FROM packages p WHERE p.organization_id=package_events.organization_id
   AND p.id=package_events.package_id AND p.customer_id::text=current_setting('app.customer_id',true)
 ));
-- Existing staff policies are explicitly restricted to staff transactions.
DO $$
DECLARE tab text; predicate text; check_predicate text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['customers','packages','package_events','audit_events','operation_requests','notification_outbox'] LOOP
  SELECT qual,with_check INTO predicate,check_predicate FROM pg_policies
   WHERE schemaname='public' AND tablename=tab AND policyname='pilot_tenant';
  EXECUTE format('ALTER POLICY pilot_tenant ON %I USING ((%s) AND current_setting(''app.actor_type'',true)=''staff'') WITH CHECK ((%s) AND current_setting(''app.actor_type'',true)=''staff'')',tab,predicate,check_predicate);
 END LOOP;
END $$;
COMMIT;
