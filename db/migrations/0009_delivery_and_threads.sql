BEGIN;
CREATE POLICY operations_session_read ON customer_sessions FOR SELECT TO shipping_os_app USING(organization_id::text=current_setting('app.organization_id',true) AND pilot_is_staff() AND current_setting('app.staff_role',true) IN ('owner','admin','manager','support'));
CREATE POLICY customer_sessions_own_read ON customer_sessions FOR SELECT TO shipping_os_app USING(organization_id::text=current_setting('app.organization_id',true) AND customer_id::text=current_setting('app.customer_id',true) AND current_setting('app.actor_type',true)='customer');
CREATE POLICY customer_sessions_own_revoke ON customer_sessions FOR DELETE TO shipping_os_app USING(organization_id::text=current_setting('app.organization_id',true) AND customer_id::text=current_setting('app.customer_id',true) AND current_setting('app.actor_type',true)='customer');
CREATE POLICY customer_queue_read ON notification_outbox FOR SELECT TO shipping_os_app USING(organization_id::text=current_setting('app.organization_id',true) AND payload->>'customerId'=current_setting('app.customer_id',true));
CREATE POLICY customer_thread_reply ON pilot_records FOR UPDATE TO shipping_os_app USING(organization_id::text=current_setting('app.organization_id',true) AND customer_id::text=current_setting('app.customer_id',true) AND kind IN ('support','claim')) WITH CHECK(organization_id::text=current_setting('app.organization_id',true) AND customer_id::text=current_setting('app.customer_id',true) AND kind IN ('support','claim'));
CREATE FUNCTION pilot_customer_thread_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF current_setting('app.actor_type',true)='customer' AND
 (to_jsonb(NEW)-ARRAY['payload','version','updated_at']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['payload','version','updated_at']) THEN
  RAISE EXCEPTION 'Customer thread metadata is immutable' USING ERRCODE='42501';
 END IF;RETURN NEW;END $$;
CREATE TRIGGER customer_thread_guard BEFORE UPDATE ON pilot_records FOR EACH ROW EXECUTE FUNCTION pilot_customer_thread_guard();
ALTER TABLE notification_outbox ADD COLUMN lock_token uuid;
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='shipping_os_worker') THEN CREATE ROLE shipping_os_worker NOLOGIN NOSUPERUSER NOBYPASSRLS; END IF; END $$;
GRANT USAGE ON SCHEMA public TO shipping_os_worker;
GRANT SELECT,UPDATE ON notification_outbox TO shipping_os_worker;
CREATE POLICY notification_worker ON notification_outbox TO shipping_os_worker USING(true) WITH CHECK(true);
COMMIT;
