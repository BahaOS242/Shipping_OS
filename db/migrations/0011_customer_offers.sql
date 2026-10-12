BEGIN;
CREATE POLICY customer_offer_accept ON pilot_records FOR UPDATE TO shipping_os_app
 USING(organization_id::text=current_setting('app.organization_id',true) AND customer_id::text=current_setting('app.customer_id',true) AND ((kind='quote' AND status='offered') OR (kind='procurement' AND status='quoted')))
 WITH CHECK(organization_id::text=current_setting('app.organization_id',true) AND customer_id::text=current_setting('app.customer_id',true) AND status IN ('approved','rejected','cancelled'));
CREATE OR REPLACE FUNCTION pilot_customer_thread_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('app.actor_type',true)='customer' THEN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.id IS DISTINCT FROM OLD.id OR NEW.customer_id IS DISTINCT FROM OLD.customer_id OR NEW.kind IS DISTINCT FROM OLD.kind OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN RAISE EXCEPTION 'Record metadata is immutable'; END IF;
  IF OLD.kind IN ('quote','procurement') THEN
   IF NOT((OLD.kind='quote' AND OLD.status='offered') OR (OLD.kind='procurement' AND OLD.status='quoted')) OR NEW.status NOT IN ('approved','rejected','cancelled') OR (NEW.payload-'updates') IS DISTINCT FROM (OLD.payload-'updates') THEN RAISE EXCEPTION 'Invalid offer acceptance'; END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN RAISE EXCEPTION 'Customer cannot change request status'; END IF;
 END IF;
 RETURN NEW;
END $$;
COMMIT;
