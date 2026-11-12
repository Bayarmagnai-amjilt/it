-- =============================================================================
-- Phase 1A database tests. Plain SQL: every check raises an exception on
-- failure, so "no error" means "all passed". Run with supabase/tests/run_local.sh
-- on a scratch database (local_stub.sql + the three migrations applied first).
-- =============================================================================
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

create schema if not exists t;
grant usage on schema t to public;
create or replace function t.ok(p_ok boolean, p_name text) returns void
language plpgsql as $$
begin
  if p_ok is not true then
    raise exception 'FAILED: %', p_name using errcode = 'P0999';
  end if;
  raise notice 'ok   %', p_name;
end $$;
grant execute on function t.ok(boolean, text) to public;

-- role switches: signed-in owner / second teacher / inactive account / anonymous / server / superuser
\set as_owner 'reset role; set request.jwt.claims = \'{"sub": "00000000-0000-0000-0000-0000000000a1"}\'; set role authenticated;'
\set as_teacher2 'reset role; set request.jwt.claims = \'{"sub": "00000000-0000-0000-0000-0000000000a2"}\'; set role authenticated;'
\set as_stranger 'reset role; set request.jwt.claims = \'{"sub": "00000000-0000-0000-0000-0000000000a3"}\'; set role authenticated;'
\set as_anon 'reset role; set request.jwt.claims = \'\'; set role anon;'
\set as_server 'reset role; set request.jwt.claims = \'\'; set role service_role;'
\set as_admin 'reset role; set request.jwt.claims = \'\';'

-- ---------------------------------------------------------------------------
\echo '--- 1. accounts: first user is the owner, later ones start inactive'
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner@example.mn'),
  ('00000000-0000-0000-0000-0000000000a2', 'second@example.mn'),
  ('00000000-0000-0000-0000-0000000000a3', 'stranger@example.com');
select t.ok((select role = 'owner' and is_active from teachers where email = 'owner@example.mn'), 'first account is an active owner');
select t.ok((select role = 'teacher' and not is_active from teachers where email = 'second@example.mn'), 'second account is an inactive teacher');
update teachers set is_active = true where email = 'second@example.mn';   -- owner activates the 2nd teacher

-- school year and terms (as the owner, through RLS)
:as_owner
insert into school_years (id, name, starts_on, ends_on, is_current)
values ('00000000-0000-0000-0000-00000000b001', 'test-year', local_today() - 60, local_today() + 200, true);
insert into terms (id, school_year_id, name, starts_on, ends_on, sort_order) values
  ('00000000-0000-0000-0000-00000000c001', '00000000-0000-0000-0000-00000000b001', 'T1', local_today() - 60, local_today() + 30, 1),
  ('00000000-0000-0000-0000-00000000c002', '00000000-0000-0000-0000-00000000b001', 'T2', local_today() + 40, local_today() + 200, 2);
select t.ok(current_term_id() = '00000000-0000-0000-0000-00000000c001', 'current term is the one containing today');
select t.ok(current_term_id(local_today() + 35) = '00000000-0000-0000-0000-00000000c001', 'in a break the last started term is used');

