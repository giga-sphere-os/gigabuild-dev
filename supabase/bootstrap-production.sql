-- GigaBuild first-time production database bootstrap
-- Run once on a fresh Supabase project before deploying live checkout.

create table if not exists public.gigabuild_orders (
  order_id text primary key,
  status text not null default 'checkout_created',
  domain text not null,
  domain_status text,
  customer_name text not null,
  company_name text not null,
  billing text not null check (billing in ('monthly', 'annual')),
  launch_plan text not null,
  catalog_codes jsonb not null default '[]'::jsonb,
  monthly_total integer not null check (monthly_total > 0),
  stripe_session_id text,
  stripe_event_id text,
  stripe_customer_id text,
  stripe_subscription_id text,
  domain_verification_token text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gigabuild_orders_status_idx
  on public.gigabuild_orders (status);

create index if not exists gigabuild_orders_domain_idx
  on public.gigabuild_orders (domain);

create unique index if not exists gigabuild_orders_domain_unique_idx
  on public.gigabuild_orders (domain);

create unique index if not exists gigabuild_orders_stripe_event_unique_idx
  on public.gigabuild_orders (stripe_event_id)
  where stripe_event_id is not null;

alter table public.gigabuild_orders enable row level security;

drop policy if exists "Service role manages GigaBuild orders" on public.gigabuild_orders;
create policy "Service role manages GigaBuild orders"
  on public.gigabuild_orders
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

create table if not exists public.gigasphere_catalog_items (
  code text primary key,
  name text not null,
  family text not null,
  category text not null,
  source_app text,
  status text not null default 'active',
  public boolean not null default true,
  price_monthly integer,
  included_trucks integer,
  additional_truck_monthly integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gigasphere_order_items (
  id bigint generated always as identity primary key,
  order_id text not null references public.gigabuild_orders(order_id) on delete cascade,
  catalog_code text not null references public.gigasphere_catalog_items(code),
  item_name text not null,
  family text not null,
  category text not null,
  quantity integer not null default 1,
  unit_amount integer,
  recurring_interval text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists gigasphere_catalog_items_family_idx
  on public.gigasphere_catalog_items (family);

create index if not exists gigasphere_catalog_items_category_idx
  on public.gigasphere_catalog_items (category);

create index if not exists gigasphere_order_items_order_idx
  on public.gigasphere_order_items (order_id);

create index if not exists gigasphere_order_items_catalog_code_idx
  on public.gigasphere_order_items (catalog_code);

alter table public.gigasphere_catalog_items enable row level security;
alter table public.gigasphere_order_items enable row level security;

drop policy if exists "Public can read active public catalog items" on public.gigasphere_catalog_items;
create policy "Public can read active public catalog items"
  on public.gigasphere_catalog_items
  for select
  using (public = true and status in ('active', 'building', 'planned'));

drop policy if exists "Service role manages catalog items" on public.gigasphere_catalog_items;
create policy "Service role manages catalog items"
  on public.gigasphere_catalog_items
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "Service role manages order items" on public.gigasphere_order_items;
create policy "Service role manages order items"
  on public.gigasphere_order_items
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
