#!/usr/bin/env bash
# Runs the database tests on throw-away local PostgreSQL databases.
# Needs: a local PostgreSQL 15+ server and psql. Usage:
#   PSQL="psql -U postgres" supabase/tests/run_local.sh
# It never touches your Supabase project.
#
# Everything runs three times, once for each way a Supabase project can treat
# new tables and functions (see local_stub.sql): the result must be the same.
set -euo pipefail
cd "$(dirname "$0")/.."
PSQL="${PSQL:-psql}"
DB="${TEST_DB:-unaga_test}"

fresh_db() { # name, mode
  $PSQL -q -d postgres -c "drop database if exists $1" -c "create database $1"
  $PSQL -q -v ON_ERROR_STOP=1 -v mode="$2" -d "$1" -f tests/local_stub.sql
  for f in migrations/*.sql; do
    $PSQL -q -v ON_ERROR_STOP=1 -d "$1" -f "$f"
  done
}

for MODE in new legacy strict; do
  echo "=== project type: $MODE ==="
  fresh_db "$DB" "$MODE"
  echo "migrations applied"
  $PSQL -q -v ON_ERROR_STOP=1 -d "$DB" -f tests/phase1a.sql
  # demo data on a second, clean database
  fresh_db "${DB}_seed" "$MODE"
  $PSQL -q -v ON_ERROR_STOP=1 -d "${DB}_seed" -f seed.sql
  $PSQL -q -v ON_ERROR_STOP=1 -d "${DB}_seed" -f tests/seed_check.sql
done

# The teacher's account may be created in Supabase before the SQL is run.
echo "=== accounts that exist before the migrations ==="
$PSQL -q -d postgres -c "drop database if exists ${DB}_pre" -c "create database ${DB}_pre"
$PSQL -q -v ON_ERROR_STOP=1 -v mode=new -d "${DB}_pre" -f tests/local_stub.sql
$PSQL -q -v ON_ERROR_STOP=1 -d "${DB}_pre" -c "insert into auth.users (id, email, created_at) values
  ('00000000-0000-0000-0000-0000000000b2', 'second@example.com', now()),
  ('00000000-0000-0000-0000-0000000000b1', 'first@example.com', now() - interval '1 day')"
for f in migrations/*.sql; do
  $PSQL -q -v ON_ERROR_STOP=1 -d "${DB}_pre" -f "$f"
done
$PSQL -q -v ON_ERROR_STOP=1 -d "${DB}_pre" -f tests/backfill_check.sql

for d in "$DB" "${DB}_seed" "${DB}_pre"; do
  $PSQL -q -d postgres -c "drop database if exists $d"
done
echo "ALL DONE: 3 project types + account backfill"
