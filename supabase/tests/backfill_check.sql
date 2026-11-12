-- Accounts that existed BEFORE the migrations were run (see run_local.sh):
-- the oldest must have become the owner, the newer one an inactive teacher.
\set ON_ERROR_STOP on
do $$
begin
  if (select count(*) from teachers) <> 2 then
    raise exception 'FAILED: expected 2 teacher rows, found %', (select count(*) from teachers);
  end if;
  if not exists (select 1 from teachers where email = 'first@example.com' and role = 'owner' and is_active and full_name = 'first') then
    raise exception 'FAILED: the oldest account is not the active owner';
  end if;
  if not exists (select 1 from teachers where email = 'second@example.com' and role = 'teacher' and not is_active) then
    raise exception 'FAILED: the newer account is not an inactive teacher';
  end if;
  -- an account created afterwards goes through the trigger
  insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b3', 'third@example.com');
  if not exists (select 1 from teachers where email = 'third@example.com' and role = 'teacher' and not is_active) then
    raise exception 'FAILED: an account created later is not an inactive teacher';
  end if;
  raise notice 'ok   accounts created before the migrations: oldest = owner, others inactive';
end $$;
\echo 'BACKFILL CHECK PASSED'
