-- ─── 002: Portal extensions for the existing pm_id-scoped schema ──────────────
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/bncjcvvqmrenlfwrmozw/sql/new
--
-- The core tables (properties/units/owners/tenants/maintenance_requests/
-- rent_payments/messages) already exist — see 001_existing_schema_reference.sql.
-- This migration only ADDS what the portal needs. Safe to re-run.

-- ─── 1. profiles — user metadata for all portal logins ───────────────────────

create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  role text not null default 'tenant' check (role in ('tenant', 'owner', 'admin')),
  full_name text not null default '',
  email text not null default '',
  phone text,
  avatar_url text,
  title text,
  company text,
  bio text,
  notification_preferences jsonb,
  user_preferences jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'tenant'),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.email, '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for users who signed up before this table existed
insert into public.profiles (id, role, full_name, email)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'role', 'tenant'),
  coalesce(u.raw_user_meta_data->>'full_name', ''),
  coalesce(u.email, '')
from auth.users u
on conflict (id) do nothing;

-- ─── 2. documents — file records backing the Documents panel ─────────────────

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'Document',
  storage_path text,
  size_bytes int,
  property_id uuid references public.properties(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ─── 3. activity_log — dashboard activity feed ────────────────────────────────

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references auth.users(id) on delete set null,
  type text not null check (type in ('payment', 'ticket', 'tenant', 'announcement', 'lease')),
  text text not null,
  created_at timestamptz not null default now()
);

-- ─── 4. properties — financial columns used by the Add Property flow ─────────

alter table public.properties add column if not exists mortgage_payment numeric;
alter table public.properties add column if not exists insurance_monthly numeric;
alter table public.properties add column if not exists tax_monthly numeric;

-- ─── 4b. tenants — fix status check constraint to match portal values ─────────
-- The portal uses 'current' | 'late' | 'notice' | 'former'. If the DB was
-- created with different allowed values (e.g. 'active'/'inactive'), this
-- drops and recreates the constraint with the correct set.

alter table public.tenants drop constraint if exists tenants_status_check;
alter table public.tenants add constraint tenants_status_check
  check (status in ('current', 'late', 'notice', 'former'));

-- ─── 5. units — add pm_id to allow a direct ownership check ─────────────────
-- Without pm_id on units, the units_pm policy must join to properties, and
-- properties_tenant_read joins back to units → infinite recursion. Storing
-- pm_id directly on units makes both policies a simple column comparison.

alter table public.units add column if not exists pm_id uuid references auth.users(id);

-- Backfill pm_id from the parent property for any existing rows
update public.units u
set pm_id = p.pm_id
from public.properties p
where p.id = u.property_id and u.pm_id is null;

-- ─── 6. Row Level Security ────────────────────────────────────────────────────
-- PM sees rows scoped by pm_id; a tenant matches their row by auth uid, or by
-- email when the PM created the tenant record before the tenant signed up.

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.owners enable row level security;
alter table public.tenants enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.rent_payments enable row level security;
alter table public.messages enable row level security;
alter table public.documents enable row level security;
alter table public.activity_log enable row level security;

-- Profiles: each user manages their own row
drop policy if exists "profiles_own" on public.profiles;
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

-- Tenants
drop policy if exists "tenants_pm" on public.tenants;
create policy "tenants_pm" on public.tenants
  for all using (pm_id = auth.uid()) with check (pm_id = auth.uid());

drop policy if exists "tenants_self_read" on public.tenants;
create policy "tenants_self_read" on public.tenants
  for select using (
    id = auth.uid() or lower(email) = lower(auth.jwt()->>'email')
  );

-- Properties
drop policy if exists "properties_pm" on public.properties;
create policy "properties_pm" on public.properties
  for all using (pm_id = auth.uid()) with check (pm_id = auth.uid());

drop policy if exists "properties_tenant_read" on public.properties;
create policy "properties_tenant_read" on public.properties
  for select using (
    exists (
      select 1 from public.tenants t
      join public.units u on u.id = t.unit_id
      where u.property_id = properties.id
        and (t.id = auth.uid() or lower(t.email) = lower(auth.jwt()->>'email'))
    )
  );

-- Units — pm_id is directly on the row, so no join to properties needed
drop policy if exists "units_pm" on public.units;
create policy "units_pm" on public.units
  for all using (pm_id = auth.uid()) with check (pm_id = auth.uid());

drop policy if exists "units_tenant_read" on public.units;
create policy "units_tenant_read" on public.units
  for select using (
    exists (
      select 1 from public.tenants t
      where t.unit_id = units.id
        and (t.id = auth.uid() or lower(t.email) = lower(auth.jwt()->>'email'))
    )
  );

