-- BMP Central — run this in your Supabase SQL editor

-- OWNERS
create table if not exists public.owners (
  id uuid primary key default gen_random_uuid(),
  pm_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz default now()
);

-- PROPERTIES
create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  pm_id uuid references auth.users(id) on delete cascade not null,
  owner_id uuid references public.owners(id) on delete set null,
  name text not null,
  address text,
  city text,
  state text,
  zip text,
  created_at timestamptz default now()
);

-- UNITS
create table if not exists public.units (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade not null,
  unit_number text not null,
  bedrooms int default 1,
  bathrooms numeric default 1,
  sqft int,
  rent_amount numeric default 0,
  status text default 'occupied' check (status in ('occupied','vacant','maintenance')),
  created_at timestamptz default now()
);

-- TENANTS
create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  pm_id uuid references auth.users(id) on delete cascade not null,
  unit_id uuid references public.units(id) on delete set null,
  name text not null,
  email text,
  phone text,
  lease_start date,
  lease_end date,
  monthly_rent numeric default 0,
  status text default 'active' check (status in ('active','late','notice','past')),
  notes text,
  created_at timestamptz default now()
);

-- MAINTENANCE REQUESTS
create table if not exists public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  pm_id uuid references auth.users(id) on delete cascade not null,
  tenant_id uuid references public.tenants(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  title text not null,
  description text,
  priority text default 'medium' check (priority in ('low','medium','high','urgent')),
  status text default 'open' check (status in ('open','in_progress','resolved')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- MESSAGES
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  pm_id uuid references auth.users(id) on delete cascade not null,
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  sender text not null check (sender in ('pm','tenant')),
  body text not null,
  read boolean default false,
  created_at timestamptz default now()
);

-- RENT PAYMENTS
create table if not exists public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  pm_id uuid references auth.users(id) on delete cascade not null,
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  amount numeric not null,
  due_date date not null,
  paid_date date,
  status text default 'pending' check (status in ('pending','paid','late','partial')),
  note text,
  created_at timestamptz default now()
);

-- ROW LEVEL SECURITY
alter table public.owners enable row level security;
alter table public.properties enable row level security;
alter table public.units enable row level security;
alter table public.tenants enable row level security;
alter table public.maintenance_requests enable row level security;
alter table public.messages enable row level security;
alter table public.rent_payments enable row level security;

create policy "own_owners" on public.owners for all using (pm_id = auth.uid()) with check (pm_id = auth.uid());
create policy "own_properties" on public.properties for all using (pm_id = auth.uid()) with check (pm_id = auth.uid());
create policy "own_units" on public.units for all using (
  property_id in (select id from public.properties where pm_id = auth.uid())
);
create policy "own_tenants" on public.tenants for all using (pm_id = auth.uid()) with check (pm_id = auth.uid());
create policy "own_maintenance" on public.maintenance_requests for all using (pm_id = auth.uid()) with check (pm_id = auth.uid());
create policy "own_messages" on public.messages for all using (pm_id = auth.uid()) with check (pm_id = auth.uid());
create policy "own_rent_payments" on public.rent_payments for all using (pm_id = auth.uid()) with check (pm_id = auth.uid());
