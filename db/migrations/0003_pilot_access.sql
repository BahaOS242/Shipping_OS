-- Run with a migration administrator, never application credentials.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='shipping_os_app') THEN
  CREATE ROLE shipping_os_app NOLOGIN NOSUPERUSER NOBYPASSRLS;
 END IF;
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='shipping_os_app' AND (rolsuper OR rolbypassrls OR rolcanlogin)) THEN
  RAISE EXCEPTION 'shipping_os_app must be a restricted NOLOGIN role';
 END IF;
END $$;
CREATE TABLE staff_sessions (
 token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
 organization_id uuid NOT NULL, user_id text NOT NULL, expires_at timestamptz NOT NULL,
 FOREIGN KEY (organization_id,user_id) REFERENCES organization_members(organization_id,user_id) ON DELETE CASCADE
);
ALTER TABLE staff_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY session_lookup ON staff_sessions FOR SELECT TO shipping_os_app
 USING (token_hash=current_setting('app.session_hash',true) AND expires_at>now());
CREATE POLICY session_revoke ON staff_sessions FOR DELETE TO shipping_os_app
 USING (token_hash=current_setting('app.session_hash',true));
GRANT DELETE ON staff_sessions TO shipping_os_app;
CREATE POLICY own_membership ON organization_members FOR SELECT TO shipping_os_app
 USING (user_id=current_setting('app.user_id',true) AND organization_id::text=current_setting('app.organization_id',true));
CREATE POLICY pilot_organization ON organizations FOR SELECT TO shipping_os_app
 USING (id::text=current_setting('app.organization_id',true));
DO $$
DECLARE tab text;
BEGIN
 FOREACH tab IN ARRAY ARRAY['customers','packages','package_events','audit_events','operation_requests','notification_outbox'] LOOP
 EXECUTE format('CREATE POLICY pilot_tenant ON %I TO shipping_os_app USING (organization_id::text=current_setting(''app.organization_id'',true) AND EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id=%I.organization_id AND m.user_id=current_setting(''app.user_id'',true) AND m.role IN (''owner'',''admin'',''manager'',''warehouse''))) WITH CHECK (organization_id::text=current_setting(''app.organization_id'',true) AND EXISTS (SELECT 1 FROM organization_members m WHERE m.organization_id=%I.organization_id AND m.user_id=current_setting(''app.user_id'',true) AND m.role IN (''owner'',''admin'',''manager'',''warehouse'')))',tab,tab,tab);
 END LOOP;
END $$;
GRANT USAGE ON SCHEMA public TO shipping_os_app;
GRANT SELECT ON staff_sessions,organization_members,organizations,customers TO shipping_os_app;
GRANT SELECT,INSERT,UPDATE ON packages,operation_requests TO shipping_os_app;
GRANT SELECT,INSERT ON package_events,audit_events,notification_outbox TO shipping_os_app;
GRANT USAGE ON SEQUENCE audit_events_id_seq TO shipping_os_app;
COMMIT;
