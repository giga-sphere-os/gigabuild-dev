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
