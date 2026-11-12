-- =============================================================================
-- Tsahim Unaga — migration 2 of 3: default data and server functions
--
-- Three kinds of functions live here:
--   1. helpers used by RLS policies (is_teacher, is_owner, teaches_class)
--   2. teacher functions: called with the signed-in teacher's own session;
--      each one checks that the teacher works with the class it touches
--   3. student / login functions: callable ONLY with the server's secret key.
--      Students never talk to the database directly. The Next.js server calls
--      these with the student's session id, and every function derives the
--      student from that session, so one student can never reach another's rows.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Default data
-- ----------------------------------------------------------------------------
insert into grade_scale_bands (class_id, min_percent, letter, teacher_label, stars, student_message) values
  (null, 90, 'A', 'Онц',        5, 'Гайхалтай!'),
  (null, 80, 'B', 'Сайн',       4, 'Маш сайн!'),
  (null, 70, 'C', 'Дунд',       3, 'Сайн байна!'),
  (null, 60, 'D', 'Хангалттай', 2, 'Чадна шүү!'),
  (null,  0, 'F', 'Хангалтгүй', 1, 'Хамтдаа дахин оролдъё!')
on conflict do nothing;

insert into app_settings (key, value) values
  ('lesson_minutes', '40'::jsonb),
  ('at_risk', '{"below_percent": 60, "consecutive_absences": 2}'::jsonb),
  ('item_analysis', '{"too_hard_below": 30, "too_easy_above": 95}'::jsonb)
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 1. Helpers
-- ----------------------------------------------------------------------------
-- School day in Mongolia, whatever time zone the database server runs in.
create or replace function local_today() returns date
language sql stable set search_path = public as
$$ select (now() at time zone 'Asia/Ulaanbaatar')::date $$;

create or replace function is_teacher() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from teachers where id = auth.uid() and is_active) $$;

create or replace function is_owner() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from teachers where id = auth.uid() and is_active and role = 'owner') $$;

-- The owner works with every class; a teacher only with the classes assigned.
create or replace function teaches_class(p_class_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teachers t
    where t.id = auth.uid() and t.is_active
      and (t.role = 'owner'
           or exists (select 1 from class_teachers ct
                      where ct.class_id = p_class_id and ct.teacher_id = t.id)))
$$;

create or replace function assert_teaches(p_class_id uuid) returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if p_class_id is null or not teaches_class(p_class_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
end $$;

-- Term that contains the day; otherwise the latest term already started;
-- otherwise the nearest upcoming one. Null only when no terms exist.
create or replace function current_term_id(p_on date default null) returns uuid
language sql stable set search_path = public as $$
  select t.id
  from terms t
  join school_years y on y.id = t.school_year_id
  where y.is_current
  order by (coalesce(p_on, local_today()) between t.starts_on and t.ends_on) desc,
           (t.starts_on <= coalesce(p_on, local_today())) desc,
           abs(t.starts_on - coalesce(p_on, local_today()))
  limit 1
$$;

-- The lesson of this class that is open right now (teacher pressed "start"), if any.
create or replace function open_lesson_id(p_class_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select id from lesson_sessions
  where class_id = p_class_id
    and held_on = local_today()
    and opened_at is not null
    and closed_at is null
    and now() < coalesce(ends_at, opened_at + interval '90 minutes')
  order by opened_at desc
  limit 1
$$;

-- Letter band for a percent: class-specific bands when the class has any,
-- otherwise the school defaults. Lower bound decides: 89.5 is B, 90 is A.
create or replace function grade_band(p_class_id uuid, p_percent numeric) returns grade_scale_bands
language sql stable set search_path = public as $$
  select b.*
  from grade_scale_bands b
  where p_percent is not null
    and b.min_percent <= p_percent
    and b.class_id is not distinct from (
      select case when exists (select 1 from grade_scale_bands x where x.class_id = p_class_id)
                  then p_class_id end)
  order by b.min_percent desc
  limit 1
$$;

-- ----------------------------------------------------------------------------
-- First teacher account becomes the owner. Later accounts start inactive, so a
-- stranger who signs up cannot read anything until the owner activates them.
-- ----------------------------------------------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_first boolean;
begin
  perform pg_advisory_xact_lock(hashtext('unaga_first_teacher'));
  select not exists (select 1 from teachers) into v_first;
  insert into teachers (id, full_name, email, role, is_active)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), nullif(split_part(coalesce(new.email, ''), '@', 1), ''), 'Багш'),
    coalesce(new.email, new.id::text || '@no-email.invalid'),
    (case when v_first then 'owner' else 'teacher' end)::teacher_role,
    v_first
  )
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Accounts that were created before this file was run have no teacher row yet.
-- Give them one now, by the same rule: when there is no teacher at all, the
-- oldest account becomes the owner; every other account starts inactive.
insert into teachers (id, full_name, email, role, is_active)
select u.id,
       coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), nullif(split_part(coalesce(u.email, ''), '@', 1), ''), 'Багш'),
       coalesce(u.email, u.id::text || '@no-email.invalid'),
       (case when u.is_first then 'owner' else 'teacher' end)::teacher_role,
       u.is_first