-- ---------------------------------------------------------------------------
\echo '--- 2. classes and students'
select create_class(4, 'б', '#F97316', 'eagle') as class_a \gset
select create_class(4, 'в') as class_b \gset
select t.ok((select name = '4Б' from classes where id = :'class_a'), 'class name is generated in upper case: 4Б');
select t.ok(add_students(:'class_a', '[
  {"first_name": "Тэмүүлэн", "family_initial": "б", "gender": "male"},
  {"first_name": "Тэмүүлэн", "family_initial": "Д"},
  {"first_name": "Өлзий", "family_initial": "Г", "gender": "female"},
  {"first_name": "  "}]'::jsonb) = 3, 'add_students adds 3 and skips the blank row');
select t.ok(add_students(:'class_b', '[{"first_name": "Номин", "family_initial": "С"}]'::jsonb) = 1, 'second class gets a student');
select (r ->> 'student_id') as st1 from jsonb_array_elements(class_roster(:'class_a')) r where r ->> 'family_initial' = 'Б' \gset
select (r ->> 'student_id') as st2 from jsonb_array_elements(class_roster(:'class_a')) r where r ->> 'family_initial' = 'Д' \gset
select (r ->> 'student_id') as st3 from jsonb_array_elements(class_roster(:'class_a')) r where r ->> 'first_name' = 'Өлзий' \gset
select (r ->> 'student_id') as st_b from jsonb_array_elements(class_roster(:'class_b')) r \gset
select t.ok(jsonb_array_length(my_classes()) = 2, 'owner sees 2 classes');

-- second teacher: active, but not assigned to any class
:as_teacher2
select t.ok((select count(*) from classes) = 0, 'unassigned teacher sees no classes');
select t.ok((select count(*) from students) = 0, 'unassigned teacher sees no students');
select t.ok(jsonb_array_length(my_classes()) = 0, 'my_classes is empty for the unassigned teacher');
do $$
begin
  perform add_students((select id from classes limit 1), '[{"first_name": "X"}]'::jsonb);
  raise exception 'FAILED: unassigned teacher could add students' using errcode = 'P0999';
exception when insufficient_privilege then
  raise notice 'ok   unassigned teacher cannot add students';
end $$;

-- a signed-in account that is not an active teacher, and an anonymous visitor
:as_stranger
select t.ok((select count(*) from students) = 0 and (select count(*) from classes) = 0
  and (select count(*) from teachers) <= 1, 'inactive account reads no classes or students');
do $$
begin
  perform my_classes();
  raise exception 'FAILED: inactive account could call my_classes' using errcode = 'P0999';
exception when insufficient_privilege then
  raise notice 'ok   inactive account cannot call teacher functions';
end $$;

:as_anon
do $$
begin
  perform count(*) from students;
  raise exception 'FAILED: anon could query the students table' using errcode = 'P0999';
exception when insufficient_privilege then
  raise notice 'ok   anonymous visitor cannot even query a table';
end $$;
do $$
begin
  perform login_classes();
  raise exception 'FAILED: anon could call login_classes' using errcode = 'P0999';
exception when insufficient_privilege then
  raise notice 'ok   anon cannot call login functions';
end $$;

-- the same, for every table and function at once (catalog check)
:as_admin
select t.ok(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'S')
     and (has_table_privilege('anon', c.oid, 'select') or has_table_privilege('anon', c.oid, 'update'))) = 0,
  'anon has no right on any table or sequence');
select t.ok(
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')) = 0,
  'anon may call no function');
select t.ok(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) = 0,
  'every table has row level security on');
select t.ok(
  (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r'
     and has_table_privilege('authenticated', c.oid, 'select')
     and not exists (select 1 from pg_policy p where p.polrelid = c.oid)) = 0,
  'a signed-in teacher has rights only on tables that have a policy');
select t.ok(
  has_table_privilege('authenticated', 'public.classes', 'select')
  and has_table_privilege('authenticated', 'public.teacher_notes', 'insert')
  and not has_table_privilege('authenticated', 'public.questions', 'select')
  and not has_table_privilege('authenticated', 'public.question_answer_keys', 'select'),
  'teacher rights: phase 1 tables yes, later-phase tables (questions, answer keys) no');
