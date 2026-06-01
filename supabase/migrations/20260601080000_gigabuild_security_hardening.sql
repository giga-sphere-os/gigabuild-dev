-- GigaBuild security hardening migration
-- Adds fields required by the June 1, 2026 checkout/webhook remediation:
-- - Stripe webhook idempotency tracking
-- - DNS domain ownership verification
-- - hard domain uniqueness for tenant isolation

alter table public.gigabuild_orders
  add column if not exists stripe_event_id text,
  add column if not exists domain_verification_token text;

do $$
begin
  if exists (
    select 1
    from public.gigabuild_orders
    group by domain
    having count(*) > 1
  ) then
    raise exception
      'Cannot create gigabuild_orders_domain_unique_idx: duplicate domains exist in public.gigabuild_orders. Resolve duplicates before rerunning this migration.';
  end if;
end $$;

create unique index if not exists gigabuild_orders_domain_unique_idx
  on public.gigabuild_orders (domain);

create unique index if not exists gigabuild_orders_stripe_event_unique_idx
  on public.gigabuild_orders (stripe_event_id)
  where stripe_event_id is not null;

comment on column public.gigabuild_orders.stripe_event_id is
  'Last processed Stripe webhook event id. Used for checkout.session.completed idempotency.';

comment on column public.gigabuild_orders.domain_verification_token is
  'Expected TXT record value for _gigabuild.<domain> ownership verification before Vercel domain attachment.';
