-- Stand-in for the parts of Supabase the migrations rely on, so the SQL tests can
-- run on a plain local PostgreSQL. NEVER run this file on a Supabase project.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
create function auth.uid() returns uuid language sql stable as
$$ select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;

grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- How a project treats NEW tables and functions depends on when it was created.
-- The migrations must give the same result on all of them, so the tests run on
-- three variants (psql -v mode=...):
--   new     projects since 30 May 2026: no automatic table rights (default here)
--   legacy  older projects: every new table and function is open to the API roles
--   strict  like "new", and functions are not even executable by PUBLIC
\if :{?mode}
\else
  \set mode new
\endif
select :'mode' = 'legacy' as is_legacy, :'mode' = 'strict' as is_strict \gset
\if :is_legacy
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
\endif
\if :is_strict
  alter default privileges revoke execute on functions from public;
\endif
