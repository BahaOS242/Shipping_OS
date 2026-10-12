BEGIN;
DROP POLICY customer_records_read ON pilot_records;
CREATE POLICY customer_records_read ON pilot_records FOR SELECT TO shipping_os_app USING (
 organization_id::text=current_setting('app.organization_id',true)
 AND customer_id::text=current_setting('app.customer_id',true)
 AND kind IN ('bill','payment','receipt','support','claim','procurement','quote')
 AND NOT(kind='bill' AND status='draft')
);
COMMIT;
