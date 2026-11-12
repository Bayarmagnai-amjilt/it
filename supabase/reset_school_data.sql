-- =============================================================================
-- Tsahim Unaga — start over with an empty school
--
--   !!  DELETES every class, student, lesson, attendance mark, score, timetable,
--   !!  topic and the school year with its terms. This cannot be undone.
--
-- Use it once, after trying the system with the demo data (seed.sql) and before
-- entering your real classes. Download a backup first if in doubt:
-- teacher site -> "Тайлан ба Excel" -> "Нөөц хуулбар татах".
--
-- Kept: teacher accounts, letter bands, the lesson length setting.
-- =============================================================================
begin;

delete from students;       -- with their enrollments, logins, attendance, scores, notes
delete from classes;        -- with their lessons, timetable, grading setup
delete from terms;
delete from school_years;
delete from topics;
delete from login_attempts;
delete from audit_log;      -- the history of the deleted demo marks

do $$
begin
  if exists (select 1 from students) or exists (select 1 from classes) or exists (select 1 from enrollments)
     or exists (select 1 from lesson_sessions) or exists (select 1 from attendance) or exists (select 1 from scores)
     or exists (select 1 from grade_components) or exists (select 1 from school_years) then
    raise exception 'Something was left behind; nothing has been deleted.';
  end if;
  raise notice 'The school is empty. Teachers kept: %, letter bands kept: %.',
    (select count(*) from teachers), (select count(*) from grade_scale_bands);
end $$;

commit;
