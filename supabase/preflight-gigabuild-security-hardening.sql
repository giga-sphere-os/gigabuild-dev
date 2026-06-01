-- Run before 20260601080000_gigabuild_security_hardening.sql.
-- This should return zero rows. Any returned domain must be resolved before
-- the unique domain index can be applied.

select
  domain,
  count(*) as order_count,
  array_agg(order_id order by created_at) as order_ids
from public.gigabuild_orders
group by domain
having count(*) > 1
order by order_count desc, domain;
