BEGIN;
CREATE TABLE customer_requests (
 organization_id uuid NOT NULL,customer_id uuid NOT NULL,request_key text NOT NULL,request_hash text NOT NULL,result jsonb,
 PRIMARY KEY(organization_id,customer_id,request_key),FOREIGN KEY(organization_id,customer_id) REFERENCES customers(organization_id,id)
);
ALTER TABLE customer_requests ENABLE ROW LEVEL SECURITY;ALTER TABLE customer_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY customer_retry ON customer_requests TO shipping_os_app USING(organization_id::text=current_setting('app.organization_id',true) AND customer_id::text=current_setting('app.customer_id',true)) WITH CHECK(organization_id::text=current_setting('app.organization_id',true) AND customer_id::text=current_setting('app.customer_id',true));
GRANT SELECT,INSERT,UPDATE ON customer_requests TO shipping_os_app;
CREATE POLICY customer_profile_update ON customers FOR UPDATE TO shipping_os_app USING(organization_id::text=current_setting('app.organization_id',true) AND id::text=current_setting('app.customer_id',true)) WITH CHECK(organization_id::text=current_setting('app.organization_id',true) AND id::text=current_setting('app.customer_id',true));
-- Table-level customer UPDATE is needed for staff editing, so enforce customer
-- column boundaries even if a future caller makes an overly broad query.
CREATE FUNCTION pilot_customer_profile_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF current_setting('app.actor_type',true)='customer' AND
 (to_jsonb(NEW)-ARRAY['email_notifications','version']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['email_notifications','version']) THEN
  RAISE EXCEPTION 'Customers may only change their notification preference' USING ERRCODE='42501';
 END IF; RETURN NEW; END $$;
CREATE TRIGGER customer_profile_guard BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION pilot_customer_profile_guard();
COMMIT;