from (
  select a.*,
         row_number() over (order by a.created_at, a.id) = 1 and not exists (select 1 from teachers) as is_first
  from auth.users a
) u
where not exists (select 1 from teachers t where t.id = u.id)
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 2. Teacher functions: classes and students
-- ----------------------------------------------------------------------------
create or replace function create_class(
  p_grade integer, p_section text, p_color text default null, p_animal_icon text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_year uuid;
  v_id uuid;
begin
  if not is_teacher() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select id into v_year from school_years where is_current;
  if v_year is null then
    raise exception 'no_current_school_year' using errcode = 'P0001';
  end if;
  if nullif(trim(p_section), '') is null then
    raise exception 'section_required' using errcode = 'P0001';
  end if;
  insert into classes (school_year_id, grade, section, color, animal_icon)
  values (v_year, p_grade::smallint, upper(trim(p_section)),
          coalesce(nullif(p_color, ''), '#F59E0B'), coalesce(nullif(p_animal_icon, ''), 'foal'))
  returning id into v_id;
  insert into class_teachers (class_id, teacher_id) values (v_id, auth.uid()) on conflict do nothing;
  insert into class_practice_settings (class_id) values (v_id) on conflict do nothing;
  return v_id;
end $$;

-- Classes of the current school year that this teacher works with.
create or replace function my_classes(p_include_archived boolean default false) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if not is_teacher() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'grade', c.grade, 'section', c.section, 'name', c.name,
           'color', c.color, 'animal_icon', c.animal_icon, 'status', c.status,
           'class_code', c.class_code,
           'picture_password_enabled', c.picture_password_enabled,
           'home_practice_enabled', c.home_practice_enabled,
           'open_lesson_id', open_lesson_id(c.id),
           'student_count', (select count(*) from enrollments e join students s on s.id = e.student_id
                             where e.class_id = c.id and e.ended_on is null and s.status = 'active')
         ) order by c.grade, c.section), '[]'::jsonb)
    into v
  from classes c
  join school_years y on y.id = c.school_year_id
  where y.is_current
    and (p_include_archived or c.status = 'active')
    and teaches_class(c.id);
  return v;
end $$;

-- p_students: [{"first_name": "...", "family_initial": "Б", "gender": "male"}]
create or replace function add_students(p_class_id uuid, p_students jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_year uuid;
  r jsonb;
  v_id uuid;
  v_name text;
  n integer := 0;
begin
  perform assert_teaches(p_class_id);
  select school_year_id into v_year from classes where id = p_class_id;
  for r in select * from jsonb_array_elements(coalesce(p_students, '[]'::jsonb)) loop
    v_name := nullif(trim(r ->> 'first_name'), '');
    continue when v_name is null;
    insert into students (first_name, family_initial, gender)
    values (
      v_name,
      nullif(upper(left(trim(coalesce(r ->> 'family_initial', '')), 1)), ''),
      case when r ->> 'gender' in ('male', 'female') then r ->> 'gender' end
    )
    returning id into v_id;
    insert into enrollments (student_id, class_id, school_year_id, started_on)
    values (v_id, p_class_id, v_year, local_today());
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function class_roster(p_class_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  perform assert_teaches(p_class_id);
  select coalesce(jsonb_agg(jsonb_build_object(
           'student_id', s.id, 'first_name', s.first_name, 'family_initial', s.family_initial,
           'gender', s.gender,
           'has_picture_password', s.picture_password_hash is not null,
           'online', exists (select 1 from student_sessions ss
                             where ss.student_id = s.id and ss.ended_at is null and ss.expires_at > now())
         )), '[]'::jsonb)
    into v
  from enrollments e
  join students s on s.id = e.student_id
  where e.class_id = p_class_id and e.ended_on is null and s.status = 'active';
  return v;
end $$;

-- Every active student in the classes this teacher works with.
create or replace function all_students() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if not is_teacher() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
           'student_id', s.id, 'first_name', s.first_name, 'family_initial', s.family_initial,
           'class_id', c.id, 'class_name', c.name, 'grade', c.grade, 'color', c.color
         )), '[]'::jsonb)
    into v
  from enrollments e
  join students s on s.id = e.student_id
  join classes c on c.id = e.class_id
  join school_years y on y.id = c.school_year_id
  where e.ended_on is null and s.status = 'active' and y.is_current and teaches_class(c.id);
  return v;
end $$;

