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
  stripe_customer_id text,
  stripe_subscription_id text,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists gigabuild_orders_status_idx
  on public.gigabuild_orders (status);

create index if not exists gigabuild_orders_domain_idx
  on public.gigabuild_orders (domain);

alter table public.gigabuild_orders enable row level security;

drop policy if exists "Service role manages GigaBuild orders" on public.gigabuild_orders;
create policy "Service role manages GigaBuild orders"
  on public.gigabuild_orders
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
