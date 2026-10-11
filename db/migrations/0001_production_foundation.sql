-- Shipping OS production foundation, v1.
-- Apply only to a dedicated PostgreSQL database after review.
-- All access goes through a trusted server; no browser database credentials.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  organization_type text NOT NULL CHECK (organization_type IN ('freight_forwarder','mailboat_operator','charter_operator','courier','warehouse','logistics_company','other')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organization_members (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('owner','admin','manager','warehouse','customs','accounting','support','driver','customer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,user_id)
);
CREATE INDEX organization_members_user_idx ON organization_members(user_id);

CREATE TABLE customers (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id)
);

CREATE TABLE packages (
  organization_id uuid NOT NULL,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  tracking_number text,
  status text NOT NULL DEFAULT 'expected' CHECK (status IN ('expected','received','processing','ready','in_transit','arrived','delivered','exception')),
  weight_kg numeric(12,3) CHECK (weight_kg >= 0),
  length_cm numeric(12,2) CHECK (length_cm >= 0),
  width_cm numeric(12,2) CHECK (width_cm >= 0),
  height_cm numeric(12,2) CHECK (height_cm >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id),
  FOREIGN KEY (organization_id,customer_id) REFERENCES customers(organization_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX packages_tenant_tracking_unique ON packages(organization_id,tracking_number) WHERE tracking_number IS NOT NULL;
CREATE INDEX packages_tenant_status_idx ON packages(organization_id,status,created_at DESC);

CREATE TABLE shipments (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','ready','in_transit','arrived','delivered','cancelled','exception')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (organization_id,id),
  FOREIGN KEY (organization_id,customer_id) REFERENCES customers(organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE shipment_packages (
  organization_id uuid NOT NULL,
  shipment_id uuid NOT NULL,
  package_id uuid NOT NULL,
  PRIMARY KEY (organization_id,shipment_id,package_id),
  FOREIGN KEY (organization_id,shipment_id) REFERENCES shipments(organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id,package_id) REFERENCES packages(organization_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX shipment_packages_single_active_link ON shipment_packages(organization_id,package_id);

CREATE TABLE audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  actor_user_id text,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_tenant_entity_idx ON audit_events(organization_id,entity_type,entity_id,created_at DESC);

-- Defense in depth: deny access through ordinary roles until explicit
-- reviewed policies and server-side authorization are implemented.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipment_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE organization_members FORCE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
ALTER TABLE packages FORCE ROW LEVEL SECURITY;
ALTER TABLE shipments FORCE ROW LEVEL SECURITY;
ALTER TABLE shipment_packages FORCE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
COMMIT;
