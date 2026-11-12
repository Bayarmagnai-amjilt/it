#!/usr/bin/env bash
# Joins the migration files into one file for the Supabase SQL Editor.
# Run it again whenever a file in migrations/ changes:  bash supabase/build_all_in_one.sh
set -euo pipefail
cd "$(dirname "$0")"
{
  cat <<'HEADER'
-- =============================================================================
-- Tsahim Unaga — complete database setup in one file
--
-- How to use: Supabase Dashboard -> SQL Editor -> New query -> paste this whole
-- file -> Run. Run it ONCE, on a new project. (Demo data: run seed.sql after it.)
--
-- This file is generated from supabase/migrations/*.sql by build_all_in_one.sh.
-- Do not edit it by hand.
-- =============================================================================

HEADER
  for f in migrations/*.sql; do
    echo "-- >>>>>>>>>> $f"
    cat "$f"
    echo
  done
} > all_in_one.sql
echo "all_in_one.sql: $(wc -l < all_in_one.sql) lines"
