-- =============================================================================
-- Tsahim Unaga — migration 3 of 3: Row Level Security policies (Phase 1)
--
-- Who can reach the tables directly:
--   * anon (not signed in): nothing. There is not a single policy for anon.
--   * students: nothing. They are served by the Next.js server through the
--     functions of migration 2, which scope every answer to the session's student.
--   * teachers (signed in, active): the classes they work with; the owner: all.
--
-- Most writes go through the functions of migration 2. Policies below allow the
-- direct reads the teacher pages make, plus a few simple direct writes.
-- Tables of later phases (quizzes, practice, Scratch, lessons, rewards) have RLS
-- on and no policy yet: they stay closed until their phase adds policies.
-- =============================================================================

-- teachers --------------------------------------------------------------------
create policy teachers_select on teachers for select to authenticated
  using (id = auth.uid() or is_owner());
create policy teachers_owner_update on teachers for update to authenticated
  using (is_owner()) with check (is_owner());

-- school calendar -------------------------------------------------------------
create policy school_years_select on school_years for select to authenticated using (is_teacher());
create policy school_years_owner_write on school_years for all to authenticated
  using (is_owner()) with check (is_owner());

create policy terms_select on terms for select to authenticated using (is_teacher());
create policy terms_owner_write on terms for all to authenticated
  using (is_owner()) with check (is_owner());

-- classes ---------------------------------------------------------------------
-- created through create_class(); settings are edited directly
create policy classes_select on classes for select to authenticated using (teaches_class(id));
create policy classes_update on classes for update to authenticated
  using (teaches_class(id)) with check (teaches_class(id));
create policy classes_owner_delete on classes for delete to authenticated using (is_owner());

create policy class_teachers_select on class_teachers for select to authenticated
  using (teacher_id = auth.uid() or is_owner());
create policy class_teachers_owner_write on class_teachers for all to authenticated
  using (is_owner()) with check (is_owner());

create policy class_schedule_slots_all on class_schedule_slots for all to authenticated
  using (teaches_class(class_id)) with check (teaches_class(class_id));

create policy class_practice_settings_all on class_practice_settings for all to authenticated
  using (teaches_class(class_id)) with check (teaches_class(class_id));

-- students --------------------------------------------------------------------
-- a teacher sees a student through an enrollment in one of their classes
create policy students_select on students for select to authenticated
  using (is_owner() or exists (
    select 1 from enrollments e where e.student_id = students.id and teaches_class(e.class_id)));

create policy enrollments_select on enrollments for select to authenticated
  using (teaches_class(class_id));

create policy teacher_notes_select on teacher_notes for select to authenticated
  using (teacher_id = auth.uid() or is_owner());
create policy teacher_notes_insert on teacher_notes for insert to authenticated
  with check (teacher_id = auth.uid() and exists (
    select 1 from enrollments e where e.student_id = teacher_notes.student_id and teaches_class(e.class_id)));
create policy teacher_notes_delete on teacher_notes for delete to authenticated
  using (teacher_id = auth.uid() or is_owner());

-- lessons, sessions, attendance -------------------------------------------------
create policy lesson_sessions_select on lesson_sessions for select to authenticated
  using (teaches_class(class_id));

create policy student_sessions_select on student_sessions for select to authenticated
  using (teaches_class(class_id));

create policy login_attempts_select on login_attempts for select to authenticated
  using (class_id is not null and teaches_class(class_id));

create policy attendance_select on attendance for select to authenticated
  using (exists (
    select 1 from lesson_sessions ls where ls.id = attendance.lesson_session_id and teaches_class(ls.class_id)));

-- grading ---------------------------------------------------------------------
create policy grade_scale_bands_select on grade_scale_bands for select to authenticated using (is_teacher());
create policy grade_scale_bands_write on grade_scale_bands for all to authenticated
  using ((class_id is null and is_owner()) or (class_id is not null and teaches_class(class_id)))
  with check ((class_id is null and is_owner()) or (class_id is not null and teaches_class(class_id)));

create policy grade_components_select on grade_components for select to authenticated
  using (teaches_class(class_id));

create policy grade_items_select on grade_items for select to authenticated
  using (exists (
    select 1 from grade_components c where c.id = grade_items.component_id and teaches_class(c.class_id)));
create policy grade_items_update on grade_items for update to authenticated
  using (exists (
    select 1 from grade_components c where c.id = grade_items.component_id and teaches_class(c.class_id)))
  with check (exists (
    select 1 from grade_components c where c.id = grade_items.component_id and teaches_class(c.class_id)));

create policy scores_select on scores for select to authenticated
  using (exists (
    select 1 from grade_items gi join grade_components c on c.id = gi.component_id
    where gi.id = scores.grade_item_id and teaches_class(c.class_id)));

create policy term_grade_snapshots_select on term_grade_snapshots for select to authenticated
  using (teaches_class(class_id));

-- shared reference data ---------------------------------------------------------
create policy topics_select on topics for select to authenticated using (is_teacher());
create policy topics_write on topics for all to authenticated
  using (is_teacher()) with check (is_teacher());

create policy app_settings_select on app_settings for select to authenticated using (is_teacher());
create policy app_settings_owner_write on app_settings for all to authenticated
  using (is_owner()) with check (is_owner());

-- audit trail: the owner reads everything, a teacher their own edits ---------------
create policy audit_log_select on audit_log for select to authenticated
  using (is_owner() or actor_id = auth.uid());

-- =============================================================================
-- Table privileges
--
-- A policy only filters rows; the role also needs the plain right to touch the
-- table. Supabase projects created before 30 May 2026 hand that right out for
-- every new table, newer projects for none. Both are replaced by an exact list:
--   anon (not signed in) ........ no table
--   authenticated (teacher) ..... only the tables that have a policy above
--   service_role (server key) ... all tables
-- Tables of later phases therefore stay closed twice: no right and no policy.
-- =============================================================================
do $$
declare
  r record;
begin
  execute 'grant usage on schema public to anon, authenticated, service_role';
  execute 'revoke all on all tables in schema public from anon, authenticated';
  execute 'revoke all on all sequences in schema public from anon, authenticated';
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and exists (select 1 from pg_policy p where p.polrelid = c.oid)
  loop
    execute format('grant select, insert, update, delete on table public.%I to authenticated', r.relname);
  end loop;
  execute 'grant all on all tables in schema public to service_role';
  execute 'grant usage, select on all sequences in schema public to service_role';
end $$;

