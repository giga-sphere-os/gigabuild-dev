#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MIGRATION_FILE="$ROOT_DIR/supabase/migrations/20260601080000_gigabuild_security_hardening.sql"

DB_URL="${SUPABASE_DB_URL:-${DATABASE_URL:-}}"

if [[ -z "$DB_URL" ]]; then
  echo "Missing SUPABASE_DB_URL or DATABASE_URL."
  echo "Set it to the production Supabase Postgres connection string, then rerun this script."
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required to apply this migration."
  exit 1
fi

duplicate_count="$(
  psql "$DB_URL" -v ON_ERROR_STOP=1 -tAc "
    select count(*)
    from (
      select domain
      from public.gigabuild_orders
      group by domain
      having count(*) > 1
    ) duplicate_domains;
  "
)"

if [[ "$duplicate_count" != "0" ]]; then
  echo "Blocked: found $duplicate_count duplicate domain group(s) in public.gigabuild_orders."
  echo "Run supabase/preflight-gigabuild-security-hardening.sql to list and resolve them before migrating."
  exit 1
fi

psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_FILE"

echo "Applied GigaBuild production security hardening migration."
