BEGIN;
CREATE TABLE pilot_accounts (
 organization_id uuid NOT NULL,customer_id uuid NOT NULL,email text NOT NULL,password_hash text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,customer_id),UNIQUE(organization_id,email),FOREIGN KEY(organization_id,customer_id) REFERENCES customers(organization_id,id)
);
CREATE TABLE pilot_registrations (
 organization_id uuid NOT NULL REFERENCES organizations(id),id uuid NOT NULL DEFAULT gen_random_uuid(),email text NOT NULL,display_name text NOT NULL,phone text,password_hash text NOT NULL,status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),customer_id uuid,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,id),UNIQUE(organization_id,email),FOREIGN KEY(organization_id,customer_id) REFERENCES customers(organization_id,id)
);
CREATE TABLE identity_attempts (key text PRIMARY KEY,attempts integer NOT NULL,window_start timestamptz NOT NULL DEFAULT now());
ALTER TABLE pilot_accounts ENABLE ROW LEVEL SECURITY;ALTER TABLE pilot_accounts FORCE ROW LEVEL SECURITY;
ALTER TABLE pilot_registrations ENABLE ROW LEVEL SECURITY;ALTER TABLE pilot_registrations FORCE ROW LEVEL SECURITY;
ALTER TABLE identity_attempts ENABLE ROW LEVEL SECURITY;ALTER TABLE identity_attempts FORCE ROW LEVEL SECURITY;
CREATE POLICY identity_organization ON organizations FOR SELECT TO shipping_os_app USING(slug=current_setting('app.login_slug',true));
CREATE POLICY identity_account_lookup ON pilot_accounts FOR SELECT TO shipping_os_app USING(organization_id::text=current_setting('app.organization_id',true) AND email=current_setting('app.login_email',true));
CREATE POLICY identity_account_owner ON pilot_accounts TO shipping_os_app USING(organization_id::text=current_setting('app.organization_id',true) AND customer_id::text=current_setting('app.customer_id',true)) WITH CHECK(organization_id::text=current_setting('app.organization_id',true) AND customer_id::text=current_setting('app.customer_id',true));
CREATE POLICY identity_account_admin ON pilot_accounts TO shipping_os_app USING(organization_id::text=current_setting('app.organization_id',true) AND pilot_is_staff() AND current_setting('app.staff_role',true) IN ('owner','admin','manager')) WITH CHECK(organization_id::text=current_setting('app.organization_id',true) AND pilot_is_staff() AND current_setting('app.staff_role',true) IN ('owner','admin','manager'));
CREATE POLICY registration_create ON pilot_registrations FOR INSERT TO shipping_os_app WITH CHECK(organization_id::text=current_setting('app.organization_id',true) AND email=current_setting('app.login_email',true) AND status='pending');
CREATE POLICY registration_admin ON pilot_registrations TO shipping_os_app USING(organization_id::text=current_setting('app.organization_id',true) AND pilot_is_staff() AND current_setting('app.staff_role',true) IN ('owner','admin','manager')) WITH CHECK(organization_id::text=current_setting('app.organization_id',true) AND pilot_is_staff() AND current_setting('app.staff_role',true) IN ('owner','admin','manager'));
CREATE POLICY identity_rate_limit ON identity_attempts TO shipping_os_app USING(key=current_setting('app.identity_key',true)) WITH CHECK(key=current_setting('app.identity_key',true));
CREATE POLICY identity_new_session ON customer_sessions FOR INSERT TO shipping_os_app WITH CHECK(organization_id::text=current_setting('app.organization_id',true) AND customer_id::text=current_setting('app.customer_id',true) AND current_setting('app.identity_authenticated',true)='true' AND EXISTS(SELECT 1 FROM pilot_accounts a WHERE a.organization_id=customer_sessions.organization_id AND a.customer_id=customer_sessions.customer_id));
GRANT SELECT,INSERT,UPDATE,DELETE ON pilot_accounts TO shipping_os_app;
GRANT SELECT,INSERT,UPDATE ON pilot_registrations TO shipping_os_app;
GRANT SELECT,INSERT,UPDATE ON identity_attempts TO shipping_os_app;
GRANT UPDATE(status) ON notification_outbox TO shipping_os_app;
CREATE POLICY operations_queue_cancel ON notification_outbox FOR UPDATE TO shipping_os_app USING(organization_id::text=current_setting('app.organization_id',true) AND pilot_is_staff()) WITH CHECK(organization_id::text=current_setting('app.organization_id',true) AND pilot_is_staff());
CREATE POLICY customer_queue_cancel ON notification_outbox FOR UPDATE TO shipping_os_app USING(organization_id::text=current_setting('app.organization_id',true) AND payload->>'customerId'=current_setting('app.customer_id',true) AND status IN ('pending','failed')) WITH CHECK(organization_id::text=current_setting('app.organization_id',true) AND payload->>'customerId'=current_setting('app.customer_id',true) AND status='cancelled');
COMMIT;
