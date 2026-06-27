-- Migration: 005_bmp_clients
-- BMP Central's own CRM + billing tables.
-- These are internal BMP Central records (your clients, your invoices).
-- They live in the same Supabase project but are completely separate from
-- the portal's tenant/property data.

-- 1. BMP Central clients (the property managers you sell portals to)
CREATE TABLE IF NOT EXISTS bmp_clients (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  email            text NOT NULL,
  phone            text,
  company_name     text NOT NULL,
  plan             text NOT NULL DEFAULT 'basic',
  monthly_fee      numeric NOT NULL DEFAULT 99,
  portal_pm_id     uuid REFERENCES auth.users ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'pending',
  -- status values: pending | active | overdue | suspended | canceled
  notes            text,
  created_at       timestamptz DEFAULT now()
);

ALTER TABLE bmp_clients ENABLE ROW LEVEL SECURITY;

-- Only company admins can read/write client records
CREATE POLICY "company admins only" ON bmp_clients
  FOR ALL USING (is_company_admin());

-- 2. Invoices BMP Central sends to its clients
CREATE TABLE IF NOT EXISTS bmp_invoices (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id               uuid NOT NULL REFERENCES bmp_clients ON DELETE CASCADE,
  amount                  numeric NOT NULL,
  due_date                date NOT NULL,
  paid_date               date,
  status                  text NOT NULL DEFAULT 'pending',
  -- status values: pending | paid | overdue | void
  stripe_payment_link     text,
  stripe_payment_link_id  text,
  notes                   text,
  created_at              timestamptz DEFAULT now()
);

ALTER TABLE bmp_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company admins only" ON bmp_invoices
  FOR ALL USING (is_company_admin());

-- Index for fast lookups by client
CREATE INDEX bmp_invoices_client_id_idx ON bmp_invoices (client_id);