select t.ok(
  not has_function_privilege('authenticated', 'public.student_login(uuid, uuid, text, text, text, text)', 'execute')
  and not has_function_privilege('authenticated', 'public.student_session(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'public.login_roster(uuid, text)', 'execute')
  and has_function_privilege('authenticated', 'public.term_grades(uuid, uuid)', 'execute')
  and has_function_privilege('service_role', 'public.student_login(uuid, uuid, text, text, text, text)', 'execute'),
  'student and login functions are for the server key only');
:as_owner
do $$
begin
  perform student_session(gen_random_uuid());
  raise exception 'FAILED: a teacher token could call student_session' using errcode = 'P0999';
exception when insufficient_privilege then
  raise notice 'ok   signed-in users cannot call student functions either';
end $$;

-- ---------------------------------------------------------------------------
\echo '--- 3. lesson lock and student login'
:as_server
select t.ok((login_roster(:'class_a') ->> 'error') = 'locked', 'roster is locked before the lesson starts');
select t.ok(not (login_roster(:'class_a') ? 'students'), 'locked answer carries no names');
select t.ok((student_login(:'class_a', :'st1') ->> 'error') = 'locked', 'login is refused while locked');

:as_owner
select open_lesson(:'class_a') as lesson_a \gset
select t.ok(open_lesson(:'class_a') = :'lesson_a', 'opening twice returns the same lesson');

:as_server
select t.ok((select (c ->> 'is_open')::boolean from jsonb_array_elements(login_classes()) c where c ->> 'id' = :'class_a'), 'class card shows the lesson as open');
select t.ok(jsonb_array_length(login_roster(:'class_a') -> 'students') = 3, 'open lesson: roster has 3 names');
select t.ok((login_roster(:'class_b') ->> 'error') = 'locked', 'the other class stays locked');
select t.ok((student_login(:'class_a', :'st_b') ->> 'error') = 'not_found', 'a student of another class cannot log into this class');

select student_login(:'class_a', :'st1', null, null, 'iphash', 'PC-07') ->> 'session_id' as sess1 \gset
select t.ok((student_session(:'sess1') ->> 'first_name') = 'Тэмүүлэн', 'session resolves to the student');
select student_login(:'class_a', :'st1') ->> 'session_id' as sess1b \gset
select t.ok(student_session(:'sess1') is null, 'second device: the first session is closed');
select t.ok((student_session(:'sess1b') ->> 'student_id') = :'st1', 'second device: the new session works');
select t.ok(student_session(gen_random_uuid()) is null, 'unknown session id resolves to nothing');

\echo '--- 4. picture password'
:as_owner
update classes set picture_password_enabled = true where id = :'class_a';
do $$
begin
  update classes set home_practice_enabled = true, picture_password_enabled = false where name = '4Б';
  raise exception 'FAILED: home practice without picture password accepted' using errcode = 'P0999';
exception when check_violation then
  raise notice 'ok   home practice requires the picture password';
end $$;
:as_server
select t.ok((student_login(:'class_a', :'st2') ->> 'error') = 'picture_required', 'picture password is required once enabled');
select t.ok((student_login(:'class_a', :'st2') -> 'setup')::boolean, 'first time: the student is asked to choose pictures');
select t.ok((student_login(:'class_a', :'st2', 'hash-horse-sun-ger') ->> 'ok')::boolean, 'first login stores the chosen pictures');
select t.ok((student_login(:'class_a', :'st2', 'hash-wrong') ->> 'error') = 'wrong_picture', 'wrong pictures are refused');
select t.ok((student_login(:'class_a', :'st2', 'hash-horse-sun-ger') ->> 'ok')::boolean, 'right pictures are accepted');
select student_login(:'class_a', :'st2', 'bad') from generate_series(1, 4);
select t.ok((student_login(:'class_a', :'st2', 'hash-horse-sun-ger') ->> 'error') = 'too_many_attempts', '5 wrong tries lock the student out for a while');
:as_owner
select reset_picture_password(:'st2');
:as_server
select t.ok((student_login(:'class_a', :'st2', 'hash-new') ->> 'ok')::boolean, 'after the teacher resets it the student chooses new pictures');

\echo '--- 5. practice from home'
:as_owner
update classes set picture_password_enabled = true, home_practice_enabled = true where id = :'class_b';
select class_code as code_b from classes where id = :'class_b' \gset
:as_server
select t.ok((login_roster(:'class_b') ->> 'error') = 'locked', 'home: no code, no names');
select t.ok((login_roster(:'class_b', 'wrong-code') ->> 'error') = 'locked', 'home: wrong code, no names');
select t.ok((login_roster(:'class_b', :'code_b') ->> 'mode') = 'home', 'home: right code opens the roster');
select t.ok(class_id_by_code(:'code_b') = :'class_b', 'class is found by its code');
select t.ok((student_login(:'class_b', :'st_b', 'hash-x', :'code_b') ->> 'error') = 'setup_in_class', 'home: pictures must first be chosen in class');

\echo '--- 6. attendance'
-- st3 logs in late: pretend the lesson started 30 minutes ago
:as_admin
update lesson_sessions set starts_at = now() - interval '30 minutes' where id = :'lesson_a';
update student_sessions set started_at = now() - interval '29 minutes' where student_id = :'st1';
:as_server
select student_login(:'class_a', :'st3', 'hash-3') ->> 'session_id' as sess3 \gset

:as_owner
select attendance_sheet(:'class_a') as sheet \gset
select t.ok(jsonb_array_length(:'sheet'::jsonb -> 'rows') = 3, 'sheet lists the 3 students');
select t.ok((select r ->> 'suggested' from jsonb_array_elements(:'sheet'::jsonb -> 'rows') r where r ->> 'student_id' = :'st1') = 'present', 'logged in on time is suggested present');
select t.ok((select r ->> 'suggested' from jsonb_array_elements(:'sheet'::jsonb -> 'rows') r where r ->> 'student_id' = :'st3') = 'late', 'logged in after 10 minutes is suggested late');
select t.ok((select r ->> 'status' from jsonb_array_elements(:'sheet'::jsonb -> 'rows') r where r ->> 'student_id' = :'st3') = 'late', 'the suggestion is pre-selected');

select save_attendance(:'class_a', local_today(), 1, jsonb_build_array(
  jsonb_build_object('student_id', :'st1', 'status', 'present'),
  jsonb_build_object('student_id', :'st2', 'status', 'absent'),
  jsonb_build_object('student_id', :'st3', 'status', 'late'),
  jsonb_build_object('student_id', :'st_b', 'status', 'present')));     -- not in this class: ignored
select t.ok((select count(*) from attendance) = 3, 'attendance saved for the 3 students of the class only');
select save_attendance(:'class_a', local_today(), 1, jsonb_build_array(
  jsonb_build_object('student_id', :'st2', 'status', 'sick', 'note', 'Эмчийн магадлагаатай')));
select t.ok((select count(*) = 1 and max(before ->> 'status') = 'absent' and max(after ->> 'status') = 'sick'
  and max(actor_id::text) = '00000000-0000-0000-0000-0000000000a1' from audit_log where table_name = 'attendance'), 'the correction is in the audit trail with who made it');
do $$
begin
  perform save_attendance((select id from classes where name = '4Б'), local_today() + 1, 1, '[]'::jsonb);
  raise exception 'FAILED: attendance for a future date accepted' using errcode = 'P0999';
exception when sqlstate 'P0001' then
  raise notice 'ok   attendance for a future date is refused';
end $$;

-- formula: 20 lessons = 16 present, 2 late, 1 absent, 1 excused
:as_admin
insert into lesson_sessions (id, class_id, term_id, held_on, period)
select gen_random_uuid(), :'class_b', '00000000-0000-0000-0000-00000000c001', local_today() - g, 1 from generate_series(1, 20) g;
insert into attendance (lesson_session_id, student_id, status)
select id, :'st_b', (case when rn <= 16 then 'present' when rn <= 18 then 'late' when rn = 19 then 'absent' else 'excused' end)::attendance_status
from (select id, row_number() over (order by held_on) rn from lesson_sessions where class_id = :'class_b') x;
select t.ok(attendance_percent(:'st_b', :'class_b', '00000000-0000-0000-0000-00000000c001') = 89.47, 'attendance %: excused left out -> 17/19 = 89.47');
update classes set excused_policy = 'count_present' where id = :'class_b';
select t.ok(attendance_percent(:'st_b', :'class_b', '00000000-0000-0000-0000-00000000c001') = 90.00, 'attendance %: excused counted as present -> 18/20 = 90.00');
update classes set late_coefficient = 1 where id = :'class_b';
select t.ok(attendance_percent(:'st_b', :'class_b', '00000000-0000-0000-0000-00000000c001') = 95.00, 'attendance %: late coefficient 1 -> 19/20 = 95.00');

\echo '--- 7. grading'
:as_owner
do $$
begin
  perform save_grade_components((select id from classes where name = '4В'), '00000000-0000-0000-0000-00000000c001',
    '[{"name": "Ирц", "weight": 10, "source": "attendance"}, {"name": "Шалгалт", "weight": 80, "source": "quiz"}]'::jsonb);
  raise exception 'FAILED: weights summing to 90 accepted' using errcode = 'P0999';
exception when sqlstate 'P0001' then
  raise notice 'ok   weights that do not add up to 100 are refused (%)', sqlerrm;
end $$;
select save_grade_components(:'class_b', '00000000-0000-0000-0000-00000000c001', '[
  {"name": "Ирц",                "weight": 10, "source": "attendance"},
  {"name": "Явцын шалгалт",      "weight": 30, "source": "quiz"},
  {"name": "Scratch даалгавар",  "weight": 20, "source": "scratch"},
  {"name": "Өдөр тутмын дасгал", "weight": 10, "source": "practice", "missing_policy": "exclude"},
  {"name": "Идэвх оролцоо",      "weight": 10, "source": "manual"},
  {"name": "Улирлын шалгалт",    "weight": 20, "source": "quiz"}]'::jsonb);
select t.ok((select sum(weight) = 100 and count(*) = 6 from grade_components where class_id = :'class_b'), 'six components saved, weights add up to 100');

-- only attendance has data so far: running grade = attendance %, coverage 10
select t.ok((term_grades(:'class_b', '00000000-0000-0000-0000-00000000c001') -> 0 ->> 'final_percent')::numeric = 95.00
  and (term_grades(:'class_b', '00000000-0000-0000-0000-00000000c001') -> 0 ->> 'weight_covered')::numeric = 10, 'running grade uses only components that have data');

-- the worked example of prompt section 6: 95, 80, 90, 70, 100, 85 -> 85.5 (B)
select id as c_quiz from grade_components where class_id = :'class_b' and name = 'Явцын шалгалт' \gset
select id as c_scratch from grade_components where class_id = :'class_b' and name = 'Scratch даалгавар' \gset
select id as c_practice from grade_components where class_id = :'class_b' and name = 'Өдөр тутмын дасгал' \gset
select id as c_part from grade_components where class_id = :'class_b' and name = 'Идэвх оролцоо' \gset
select id as c_exam from grade_components where class_id = :'class_b' and name = 'Улирлын шалгалт' \gset
select create_grade_item(:'c_quiz', 'Шалгалт 1', 20) as i_q1 \gset
select create_grade_item(:'c_quiz', 'Шалгалт 2', 10) as i_q2 \gset
select create_grade_item(:'c_scratch', 'Хурдан морь', 10) as i_s \gset
select create_grade_item(:'c_practice', 'Дасгал', 100) as i_p \gset
select create_grade_item(:'c_part', 'Идэвх', 5) as i_a \gset
select create_grade_item(:'c_exam', 'Улирлын шалгалт', 40) as i_e \gset
select save_scores(:'i_q1', jsonb_build_array(jsonb_build_object('student_id', :'st_b', 'score', 14)));   -- 70 %
select save_scores(:'i_q2', jsonb_build_array(jsonb_build_object('student_id', :'st_b', 'score', 9)));    -- 90 %  -> average 80
select save_scores(:'i_s',  jsonb_build_array(jsonb_build_object('student_id', :'st_b', 'score', 9)));    -- 90 %
select save_scores(:'i_p',  jsonb_build_array(jsonb_build_object('student_id', :'st_b', 'score', 70)));   -- 70 %
select save_scores(:'i_a',  jsonb_build_array(jsonb_build_object('student_id', :'st_b', 'score', 5)));    -- 100 %
select save_scores(:'i_e',  jsonb_build_array(jsonb_build_object('student_id', :'st_b', 'score', 34)));   -- 85 %
select term_grades(:'class_b', '00000000-0000-0000-0000-00000000c001') -> 0 as g \gset
select t.ok((:'g'::jsonb ->> 'final_percent')::numeric = 85.50, 'worked example of the prompt gives 85.50');
select t.ok((:'g'::jsonb ->> 'letter') = 'B' and (:'g'::jsonb ->> 'stars')::int = 4 and (:'g'::jsonb ->> 'weight_covered')::numeric = 100, '85.5 is a B with 4 stars, all 100 % covered');
select t.ok((grade_band(:'class_b', 89.5)).letter = 'B' and (grade_band(:'class_b', 90)).letter = 'A' and (grade_band(:'class_b', 59.99)).letter = 'F', 'letter bands use the lower bound: 89.5 B, 90 A, 59.99 F');

-- missing work
select save_scores(:'i_q2', jsonb_build_array(jsonb_build_object('student_id', :'st_b', 'score', null)));
select t.ok((select (c ->> 'percent')::numeric from jsonb_array_elements(term_grades(:'class_b', '00000000-0000-0000-0000-00000000c001') -> 0 -> 'components') c where c ->> 'name' = 'Явцын шалгалт') = 35.00, 'missing work counts as 0 under the "zero" policy: (70 + 0) / 2 = 35');
select save_scores(:'i_q2', jsonb_build_array(jsonb_build_object('student_id', :'st_b', 'score', null, 'is_excused', true)));
select t.ok((select (c ->> 'percent')::numeric from jsonb_array_elements(term_grades(:'class_b', '00000000-0000-0000-0000-00000000c001') -> 0 -> 'components') c where c ->> 'name' = 'Явцын шалгалт') = 70.00, 'excused work is left out: 70');
do $$
begin
  perform save_scores((select id from grade_items where title = 'Идэвх'), jsonb_build_array(jsonb_build_object('student_id', (select student_id from scores limit 1), 'score', 6)));
  raise exception 'FAILED: score above the maximum accepted' using errcode = 'P0999';
exception when sqlstate 'P0001' then
  raise notice 'ok   a score above the maximum is refused';
end $$;
do $$
begin
  perform save_grade_components((select id from classes where name = '4В'), '00000000-0000-0000-0000-00000000c001',
    '[{"name": "Бүгд", "weight": 100, "source": "manual"}]'::jsonb);
  raise exception 'FAILED: components holding scored work were deleted' using errcode = 'P0999';
exception when sqlstate 'P0001' then
  raise notice 'ok   a component that holds scored work cannot be removed by accident';
end $$;
select t.ok(copy_grade_components(:'class_b', :'class_a', '00000000-0000-0000-0000-00000000c001') = 6, 'grading setup copied to another class');
select t.ok((select count(*) from audit_log where table_name = 'scores') >= 2, 'score corrections are in the audit trail');

-- The final grade is built from the percents as shown (2 decimals), so that the
-- screen, the Excel formula and a check by hand agree.
-- st1 in 4Б: attendance 100 (weight 10), quiz 2/3 = 66.67 (weight 30), Scratch 30.01 (weight 20)
--   as shown:  (100*10 + 66.67*30 + 30.01*20) / 60 = 60.005  -> 60.01
--   unrounded: (100*10 + 66.666..*30 + 30.01*20) / 60 = 60.0033 -> 60.00 (what Excel would NOT show)
select create_grade_item((select id from grade_components where class_id = :'class_a' and name = 'Явцын шалгалт'), 'Гурван асуулт', 3) as i_r1 \gset
select create_grade_item((select id from grade_components where class_id = :'class_a' and name = 'Scratch даалгавар'), 'Том төсөл', 10000) as i_r2 \gset
select save_scores(:'i_r1', jsonb_build_array(jsonb_build_object('student_id', :'st1', 'score', 2)));
select save_scores(:'i_r2', jsonb_build_array(jsonb_build_object('student_id', :'st1', 'score', 3001)));
select g as g1 from jsonb_array_elements(term_grades(:'class_a', '00000000-0000-0000-0000-00000000c001')) g where g ->> 'student_id' = :'st1' \gset
select t.ok((select string_agg(c ->> 'percent', ' ' order by (c ->> 'weight')::numeric) from jsonb_array_elements(:'g1'::jsonb -> 'components') c where c ->> 'percent' is not null) = '100.00 30.01 66.67',
            'component percents are shown with two decimals: 100.00, 66.67, 30.01');
select t.ok((:'g1'::jsonb ->> 'final_percent')::numeric = 60.01 and (:'g1'::jsonb ->> 'weight_covered')::numeric = 60,
            'final grade is calculated from the shown percents: 60.01 (not 60.00)');

\echo '--- 8. transfer keeps history; end of lesson logs students out'
select transfer_student(:'st3', :'class_b');
select t.ok((select count(*) = 2 from enrollments where student_id = :'st3')
  and (select c.name = '4В' from enrollments e join classes c on c.id = e.class_id where e.student_id = :'st3' and e.ended_on is null), 'transferred student has 2 enrollment rows, the current one in 4В');
select t.ok((select count(*) = 1 from attendance where student_id = :'st3'), 'attendance from the old class is still there');
:as_server
select t.ok(student_session(:'sess3') is null, 'transfer ends the student''s session');
select t.ok(student_session(:'sess1b') is not null, 'another student is still logged in');
:as_owner
select t.ok(close_lesson(:'class_a') >= 1, 'ending the lesson logs students out');
:as_server
select t.ok(student_session(:'sess1b') is null, 'session is gone after the lesson ended');
select t.ok((login_roster(:'class_a') ->> 'error') = 'locked', 'roster is locked again after the lesson');

-- expiry
:as_owner
select open_lesson(:'class_a', 40) as lesson_a2 \gset
select t.ok(:'lesson_a2' <> :'lesson_a', 'a second lesson on the same day gets its own row (period 2)');
:as_server
select student_login(:'class_a', :'st1', 'hash-1') ->> 'session_id' as sess_x \gset
:as_admin
update student_sessions set expires_at = now() - interval '1 second' where id = :'sess_x';
:as_server
select t.ok(student_session(:'sess_x') is null, 'an expired session is refused');
:as_admin
select t.ok((select end_reason = 'expired' from student_sessions where id = :'sess_x'), 'and is marked as expired');

\echo '--- 9. dashboard and profile'
:as_owner
select t.ok((dashboard_summary() ->> 'classes')::int = 2 and (dashboard_summary() ->> 'students')::int = 4, 'dashboard counts 2 classes and 4 students');
select t.ok((student_profile(:'st3') -> 'history') is not null and jsonb_array_length(student_profile(:'st3') -> 'history') = 2, 'profile shows both enrollments');
insert into teacher_notes (student_id, teacher_id, body) values (:'st3', '00000000-0000-0000-0000-0000000000a1', 'Блок код сонирхдог');
select t.ok(jsonb_array_length(student_profile(:'st3') -> 'notes') = 1, 'teacher note is saved and shown');

-- assigned teacher sees only the assigned class
insert into class_teachers (class_id, teacher_id) values (:'class_b', '00000000-0000-0000-0000-0000000000a2');
:as_teacher2
select t.ok((select count(*) = 1 and max(name) = '4В' from classes), 'assigned teacher sees exactly the assigned class');
select t.ok((select count(*) from students) = 2, 'and only its 2 students');
select t.ok((select count(*) from attendance a join lesson_sessions ls on ls.id = a.lesson_session_id where ls.class_id = :'class_a') = 0, 'and no attendance of the other class');
select t.ok((select count(*) from teacher_notes) = 0, 'and not the owner''s private notes');
do $$
begin
  perform term_grades((select id from classes where name = '4Б'), '00000000-0000-0000-0000-00000000c001');
  raise exception 'FAILED: teacher read grades of a class they do not teach' using errcode = 'P0999';
exception when others then
  if sqlstate = '42501' then raise notice 'ok   grades of another class are refused';
  else raise; end if;
end $$;

\echo '--- 10. owner-only settings'
:as_teacher2
do $$
begin
  perform create_school_year('2030-2031', '2030-09-01', '2031-06-01');
  raise exception 'FAILED: a plain teacher created a school year' using errcode = 'P0999';
exception when others then
  if sqlstate = '42501' then raise notice 'ok   only the owner creates a school year';
  else raise; end if;
end $$;
do $$
begin
  perform save_default_bands('[{"letter":"A","min_percent":50,"teacher_label":"x","stars":5,"student_message":"x"},{"letter":"F","min_percent":0,"teacher_label":"y","stars":1,"student_message":"y"}]'::jsonb);
  raise exception 'FAILED: a plain teacher changed the letter bands' using errcode = 'P0999';
exception when others then
  if sqlstate = '42501' then raise notice 'ok   only the owner changes the letter bands';
  else raise; end if;
end $$;

:as_owner
do $$
begin
  perform create_school_year('2030-2031', '2030-09-01', '2031-06-01');
  raise exception 'FAILED: a second current school year was created' using errcode = 'P0999';
exception when others then
  if sqlerrm = 'year_exists' then raise notice 'ok   a second current school year is refused';
  else raise; end if;
end $$;
do $$
begin
  perform save_default_bands('[{"letter":"A","min_percent":90,"teacher_label":"x","stars":5,"student_message":"x"},{"letter":"F","min_percent":10,"teacher_label":"y","stars":1,"student_message":"y"}]'::jsonb);
  raise exception 'FAILED: bands that leave 0-10 percent without a letter were saved' using errcode = 'P0999';
exception when others then
  if sqlerrm = 'band_zero' then raise notice 'ok   the lowest band must start at 0';
  else raise; end if;
end $$;
select t.ok((select count(*) from grade_scale_bands where class_id is null) = 5, 'a refused save leaves the 5 default bands untouched');
select save_default_bands('[{"letter":"Т","min_percent":60,"teacher_label":"Тэнцсэн","stars":4,"student_message":"Сайн байна"},{"letter":"Д","min_percent":0,"teacher_label":"Дахин","stars":2,"student_message":"Дахиад оролдъё"}]'::jsonb);
select t.ok((select count(*) from grade_scale_bands where class_id is null) = 2, 'new bands replace the old ones in one step');
select t.ok((grade_band(:'class_a', 85.5)).letter = 'Т' and (grade_band(:'class_a', 59.99)).letter = 'Д' and (grade_band(:'class_a', 0)).letter = 'Д',
            'grades follow the new bands (85.5 -> Т, 59.99 -> Д, 0 -> Д)');

:as_admin
-- first-time setup (no current school year yet): the owner creates the year
begin;
update school_years set is_current = false;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-0000000000a1"}';
set local role authenticated;
select t.ok(create_school_year('  2030-2031 ', '2030-09-01', '2031-06-01') is not null, 'owner creates the first school year');
select t.ok((select count(*) = 1 and max(name) = '2030-2031' from school_years where is_current), 'and it is the only current one, name trimmed');
rollback;

:as_admin
\echo 'ALL PHASE 1A DATABASE TESTS PASSED'
