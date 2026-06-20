-- ─── 003: Tenant invite flow ─────────────────────────────────────────────────
-- Run in Supabase SQL Editor after 002_portal_extensions.sql.
-- Adds invite_token to tenants, expands status check, and creates a
-- security-definer helper so the unauthenticated invite page can read the
-- token-matched row.

-- 1. Invite token column
alter table public.tenants add column if not exists invite_token uuid unique;

-- 2. Allow 'invited' as a tenant status
alter table public.tenants drop constraint if exists tenants_status_check;
alter table public.tenants
  add constraint tenants_status_check
  check (status in ('active', 'late', 'notice', 'past', 'invited'));

-- 3. Security-definer function — lets the invite page (anon) look up a
--    pending invite without any authentication, returning only the fields
--    needed to pre-fill the sign-up form.
create or replace function public.get_tenant_by_invite_token(p_token uuid)
returns table(
  tenant_id   uuid,
  tenant_name text,
  tenant_email text,
  pm_id        uuid,
  company_name text
)
language sql
security definer
stable
set search_path = public
as $$
  select
    t.id          as tenant_id,
    t.name        as tenant_name,
    t.email       as tenant_email,
    t.pm_id,
    coalesce(b.company_name, 'Property Manager') as company_name
  from public.tenants t
  left join public.branding b on b.pm_id = t.pm_id
  where t.invite_token = p_token
    and t.status = 'invited'
  limit 1;
$$;

-- Grant anon + authenticated so the invite page works before login
grant execute on function public.get_tenant_by_invite_token(uuid) to anon, authenticated;

-- 4. Security-definer function to accept an invite.
--    Bypasses RLS so it works even before the session is fully propagated
--    after signUp. Validates the token matches the tenant_id for safety.
create or replace function public.accept_tenant_invite(p_token uuid, p_tenant_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.tenants
  set status = 'active', invite_token = null
  where id = p_tenant_id
    and invite_token = p_token
    and status = 'invited';
$$;

grant execute on function public.accept_tenant_invite(uuid, uuid) to anon, authenticated;
