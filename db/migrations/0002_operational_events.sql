-- Durable operational events and retryable notifications.
-- Must be applied after 0001_production_foundation.sql.
BEGIN;
CREATE TABLE package_events (
  organization_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  package_id uuid NOT NULL,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  actor_user_id text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (organization_id,id),
  FOREIGN KEY (organization_id,package_id) REFERENCES packages(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX package_events_history_idx ON package_events(organization_id,package_id,occurred_at DESC);

CREATE TABLE operation_requests (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  idempotency_key text NOT NULL CHECK (length(idempotency_key) BETWEEN 1 AND 200),
  operation_type text NOT NULL,
  request_hash text NOT NULL,
  result jsonb,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed','failed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,idempotency_key)
);

CREATE TABLE notification_outbox (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  channel text NOT NULL CHECK (channel IN ('whatsapp','email','webhook')),
  recipient text NOT NULL,
  template_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sending','sent','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id)
);
CREATE INDEX notification_outbox_pending_idx ON notification_outbox(available_at,created_at) WHERE status IN ('pending','failed');

ALTER TABLE package_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE operation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_events FORCE ROW LEVEL SECURITY;
ALTER TABLE operation_requests FORCE ROW LEVEL SECURITY;
ALTER TABLE notification_outbox FORCE ROW LEVEL SECURITY;
COMMIT;
