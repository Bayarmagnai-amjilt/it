-- =============================================================================
-- Tsahim Unaga — migration 4: numbered sections, class logos, deleting a class
--
-- Safe to run more than once.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Numbered sections
-- ----------------------------------------------------------------------------
-- Sections are picked as numbers now: grade 1, section 2 is called '1-2'.
-- Classes made earlier with a letter section keep their old name ('4Б').
alter table classes alter column name set expression as (
  grade::text || case when section ~ '^[0-9]+$' then '-' else '' end || section
);

-- ----------------------------------------------------------------------------
-- 2. Class logos
-- ----------------------------------------------------------------------------
-- The column keeps its old name. Only an uploaded picture counts as a logo now;
-- the animal keys stored earlier ('foal' ...) are simply ignored by the app.
comment on column classes.animal_icon is
  'Class logo: the public URL of a picture in the class-logos bucket. Any other value (such as an old animal key) means no logo.';

-- Public bucket: the start page shows logos to students who are not signed in.
-- Files live at '<class id>/<name>'.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('class-logos', 'class-logos', true, 2097152,
        array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- The class a logo file belongs to: the first folder of its path, or null.
create or replace function logo_class_id(p_name text) returns uuid
language sql immutable set search_path = public as $$
  select case when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p_name, '/', 1)::uuid end
$$;

-- A teacher uploads, lists and removes the logos of the classes they work with.
drop policy if exists class_logos_select on storage.objects;
drop policy if exists class_logos_insert on storage.objects;
drop policy if exists class_logos_update on storage.objects;
drop policy if exists class_logos_delete on storage.objects;
create policy class_logos_select on storage.objects for select to authenticated
  using (bucket_id = 'class-logos' and public.logo_class_id(name) is not null and public.teaches_class(public.logo_class_id(name)));
create policy class_logos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'class-logos' and public.logo_class_id(name) is not null and public.teaches_class(public.logo_class_id(name)));
create policy class_logos_update on storage.objects for update to authenticated
  using (bucket_id = 'class-logos' and public.logo_class_id(name) is not null and public.teaches_class(public.logo_class_id(name)))
  with check (bucket_id = 'class-logos' and public.logo_class_id(name) is not null and public.teaches_class(public.logo_class_id(name)));
create policy class_logos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'class-logos' and public.logo_class_id(name) is not null and public.teaches_class(public.logo_class_id(name)));

-- ----------------------------------------------------------------------------
-- 3. Deleting a class
-- ----------------------------------------------------------------------------
-- Removes the class with its lessons, attendance, grading and timetable.
-- Students who were never in another class are deleted with it. Students who
-- came from another class keep that history; if this class was their current
-- one, they end up like a student removed from the list.
-- The app deletes the logo files first (Storage files cannot be removed in SQL).
create or replace function delete_class(p_class_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform assert_teaches(p_class_id);
  delete from students s
   where exists (select 1 from enrollments e where e.student_id = s.id and e.class_id = p_class_id)
     and not exists (select 1 from enrollments e where e.student_id = s.id and e.class_id <> p_class_id);
  update students s set status = 'transferred'
   where exists (select 1 from enrollments e
                 where e.student_id = s.id and e.class_id = p_class_id and e.ended_on is null);
  delete from enrollments where class_id = p_class_id;
  delete from classes where id = p_class_id;
end $$;

-- Same rule as migration 2: closed first, then opened by name.
revoke all on function logo_class_id(text) from public, anon;
revoke all on function delete_class(uuid) from public, anon;
grant execute on function logo_class_id(text) to authenticated, service_role;
grant execute on function delete_class(uuid) to authenticated, service_role;