-- Move a student to another class. The old enrollment is closed, not deleted,
-- so attendance and grades from the old class stay attached to the student.
create or replace function transfer_student(p_student_id uuid, p_to_class_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_from uuid;
begin
  select class_id into v_from from enrollments where student_id = p_student_id and ended_on is null;
  if v_from is null then
    raise exception 'student_not_enrolled' using errcode = 'P0001';
  end if;
  perform assert_teaches(v_from);
  perform assert_teaches(p_to_class_id);
  if v_from = p_to_class_id then
    return;
  end if;
  update enrollments
     set ended_on = greatest(local_today(), started_on), end_reason = 'transfer'
   where student_id = p_student_id and ended_on is null;
  insert into enrollments (student_id, class_id, school_year_id, started_on)
  select p_student_id, c.id, c.school_year_id, local_today() from classes c where c.id = p_to_class_id;
  update student_sessions set ended_at = now(), end_reason = 'teacher_kick'
   where student_id = p_student_id and ended_at is null;
end $$;

-- Student left the school: history is kept, the student disappears from lists.
create or replace function remove_student(p_student_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_class uuid;
begin
  select class_id into v_class from enrollments where student_id = p_student_id and ended_on is null;
  if v_class is null then
    raise exception 'student_not_enrolled' using errcode = 'P0001';
  end if;
  perform assert_teaches(v_class);
  update enrollments
     set ended_on = greatest(local_today(), started_on), end_reason = 'left'
   where student_id = p_student_id and ended_on is null;
  update students set status = 'transferred' where id = p_student_id;
  update student_sessions set ended_at = now(), end_reason = 'teacher_kick'
   where student_id = p_student_id and ended_at is null;
end $$;

create or replace function update_student(
  p_student_id uuid, p_first_name text, p_family_initial text, p_gender text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_class uuid;
begin
  select class_id into v_class from enrollments where student_id = p_student_id and ended_on is null;
  perform assert_teaches(v_class);
  if nullif(trim(p_first_name), '') is null then
    raise exception 'name_required' using errcode = 'P0001';
  end if;
  update students
     set first_name = trim(p_first_name),
         family_initial = nullif(upper(left(trim(coalesce(p_family_initial, '')), 1)), ''),
         gender = case when p_gender in ('male', 'female') then p_gender end
   where id = p_student_id;
end $$;

-- Student forgot the picture password: clear it, they choose a new one in class.
create or replace function reset_picture_password(p_student_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_class uuid;
begin
  select class_id into v_class from enrollments where student_id = p_student_id and ended_on is null;
  perform assert_teaches(v_class);
  update students set picture_password_hash = null, picture_password_set_at = null where id = p_student_id;
  delete from login_attempts where student_id = p_student_id and not succeeded;
  update student_sessions set ended_at = now(), end_reason = 'teacher_kick'
   where student_id = p_student_id and ended_at is null;
end $$;

create or replace function student_profile(p_student_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_class uuid;
  v jsonb;
begin
  select class_id into v_class from enrollments where student_id = p_student_id and ended_on is null;
  if v_class is null then
    -- a student who left: only the owner may still open the profile
    if not is_owner() then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
  else
    perform assert_teaches(v_class);
  end if;
  select jsonb_build_object(
    'student', jsonb_build_object(
      'id', s.id, 'first_name', s.first_name, 'family_initial', s.family_initial, 'gender', s.gender,
      'status', s.status, 'has_picture_password', s.picture_password_hash is not null),
    'class', (select jsonb_build_object('id', c.id, 'name', c.name, 'color', c.color, 'animal_icon', c.animal_icon)
              from classes c where c.id = v_class),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object('class_name', c.name, 'started_on', e.started_on,
                                          'ended_on', e.ended_on, 'end_reason', e.end_reason)
                       order by e.started_on)
      from enrollments e join classes c on c.id = e.class_id where e.student_id = s.id), '[]'::jsonb),
    'attendance', (
      select jsonb_build_object(
        'present', count(*) filter (where a.status = 'present'),
        'late', count(*) filter (where a.status = 'late'),
        'absent', count(*) filter (where a.status = 'absent'),
        'excused', count(*) filter (where a.status = 'excused'),
        'sick', count(*) filter (where a.status = 'sick'))
      from attendance a where a.student_id = s.id),
    'recent_attendance', coalesce((
      select jsonb_agg(jsonb_build_object('held_on', x.held_on, 'period', x.period, 'status', x.status, 'note', x.note)
                       order by x.held_on desc, x.period desc)
      from (select ls.held_on, ls.period, a.status, a.note
            from attendance a join lesson_sessions ls on ls.id = a.lesson_session_id
            where a.student_id = s.id order by ls.held_on desc, ls.period desc limit 40) x), '[]'::jsonb),
    'notes', coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'body', n.body, 'created_at', n.created_at,
                                          'teacher', t.full_name) order by n.created_at desc)
      from teacher_notes n join teachers t on t.id = n.teacher_id
      where n.student_id = s.id and (n.teacher_id = auth.uid() or is_owner())), '[]'::jsonb)
  ) into v
  from students s where s.id = p_student_id;
  return v;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Teacher functions: lessons and attendance
-- ----------------------------------------------------------------------------
create or replace function ensure_lesson(p_class_id uuid, p_date date default null, p_period integer default 1)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_date date := coalesce(p_date, local_today());
  v_term uuid;
  v_id uuid;
