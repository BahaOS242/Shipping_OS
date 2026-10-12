BEGIN;
GRANT UPDATE(attempts,last_error,available_at,locked_at,lock_token) ON notification_outbox TO shipping_os_app;
CREATE FUNCTION pilot_customer_queue_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF current_setting('app.actor_type',true)='customer' AND
 ((to_jsonb(NEW)-'status') IS DISTINCT FROM (to_jsonb(OLD)-'status') OR NEW.status<>'cancelled') THEN
  RAISE EXCEPTION 'Customer may only cancel queued delivery' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER customer_queue_guard BEFORE UPDATE ON notification_outbox FOR EACH ROW EXECUTE FUNCTION pilot_customer_queue_guard();
COMMIT;
