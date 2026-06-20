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

-- ─── 3b. notifications — in-app notification center ──────────────────────────

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,  -- recipient
  type text not null default 'system'
    check (type in ('maintenance', 'payment', 'lease', 'message', 'system', 'announcement')),
  title text not null,
  body text not null default '',
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ─── 3c. branding — per-PM white-label (company name, logo, accent color) ─────

create table if not exists public.branding (
  pm_id uuid primary key references auth.users(id) on delete cascade,
  company_name text not null default 'BMP Central',
  tagline text,
  logo_url text,
  primary_color text not null default '#2563EB',
  updated_at timestamptz not null default now()
);

-- ─── 4. properties — financial columns used by the Add Property flow ─────────

alter table public.properties add column if not exists mortgage_payment numeric;
alter table public.properties add column if not exists insurance_monthly numeric;
alter table public.properties add column if not exists tax_monthly numeric;

-- Note: tenants_status_check already exists in the DB with the correct values:
-- ('active', 'late', 'notice', 'past') — no change needed.

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
alter table public.notifications enable row level security;
alter table public.branding enable row level security;

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

-- ─── Helper functions (security definer) to break RLS cross-table cycles ─────
-- Querying units inside a properties policy (and vice-versa) triggers the
-- other table's RLS policies → infinite recursion. Running the look-ups inside
-- security definer functions bypasses RLS on the inner queries, breaking the
-- cycle without weakening any access controls.

-- ─── Helper functions (security definer) to break RLS cross-table cycles ─────
-- Must return boolean so they can be used as scalar predicates in USING().

create or replace function public.tenant_can_read_property(prop_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.tenants t
    join public.units u on u.id = t.unit_id
    where u.property_id = prop_id
      and (t.id = auth.uid() or lower(t.email) = lower(auth.jwt()->>'email'))
  )
$$;

create or replace function public.tenant_can_read_unit(unit_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.tenants t
    where t.unit_id = unit_id
      and (t.id = auth.uid() or lower(t.email) = lower(auth.jwt()->>'email'))
  )
$$;

-- Properties
drop policy if exists "properties_pm" on public.properties;
create policy "properties_pm" on public.properties
  for all using (pm_id = auth.uid()) with check (pm_id = auth.uid());

drop policy if exists "properties_tenant_read" on public.properties;
create policy "properties_tenant_read" on public.properties
  for select using (public.tenant_can_read_property(id));

-- Units — pm_id is directly on the row, so no join to properties needed
drop policy if exists "units_pm" on public.units;
create policy "units_pm" on public.units
  for all using (pm_id = auth.uid()) with check (pm_id = auth.uid());

drop policy if exists "units_tenant_read" on public.units;
create policy "units_tenant_read" on public.units
  for select using (public.tenant_can_read_unit(id));

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

-- Notifications: a recipient reads/updates/deletes their own rows. Creating a
-- notification is restricted to a genuine PM↔tenant relationship (in either
-- direction) plus self-notify — so a user cannot spam arbitrary recipients.
drop policy if exists "notifications_own" on public.notifications;
create policy "notifications_own" on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own" on public.notifications
  for delete using (user_id = auth.uid());

-- security definer so the relationship lookup bypasses tenants' own RLS
-- (a tenant cannot read the PM's other tenant rows, but the check still needs to).
create or replace function public.can_notify(recipient uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    -- self
    recipient = auth.uid()
    -- I am the PM; recipient is one of my tenants
    or exists (
      select 1 from public.tenants t
      where t.pm_id = auth.uid() and t.id = recipient
    )
    -- I am a tenant; recipient is my PM
    or exists (
      select 1 from public.tenants t
      where (t.id = auth.uid() or lower(t.email) = lower(auth.jwt()->>'email'))
        and t.pm_id = recipient
    )
$$;

drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert" on public.notifications
  for insert with check (auth.uid() is not null and public.can_notify(user_id));

-- Branding: the owning PM manages their own row; brand is public-readable
-- (non-sensitive — it must render on the logged-out login screen and for every
-- tenant/owner viewing their PM's brand).
drop policy if exists "branding_read" on public.branding;
create policy "branding_read" on public.branding
  for select using (true);

drop policy if exists "branding_write" on public.branding;
create policy "branding_write" on public.branding
  for all using (pm_id = auth.uid()) with check (pm_id = auth.uid());

-- ─── 7. Storage buckets ───────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('documents', 'documents', false)
  on conflict (id) do nothing;

-- All uploads are written under a `${auth.uid()}/…` path prefix (see the portal
-- upload helpers), so write access is scoped to the owner's own folder.

-- Avatars: public bucket, so SELECT stays open (non-sensitive, served via
-- public URL). Writes are restricted to the user's own folder.
drop policy if exists "avatars_insert" on storage.objects;
create policy "avatars_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_select" on storage.objects;
create policy "avatars_select" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars_update" on storage.objects;
create policy "avatars_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars_delete" on storage.objects;
create policy "avatars_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Documents: PRIVATE bucket. A user may read an object only if they own the
-- folder (the uploading PM) OR a row in public.documents points at this object
-- and that row is visible to them under documents' own RLS (the assigned
-- tenant). Writes are restricted to the user's own folder.
drop policy if exists "documents_insert" on storage.objects;
create policy "documents_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "documents_select" on storage.objects;
create policy "documents_select" on storage.objects
  for select to authenticated using (
    bucket_id = 'documents' and (
      (storage.foldername(name))[1] = auth.uid()::text
      or exists (select 1 from public.documents d where d.storage_path = name)
    )
  );

drop policy if exists "documents_update" on storage.objects;
create policy "documents_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "documents_delete" on storage.objects;
create policy "documents_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- Branding logos are public (rendered on the logged-out login screen too)
insert into storage.buckets (id, name, public)
  values ('branding', 'branding', true)
  on conflict (id) do nothing;

-- Branding: public bucket (logos render on the logged-out login screen), so
-- SELECT stays open. Writes are restricted to the PM's own folder.
drop policy if exists "branding_insert" on storage.objects;
create policy "branding_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'branding' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "branding_select" on storage.objects;
create policy "branding_select" on storage.objects
  for select using (bucket_id = 'branding');

drop policy if exists "branding_update" on storage.objects;
create policy "branding_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'branding' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "branding_delete" on storage.objects;
create policy "branding_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'branding' and (storage.foldername(name))[1] = auth.uid()::text);

-- Message attachments: public bucket so images render inline without auth.
-- Authenticated users can upload; anyone can read.
insert into storage.buckets (id, name, public)
  values ('message-attachments', 'message-attachments', true)
  on conflict (id) do nothing;

drop policy if exists "msg_attach_insert" on storage.objects;
create policy "msg_attach_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'message-attachments');

drop policy if exists "msg_attach_select" on storage.objects;
create policy "msg_attach_select" on storage.objects
  for select using (bucket_id = 'message-attachments');

drop policy if exists "msg_attach_delete" on storage.objects;
create policy "msg_attach_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'message-attachments' and (storage.foldername(name))[1] = auth.uid()::text);