begin
  perform assert_teaches(p_class_id);
  select id into v_id from lesson_sessions
   where class_id = p_class_id and held_on = v_date and period = p_period;
  if v_id is not null then
    return v_id;
  end if;
  v_term := current_term_id(v_date);
  if v_term is null then
    raise exception 'no_terms' using errcode = 'P0001';
  end if;
  insert into lesson_sessions (class_id, term_id, held_on, period, created_by)
  values (p_class_id, v_term, v_date, p_period::smallint, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- "Start lesson": opens student login for this class until the lesson ends.
create or replace function open_lesson(p_class_id uuid, p_minutes integer default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_minutes integer;
  v_period integer;
begin
  perform assert_teaches(p_class_id);
  v_id := open_lesson_id(p_class_id);
  if v_id is not null then
    return v_id;
  end if;
  v_minutes := coalesce(
    p_minutes,
    (select (value #>> '{}')::integer from app_settings where key = 'lesson_minutes'),
    40);
  -- next period that has not been opened yet today
  select coalesce(max(period), 0) + 1 into v_period
    from lesson_sessions
   where class_id = p_class_id and held_on = local_today() and opened_at is not null;
  v_id := ensure_lesson(p_class_id, local_today(), v_period);
  update lesson_sessions
     set opened_at = now(),
         starts_at = coalesce(starts_at, now()),
         ends_at = now() + make_interval(mins => v_minutes),
         closed_at = null
   where id = v_id;
  return v_id;
end $$;

-- "End lesson": closes login and logs every student of that lesson out.
create or replace function close_lesson(p_class_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  perform assert_teaches(p_class_id);
  update lesson_sessions set closed_at = now()
   where class_id = p_class_id and held_on = local_today() and opened_at is not null and closed_at is null;
  update student_sessions set ended_at = now(), end_reason = 'lesson_end'
   where class_id = p_class_id and ended_at is null and lesson_session_id is not null;
  get diagnostics n = row_count;
  return n;
end $$;

-- "Log all students out" button.
create or replace function kick_all_students(p_class_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  perform assert_teaches(p_class_id);
  update student_sessions set ended_at = now(), end_reason = 'teacher_kick'
   where class_id = p_class_id and ended_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

-- Attendance sheet for one lesson. Works before the lesson row exists: every
-- student then starts as "present" and the teacher only taps the exceptions.
-- When students logged in during the lesson, "suggested" says present or late.
create or replace function attendance_sheet(p_class_id uuid, p_date date default null, p_period integer default 1)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_date date := coalesce(p_date, local_today());
  ls lesson_sessions%rowtype;
  v_late integer;
  v_rows jsonb;
begin
  perform assert_teaches(p_class_id);
  select * into ls from lesson_sessions
   where class_id = p_class_id and held_on = v_date and period = p_period;
  select late_after_minutes into v_late from classes where id = p_class_id;

  select coalesce(jsonb_agg(jsonb_build_object(
           'student_id', s.id, 'first_name', s.first_name, 'family_initial', s.family_initial,
           'status', coalesce(a.status, sug.suggested, 'present'::attendance_status),
           'note', a.note,
           'saved', a.id is not null,
           'logged_in', sug.first_login is not null,
           'suggested', sug.suggested
         )), '[]'::jsonb)
    into v_rows
  from enrollments e
  join students s on s.id = e.student_id
  left join attendance a on a.lesson_session_id = ls.id and a.student_id = s.id
  left join lateral (
    select x.first_login,
           case
             when x.first_login is null then null
             when x.first_login > coalesce(ls.starts_at, ls.opened_at, x.first_login) + make_interval(mins => v_late)
               then 'late'::attendance_status
             else 'present'::attendance_status
           end as suggested
    from (select min(ss.started_at) as first_login
            from student_sessions ss
           where ss.lesson_session_id = ls.id and ss.student_id = s.id) x
  ) sug on true
  where e.class_id = p_class_id
    and e.started_on <= v_date
    and (e.ended_on is null or e.ended_on >= v_date)
    and (s.status = 'active' or a.id is not null);

  return jsonb_build_object(
    'lesson', case when ls.id is null then null else jsonb_build_object(
      'id', ls.id, 'held_on', ls.held_on, 'period', ls.period,
      'opened_at', ls.opened_at, 'closed_at', ls.closed_at) end,
    'date', v_date,
    'period', p_period,
    'any_login', exists (select 1 from student_sessions ss where ss.lesson_session_id = ls.id),
    'rows', v_rows);
end $$;

-- p_rows: [{"student_id": "...", "status": "late", "note": "..."}]
create or replace function save_attendance(p_class_id uuid, p_date date, p_period integer, p_rows jsonb)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_lesson uuid;
begin
  perform assert_teaches(p_class_id);
  if coalesce(p_date, local_today()) > local_today() then
    raise exception 'future_date' using errcode = 'P0001';
  end if;
  v_lesson := ensure_lesson(p_class_id, p_date, p_period);
  insert into attendance (lesson_session_id, student_id, status, note, confirmed_at, updated_by, updated_at)
  select v_lesson, (r ->> 'student_id')::uuid, (r ->> 'status')::attendance_status,
         nullif(trim(coalesce(r ->> 'note', '')), ''), now(), auth.uid(), now()
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  where exists (select 1 from enrollments e
                where e.student_id = (r ->> 'student_id')::uuid and e.class_id = p_class_id)
  on conflict (lesson_session_id, student_id) do update
     set status = excluded.status, note = excluded.note,
         confirmed_at = now(), updated_by = auth.uid(), updated_at = now()
   where attendance.status is distinct from excluded.status
      or attendance.note is distinct from excluded.note;
  return v_lesson;
end $$;

-- Attendance percent of one student in one class and term (prompt section 5):
--   (present + late x coefficient) / counted lessons x 100
-- Excused and sick lessons either count as present or are left out of the total,
-- depending on the class setting. Null when nothing is counted yet.
create or replace function attendance_percent(p_student_id uuid, p_class_id uuid, p_term_id uuid)
returns numeric
language sql stable set search_path = public as $$
  with n as (
    select count(*) filter (where a.status = 'present')            as present_n,
           count(*) filter (where a.status = 'late')               as late_n,
           count(*) filter (where a.status = 'absent')             as absent_n,
           count(*) filter (where a.status in ('excused', 'sick')) as excused_n
    from attendance a
    join lesson_sessions ls on ls.id = a.lesson_session_id
    where a.student_id = p_student_id and ls.class_id = p_class_id and ls.term_id = p_term_id
  )
  select case
           when n.present_n + n.late_n + n.absent_n
                + (case when c.excused_policy = 'count_present' then n.excused_n else 0 end) = 0
             then null
           else round(
             (n.present_n + n.late_n * c.late_coefficient
                + (case when c.excused_policy = 'count_present' then n.excused_n else 0 end))
             / (n.present_n + n.late_n + n.absent_n
                + (case when c.excused_policy = 'count_present' then n.excused_n else 0 end))::numeric
             * 100, 2)
         end
  from n, classes c
  where c.id = p_class_id
$$;

-- ----------------------------------------------------------------------------
-- 2. Teacher functions: grading
-- ----------------------------------------------------------------------------
-- Replace the grading setup of one class and term in one step.
-- p_components: [{"id": "... or null", "name": "...", "weight": 30,
--                 "source": "quiz", "missing_policy": "zero"}]
create or replace function save_grade_components(p_class_id uuid, p_term_id uuid, p_components jsonb)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_total numeric;
  r jsonb;
  i integer := 0;
  v_id uuid;
begin
  perform assert_teaches(p_class_id);
  select coalesce(sum((x ->> 'weight')::numeric), 0) into v_total
    from jsonb_array_elements(coalesce(p_components, '[]'::jsonb)) x;
  if v_total <> 100 then
    raise exception 'weights_must_sum_100' using errcode = 'P0001', detail = v_total::text;
  end if;

  -- a component that already holds scored work may not vanish by accident
  if exists (
    select 1 from grade_components c
    where c.class_id = p_class_id and c.term_id = p_term_id
      and c.id not in (select (x ->> 'id')::uuid
                         from jsonb_array_elements(p_components) x
                        where nullif(x ->> 'id', '') is not null)
      and exists (select 1 from grade_items gi where gi.component_id = c.id)
  ) then
    raise exception 'component_has_items' using errcode = 'P0001';
  end if;

  delete from grade_components c
   where c.class_id = p_class_id and c.term_id = p_term_id
     and c.id not in (select (x ->> 'id')::uuid
                        from jsonb_array_elements(p_components) x
                       where nullif(x ->> 'id', '') is not null);

  for r in select * from jsonb_array_elements(p_components) loop
    i := i + 1;
    v_id := nullif(r ->> 'id', '')::uuid;
    if v_id is not null then
      update grade_components
         set name = trim(r ->> 'name'),
             weight = (r ->> 'weight')::numeric,
             source = coalesce(nullif(r ->> 'source', ''), 'manual')::component_source,
             missing_policy = coalesce(nullif(r ->> 'missing_policy', ''), 'zero')::missing_policy,
             sort_order = i
       where id = v_id and class_id = p_class_id and term_id = p_term_id;
    else
      insert into grade_components (class_id, term_id, name, weight, source, missing_policy, sort_order)
      values (p_class_id, p_term_id, trim(r ->> 'name'), (r ->> 'weight')::numeric,
              coalesce(nullif(r ->> 'source', ''), 'manual')::component_source,
              coalesce(nullif(r ->> 'missing_policy', ''), 'zero')::missing_policy, i);
    end if;
  end loop;
end $$;

-- Copy the grading setup of one class to another (same term). The target must
-- not hold scored work yet.
create or replace function copy_grade_components(p_from_class_id uuid, p_to_class_id uuid, p_term_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  n integer;
begin
  perform assert_teaches(p_from_class_id);
  perform assert_teaches(p_to_class_id);
  if exists (select 1 from grade_components c join grade_items gi on gi.component_id = c.id
              where c.class_id = p_to_class_id and c.term_id = p_term_id) then
    raise exception 'component_has_items' using errcode = 'P0001';
  end if;
  delete from grade_components where class_id = p_to_class_id and term_id = p_term_id;
  insert into grade_components (class_id, term_id, name, weight, source, missing_policy, sort_order)
  select p_to_class_id, p_term_id, name, weight, source, missing_policy, sort_order
    from grade_components where class_id = p_from_class_id and term_id = p_term_id;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function create_grade_item(
  p_component_id uuid, p_title text, p_max_score numeric, p_held_on date default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_class uuid;
  v_id uuid;
begin
  select class_id into v_class from grade_components where id = p_component_id;
  perform assert_teaches(v_class);
  if nullif(trim(p_title), '') is null then
    raise exception 'title_required' using errcode = 'P0001';
  end if;
  insert into grade_items (component_id, title, max_score, held_on)
  values (p_component_id, trim(p_title), p_max_score, coalesce(p_held_on, local_today()))
  returning id into v_id;
  return v_id;
end $$;

create or replace function delete_grade_item(p_grade_item_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_class uuid;
begin
  select c.class_id into v_class
    from grade_items gi join grade_components c on c.id = gi.component_id
   where gi.id = p_grade_item_id;
  perform assert_teaches(v_class);
  delete from grade_items where id = p_grade_item_id;
end $$;

-- Score sheet of one piece of work: every current student with their score.
create or replace function grade_item_sheet(p_grade_item_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_class uuid;
  v jsonb;
begin
  select c.class_id into v_class
    from grade_items gi join grade_components c on c.id = gi.component_id
   where gi.id = p_grade_item_id;
  perform assert_teaches(v_class);
  select jsonb_build_object(
    'item', (select jsonb_build_object('id', gi.id, 'title', gi.title, 'max_score', gi.max_score,
                                       'held_on', gi.held_on, 'component_id', gi.component_id,
                                       'component_name', c.name)
               from grade_items gi join grade_components c on c.id = gi.component_id
              where gi.id = p_grade_item_id),
    'rows', coalesce((
      select jsonb_agg(jsonb_build_object(
               'student_id', s.id, 'first_name', s.first_name, 'family_initial', s.family_initial,
               'score', sc.score, 'is_excused', coalesce(sc.is_excused, false)))
      from enrollments e
      join students s on s.id = e.student_id
      left join scores sc on sc.grade_item_id = p_grade_item_id and sc.student_id = s.id
      where e.class_id = v_class and e.ended_on is null and s.status = 'active'), '[]'::jsonb)
  ) into v;
  return v;
end $$;

-- p_rows: [{"student_id": "...", "score": 8, "is_excused": false}]; score null = not handed in
create or replace function save_scores(p_grade_item_id uuid, p_rows jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_class uuid;
  v_max numeric;
  n integer;
begin
  select c.class_id, gi.max_score into v_class, v_max
    from grade_items gi join grade_components c on c.id = gi.component_id
   where gi.id = p_grade_item_id;
  perform assert_teaches(v_class);
  if exists (select 1 from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
              where nullif(r ->> 'score', '') is not null
                and ((r ->> 'score')::numeric < 0 or (r ->> 'score')::numeric > v_max)) then
    raise exception 'score_out_of_range' using errcode = 'P0001';
  end if;
  insert into scores (grade_item_id, student_id, score, is_excused, entered_by, updated_at)
  select p_grade_item_id, (r ->> 'student_id')::uuid, nullif(r ->> 'score', '')::numeric,
         coalesce((r ->> 'is_excused')::boolean, false), auth.uid(), now()
  from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) r
  where exists (select 1 from enrollments e
                where e.student_id = (r ->> 'student_id')::uuid and e.class_id = v_class)
  on conflict (grade_item_id, student_id) do update
     set score = excluded.score, is_excused = excluded.is_excused,
         entered_by = excluded.entered_by, updated_at = now()
   where scores.score is distinct from excluded.score
      or scores.is_excused is distinct from excluded.is_excused;
  get diagnostics n = row_count;
  return n;
end $$;

-- Final grades of a class for a term (prompt section 6).
--
--   component percent = weighted average of its items (score / max x 100)
--   final percent     = sum(component percent x weight) / sum(weights that have data)
--
-- Improvement over the prompt's plain formula: a component with no data yet (the
-- term exam before it is held) is left out and the remaining weights are scaled
-- up, so a running grade in the middle of a term is not dragged towards zero.
-- "weight_covered" tells how much of the 100 % is based on real data; once every
-- component has data the result equals the prompt's formula exactly.
--
-- The final grade is calculated from the component percents as they are shown
-- (two decimals). The numbers on the screen, in the Excel file and a check by
-- hand therefore always give the same result.
--
-- Missing work: a score marked excused is skipped. Otherwise the component's
-- missing_policy decides: 'zero' counts it as 0 once the item's date has come,
-- 'exclude' skips it.
create or replace function term_grades(p_class_id uuid, p_term_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  perform assert_teaches(p_class_id);
  with roster as (
    select s.id, s.first_name, s.family_initial
    from enrollments e join students s on s.id = e.student_id
    where e.class_id = p_class_id and e.ended_on is null and s.status = 'active'
  ),
  comps as (
    select * from grade_components where class_id = p_class_id and term_id = p_term_id
  ),
  item_pct as (
    select r.id as student_id, c.id as component_id, gi.item_weight,
           case
             when sc.is_excused then null
             when sc.score is not null then least(sc.score / gi.max_score * 100, 100)
             when c.missing_policy = 'zero' and gi.held_on is not null and gi.held_on <= local_today() then 0
             else null
           end as pct
    from roster r
    cross join comps c
    join grade_items gi on gi.component_id = c.id
    left join scores sc on sc.grade_item_id = gi.id and sc.student_id = r.id
    where c.source <> 'attendance'
  ),
  comp_pct as (
    select student_id, component_id,
           sum(pct * item_weight) / nullif(sum(item_weight) filter (where pct is not null), 0) as pct
    from item_pct
    group by student_id, component_id
    union all
    select r.id, c.id, attendance_percent(r.id, p_class_id, p_term_id)
    from roster r cross join comps c
    where c.source = 'attendance'
  ),
  per_student as (
    select r.id, r.first_name, r.family_initial,
           round(sum(round(cp.pct, 2) * c.weight) / nullif(sum(c.weight) filter (where cp.pct is not null), 0), 2) as final_pct,
           coalesce(sum(c.weight) filter (where cp.pct is not null), 0) as covered,
           coalesce(jsonb_agg(jsonb_build_object(
             'component_id', c.id, 'name', c.name, 'weight', c.weight, 'source', c.source,
             'percent', round(cp.pct, 2)) order by c.sort_order, c.name) filter (where c.id is not null),
             '[]'::jsonb) as components
    from roster r
    left join comps c on true
    left join comp_pct cp on cp.student_id = r.id and cp.component_id = c.id
    group by r.id, r.first_name, r.family_initial
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'student_id', p.id, 'first_name', p.first_name, 'family_initial', p.family_initial,
           'final_percent', p.final_pct, 'weight_covered', p.covered,
           'letter', b.letter, 'teacher_label', b.teacher_label, 'stars', b.stars,
           'student_message', b.student_message,
           'components', p.components)), '[]'::jsonb)
    into v
  from per_student p
  left join lateral (select (grade_band(p_class_id, p.final_pct)).*) b on true;
  return v;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Teacher functions: settings (owner only)
-- ----------------------------------------------------------------------------
-- First-time setup: the school year. Moving on to the next school year is the
-- year-end wizard of a later phase, so this refuses when a year already exists.
create or replace function create_school_year(p_name text, p_starts_on date, p_ends_on date) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if not is_owner() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if exists (select 1 from school_years where is_current) then
    raise exception 'year_exists' using errcode = 'P0001';
  end if;
  insert into school_years (name, starts_on, ends_on, is_current)
  values (trim(p_name), p_starts_on, p_ends_on, true)
  returning id into v_id;
  return v_id;
end $$;

-- Replace the school-wide letter bands in one step.
-- p_bands: [{"letter": "A", "min_percent": 90, "teacher_label": "Онц", "stars": 5, "student_message": "..."}]
create or replace function save_default_bands(p_bands jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if jsonb_array_length(coalesce(p_bands, '[]'::jsonb)) < 2 then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  -- the lowest band must start at 0 so that every percent has a letter
  if (select min((b ->> 'min_percent')::numeric) from jsonb_array_elements(p_bands) b) <> 0 then
    raise exception 'band_zero' using errcode = 'P0001';
  end if;
  delete from grade_scale_bands where class_id is null;
  insert into grade_scale_bands (class_id, min_percent, letter, teacher_label, stars, student_message)
  select null, (b ->> 'min_percent')::numeric, trim(b ->> 'letter'), trim(b ->> 'teacher_label'),
         (b ->> 'stars')::smallint, trim(b ->> 'student_message')
  from jsonb_array_elements(p_bands) b;
end $$;

-- ----------------------------------------------------------------------------
-- 2. Teacher functions: dashboard
-- ----------------------------------------------------------------------------
create or replace function dashboard_summary() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
begin
  if not is_teacher() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  with my as (
    select c.* from classes c join school_years y on y.id = c.school_year_id
    where y.is_current and c.status = 'active' and teaches_class(c.id)
  ),
  att as (
    select ls.held_on,
           case a.status
             when 'present' then 1::numeric
             when 'late' then c.late_coefficient
             when 'absent' then 0::numeric
             else case when c.excused_policy = 'count_present' then 1::numeric end
           end as val
    from attendance a
    join lesson_sessions ls on ls.id = a.lesson_session_id
    join my c on c.id = ls.class_id
    where ls.held_on > local_today() - 14
  ),
  sched as (
    select c.id as class_id, c.name, c.color, c.animal_icon, sl.starts_at, sl.ends_at,
           open_lesson_id(c.id) as open_lesson_id,
           exists (select 1 from attendance a join lesson_sessions ls on ls.id = a.lesson_session_id
                    where ls.class_id = c.id and ls.held_on = local_today()) as attendance_done
    from my c
    join class_schedule_slots sl on sl.class_id = c.id
    where sl.weekday = extract(isodow from local_today())::integer
  )
  select jsonb_build_object(
    'today', local_today(),
    'classes', (select count(*) from my),
    'students', (select count(*) from enrollments e join my c on c.id = e.class_id
                   join students s on s.id = e.student_id
                  where e.ended_on is null and s.status = 'active'),
    'online', (select count(*) from student_sessions ss join my c on c.id = ss.class_id
                where ss.ended_at is null and ss.expires_at > now()),
    'today_attendance', (select round(avg(val) * 100, 1) from att where held_on = local_today()),
    'week_attendance', (select round(avg(val) * 100, 1) from att where held_on > local_today() - 7),
    'prev_week_attendance', (select round(avg(val) * 100, 1) from att where held_on <= local_today() - 7),
    'schedule', coalesce((select jsonb_agg(to_jsonb(s) order by s.starts_at, s.name) from sched s), '[]'::jsonb)
  ) into v;
  return v;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Login and student functions (secret key only)
-- ----------------------------------------------------------------------------
-- Class cards for the public start page. No student data.
create or replace function login_classes() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', c.id, 'grade', c.grade, 'section', c.section, 'name', c.name,
           'color', c.color, 'animal_icon', c.animal_icon,
           'is_open', open_lesson_id(c.id) is not null
         ) order by c.grade, c.section), '[]'::jsonb)
  from classes c
  join school_years y on y.id = c.school_year_id
  where y.is_current and c.status = 'active'
$$;

create or replace function class_id_by_code(p_class_code text) returns uuid
language sql stable security definer set search_path = public as $$
  select c.id from classes c
  where c.class_code = lower(trim(p_class_code)) and c.status = 'active'
$$;

-- Names of a class, for the "pick your name" screen. Given out only while the
-- lesson is open, or (when the teacher allows practice from home) to someone
-- who has the class code. Otherwise the answer is "locked" and carries no names.
create or replace function login_roster(p_class_id uuid, p_class_code text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c classes%rowtype;
  v_mode text;
  v_class jsonb;
begin
  select * into c from classes where id = p_class_id and status = 'active';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  v_class := jsonb_build_object(
    'id', c.id, 'grade', c.grade, 'name', c.name, 'color', c.color, 'animal_icon', c.animal_icon,
    'picture_password_enabled', c.picture_password_enabled);
  if open_lesson_id(c.id) is not null then
    v_mode := 'lesson';
  elsif c.home_practice_enabled and p_class_code is not null and lower(trim(p_class_code)) = c.class_code then
    v_mode := 'home';
  else
    return jsonb_build_object('ok', false, 'error', 'locked', 'class', v_class);
  end if;
  return jsonb_build_object(
    'ok', true, 'mode', v_mode, 'class', v_class,
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'first_name', s.first_name, 'family_initial', s.family_initial,
               'has_picture_password', s.picture_password_hash is not null))
      from enrollments e join students s on s.id = e.student_id
      where e.class_id = c.id and e.ended_on is null and s.status = 'active'), '[]'::jsonb));
end $$;

-- Student login. Returns {"ok": true, "session_id": ...} or {"ok": false, "error": code}.
-- Error codes: not_found, locked, picture_required, wrong_picture,
--              too_many_attempts, setup_in_class.
-- The picture password arrives already hashed by the server.
create or replace function student_login(
  p_class_id uuid, p_student_id uuid,
  p_picture_hash text default null, p_class_code text default null,
  p_ip_hash text default null, p_device text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c classes%rowtype;
  s students%rowtype;
  v_lesson uuid;
  v_mode text;
  v_failed integer;
  v_session uuid;
  v_expires timestamptz;
begin
  select * into c from classes where id = p_class_id and status = 'active';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select st.* into s
    from students st
    join enrollments e on e.student_id = st.id and e.ended_on is null
   where st.id = p_student_id and e.class_id = p_class_id and st.status = 'active';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  v_lesson := open_lesson_id(c.id);
  if v_lesson is not null then
    v_mode := 'lesson';
  elsif c.home_practice_enabled and p_class_code is not null and lower(trim(p_class_code)) = c.class_code then
    v_mode := 'home';
  else
    return jsonb_build_object('ok', false, 'error', 'locked');
  end if;

  if c.picture_password_enabled then
    select count(*) into v_failed from login_attempts
     where student_id = s.id and not succeeded and created_at > now() - interval '10 minutes';
    if v_failed >= 5 then
      return jsonb_build_object('ok', false, 'error', 'too_many_attempts');
    end if;
    if s.picture_password_hash is null then
      -- first login: the student chooses the pictures, but only inside a lesson
      if v_mode = 'home' then
        return jsonb_build_object('ok', false, 'error', 'setup_in_class');
      end if;
      if nullif(p_picture_hash, '') is null then
        return jsonb_build_object('ok', false, 'error', 'picture_required', 'setup', true);
      end if;
      update students set picture_password_hash = p_picture_hash, picture_password_set_at = now()
       where id = s.id;
    else
      if nullif(p_picture_hash, '') is null then
        return jsonb_build_object('ok', false, 'error', 'picture_required', 'setup', false);
      end if;
      if p_picture_hash <> s.picture_password_hash then
        insert into login_attempts (student_id, class_id, ip_hash, succeeded)
        values (s.id, c.id, p_ip_hash, false);
        return jsonb_build_object('ok', false, 'error', 'wrong_picture', 'attempts_left', greatest(4 - v_failed, 0));
      end if;
    end if;
  end if;

  -- one device per student: the earlier session is closed
  update student_sessions set ended_at = now(), end_reason = 'replaced'
   where student_id = s.id and ended_at is null;

  if v_mode = 'lesson' then
    select coalesce(ends_at, opened_at + interval '90 minutes') into v_expires
      from lesson_sessions where id = v_lesson;
  else
    v_expires := now() + interval '60 minutes';
  end if;

  insert into student_sessions (student_id, class_id, lesson_session_id, device_label, expires_at)
  values (s.id, c.id, v_lesson, left(coalesce(p_device, ''), 120), v_expires)
  returning id into v_session;
  insert into login_attempts (student_id, class_id, ip_hash, succeeded) values (s.id, c.id, p_ip_hash, true);

  return jsonb_build_object('ok', true, 'session_id', v_session, 'expires_at', v_expires, 'mode', v_mode);
end $$;

-- Who is behind this session id? Null when the session is unknown, ended or expired.
create or replace function student_session(p_session_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  select ss.id, ss.student_id, ss.class_id, ss.lesson_session_id, ss.expires_at, ss.ended_at, ss.last_seen_at,
         st.first_name, st.family_initial, st.avatar,
         c.name as class_name, c.grade, c.color, c.animal_icon
    into r
    from student_sessions ss
    join students st on st.id = ss.student_id
    join classes c on c.id = ss.class_id
   where ss.id = p_session_id;
  if not found or r.ended_at is not null then
    return null;
  end if;
  if r.expires_at <= now() then
    update student_sessions set ended_at = now(), end_reason = 'expired' where id = p_session_id;
    return null;
  end if;
  if r.last_seen_at < now() - interval '1 minute' then
    update student_sessions set last_seen_at = now() where id = p_session_id;
  end if;
  return jsonb_build_object(
    'session_id', r.id, 'student_id', r.student_id, 'class_id', r.class_id,
    'first_name', r.first_name, 'family_initial', r.family_initial, 'avatar', r.avatar,
    'class_name', r.class_name, 'grade', r.grade, 'color', r.color, 'animal_icon', r.animal_icon,
    'in_lesson', r.lesson_session_id is not null, 'expires_at', r.expires_at);
end $$;

create or replace function student_logout(p_session_id uuid) returns void
language sql security definer set search_path = public as $$
  update student_sessions set ended_at = now(), end_reason = 'logout'
   where id = p_session_id and ended_at is null
$$;

-- ----------------------------------------------------------------------------
-- Who may call what
--
-- Everything is closed first and then opened by name, so the result does not
-- depend on how the Supabase project was created (older projects open new
-- functions to every role, newer ones do not).
--   anon (not signed in) ........ no function at all
--   authenticated (teacher) ..... helpers used by the policies + teacher functions
--   service_role (server key) ... everything, including login and student functions
-- ----------------------------------------------------------------------------
do $$
declare
  f text;
begin
  execute 'revoke all on all functions in schema public from public, anon, authenticated';
  execute 'grant execute on all functions in schema public to service_role';

  foreach f in array array[
    -- helpers that the Row Level Security policies and the pages call
    'local_today()',
    'is_teacher()',
    'is_owner()',
    'teaches_class(uuid)',
    'assert_teaches(uuid)',
    'current_term_id(date)',
    'grade_band(uuid, numeric)',
    'attendance_percent(uuid, uuid, uuid)',
    -- teacher functions (each one checks the caller itself)
    'create_class(integer, text, text, text)',
    'my_classes(boolean)',
    'add_students(uuid, jsonb)',
    'class_roster(uuid)',
    'all_students()',
    'transfer_student(uuid, uuid)',
    'remove_student(uuid)',
    'update_student(uuid, text, text, text)',
    'reset_picture_password(uuid)',
    'student_profile(uuid)',
    'ensure_lesson(uuid, date, integer)',
    'open_lesson(uuid, integer)',
    'close_lesson(uuid)',
    'kick_all_students(uuid)',
    'attendance_sheet(uuid, date, integer)',
    'save_attendance(uuid, date, integer, jsonb)',
    'save_grade_components(uuid, uuid, jsonb)',
    'copy_grade_components(uuid, uuid, uuid)',
    'create_grade_item(uuid, text, numeric, date)',
    'delete_grade_item(uuid)',
    'grade_item_sheet(uuid)',
    'save_scores(uuid, jsonb)',
    'term_grades(uuid, uuid)',
    'create_school_year(text, date, date)',
    'save_default_bands(jsonb)',
    'dashboard_summary()'
  ] loop
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- Not opened to teachers on purpose: login_classes, class_id_by_code,
  -- login_roster, student_login, student_session, student_logout, open_lesson_id
  -- (the server calls them with the secret key) and the trigger functions.
end $$;