-- Owners
drop policy if exists "owners_pm" on public.owners;
create policy "owners_pm" on public.owners
  for all using (pm_id = auth.uid()) with check (pm_id = auth.uid());

-- Maintenance requests
drop policy if exists "maintenance_pm" on public.maintenance_requests;
create policy "maintenance_pm" on public.maintenance_requests
  for all using (pm_id = auth.uid()) with check (pm_id = auth.uid());

drop policy if exists "maintenance_tenant_read" on public.maintenance_requests;
create policy "maintenance_tenant_read" on public.maintenance_requests
  for select using (
    exists (
      select 1 from public.tenants t
      where t.id = maintenance_requests.tenant_id
        and (t.id = auth.uid() or lower(t.email) = lower(auth.jwt()->>'email'))
    )
  );

drop policy if exists "maintenance_tenant_insert" on public.maintenance_requests;
create policy "maintenance_tenant_insert" on public.maintenance_requests
  for insert with check (
    exists (
      select 1 from public.tenants t
      where t.id = maintenance_requests.tenant_id
        and (t.id = auth.uid() or lower(t.email) = lower(auth.jwt()->>'email'))
    )
  );

-- Rent payments
drop policy if exists "rent_pm" on public.rent_payments;
create policy "rent_pm" on public.rent_payments
  for all using (pm_id = auth.uid()) with check (pm_id = auth.uid());

drop policy if exists "rent_tenant_read" on public.rent_payments;
create policy "rent_tenant_read" on public.rent_payments
  for select using (
    exists (
      select 1 from public.tenants t
      where t.id = rent_payments.tenant_id
        and (t.id = auth.uid() or lower(t.email) = lower(auth.jwt()->>'email'))
    )
  );

drop policy if exists "rent_tenant_insert" on public.rent_payments;
create policy "rent_tenant_insert" on public.rent_payments
  for insert with check (
    exists (
      select 1 from public.tenants t
      where t.id = rent_payments.tenant_id
        and (t.id = auth.uid() or lower(t.email) = lower(auth.jwt()->>'email'))
    )
  );

-- Messages (tenant needs select + insert + the read-flag update)
drop policy if exists "messages_pm" on public.messages;
create policy "messages_pm" on public.messages
  for all using (pm_id = auth.uid()) with check (pm_id = auth.uid());

drop policy if exists "messages_tenant" on public.messages;
create policy "messages_tenant" on public.messages
  for all using (
    exists (
      select 1 from public.tenants t
      where t.id = messages.tenant_id
        and (t.id = auth.uid() or lower(t.email) = lower(auth.jwt()->>'email'))
    )
  ) with check (
    exists (
      select 1 from public.tenants t
      where t.id = messages.tenant_id
        and (t.id = auth.uid() or lower(t.email) = lower(auth.jwt()->>'email'))
    )
  );

-- Documents
drop policy if exists "documents_pm" on public.documents;
create policy "documents_pm" on public.documents
  for all using (uploaded_by = auth.uid()) with check (uploaded_by = auth.uid());

drop policy if exists "documents_tenant_read" on public.documents;
create policy "documents_tenant_read" on public.documents
  for select using (
    exists (
      select 1 from public.tenants t
      where t.id = documents.tenant_id
        and (t.id = auth.uid() or lower(t.email) = lower(auth.jwt()->>'email'))
    )
  );

-- Activity log: each admin sees their own feed
drop policy if exists "activity_own" on public.activity_log;
create policy "activity_own" on public.activity_log
  for all using (admin_id = auth.uid()) with check (admin_id = auth.uid());

-- ─── 7. Storage buckets ───────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do nothing;

drop policy if exists "avatars_insert" on storage.objects;
create policy "avatars_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'avatars');

drop policy if exists "avatars_select" on storage.objects;
create policy "avatars_select" on storage.objects
  for select to authenticated using (bucket_id = 'avatars');

drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update" on storage.objects
  for update to authenticated using (bucket_id = 'avatars');

drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'avatars');

drop policy if exists "documents_insert" on storage.objects;
create policy "documents_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'documents');

drop policy if exists "documents_select" on storage.objects;
create policy "documents_select" on storage.objects
  for select to authenticated using (bucket_id = 'documents');

drop policy if exists "documents_update" on storage.objects;
create policy "documents_update" on storage.objects
  for update to authenticated using (bucket_id = 'documents');

drop policy if exists "documents_delete" on storage.objects;
create policy "documents_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'documents');
