-- Migration: 004_company_admin
-- Adds a company_admins table that identifies BMP Central staff users.
-- These users can read all rows across every PM-scoped table (bypassing pm_id filters)
-- via the is_company_admin() security-definer helper.

-- 1. Company admins table
CREATE TABLE IF NOT EXISTS company_admins (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE company_admins ENABLE ROW LEVEL SECURITY;

-- Company admins can read their own row only
CREATE POLICY "self read" ON company_admins
  FOR SELECT USING (user_id = auth.uid());

-- 2. Security-definer helper — avoids RLS recursion in downstream policies
CREATE OR REPLACE FUNCTION is_company_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM company_admins WHERE user_id = auth.uid());
$$;

-- 3. Add read-all-rows policies to each existing table for company admins
CREATE POLICY "company admin read all" ON properties
  FOR SELECT USING (is_company_admin());

CREATE POLICY "company admin read all" ON units
  FOR SELECT USING (is_company_admin());

CREATE POLICY "company admin read all" ON owners
  FOR SELECT USING (is_company_admin());

CREATE POLICY "company admin read all" ON tenants
  FOR SELECT USING (is_company_admin());

CREATE POLICY "company admin read all" ON maintenance_requests
  FOR SELECT USING (is_company_admin());

CREATE POLICY "company admin read all" ON rent_payments
  FOR SELECT USING (is_company_admin());

CREATE POLICY "company admin read all" ON messages
  FOR SELECT USING (is_company_admin());

CREATE POLICY "company admin read all" ON branding
  FOR SELECT USING (is_company_admin());

CREATE POLICY "company admin read all" ON activity_log
  FOR SELECT USING (is_company_admin());

-- profiles: company admin can read all; normal users read their own row only
-- (the existing policy may already cover self-read — this adds company admin access)
CREATE POLICY "company admin read all" ON profiles
  FOR SELECT USING (is_company_admin() OR id = auth.uid());

CREATE POLICY "company admin read all" ON notifications
  FOR SELECT USING (is_company_admin() OR user_id = auth.uid());

-- 4. Seed first company admin.
-- After applying this migration, run in the Supabase dashboard SQL editor:
--   INSERT INTO company_admins (user_id) VALUES ('<your-auth-user-id>');
-- To find your user_id: SELECT id FROM auth.users WHERE email = 'hassan@boothly.co';
