-- Checks the demo data after seed.sql ran on a clean database.
\set ON_ERROR_STOP on
\pset format unaligned
\pset tuples_only on

do $$
declare
  v_owner uuid := gen_random_uuid();
  v_class uuid;
  v_term uuid;
  g jsonb;
begin
  if (select count(*) from classes) <> 12 then raise exception 'FAILED: expected 12 classes'; end if;
  if (select count(*) from students) <> 300 then raise exception 'FAILED: expected 300 students'; end if;
  if (select count(*) from enrollments where ended_on is null) <> 300 then raise exception 'FAILED: expected 300 enrollments'; end if;
  if (select count(*) from class_schedule_slots) <> 24 then raise exception 'FAILED: expected 24 timetable slots'; end if;
  if (select count(*) from lesson_sessions) < 12 then raise exception 'FAILED: too few lessons seeded'; end if;
  if (select count(*) from attendance) <> (select count(*) from lesson_sessions) * 25 then
    raise exception 'FAILED: attendance rows do not match lessons x 25';
  end if;
  if exists (select 1 from grade_components group by class_id, term_id having sum(weight) <> 100) then
    raise exception 'FAILED: seeded weights do not add up to 100';
  end if;
  if (select count(*) from students s join enrollments e on e.student_id = s.id join classes c on c.id = e.class_id
       where c.name = '4-2' and s.first_name = 'Тэмүүлэн' and s.family_initial in ('Б', 'Д')) < 2 then
    raise exception 'FAILED: the two namesakes in 4-2 are missing';
  end if;

  -- the first account becomes the owner and can read the seeded grades
  insert into auth.users (id, email) values (v_owner, 'owner@example.mn');
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner)::text, true);
  select id into v_class from classes where name = '4-2';
  v_term := current_term_id();
  g := term_grades(v_class, v_term);
  if jsonb_array_length(g) <> 25 then raise exception 'FAILED: term_grades should list 25 students'; end if;
  if exists (select 1 from jsonb_array_elements(g) x
              where (x ->> 'final_percent') is null or (x ->> 'final_percent')::numeric not between 0 and 100) then
    raise exception 'FAILED: a seeded student has no running grade';
  end if;
  raise notice 'ok   seed: 12 classes, 300 students, % lessons, % attendance rows; 4-2 running grades % .. % (coverage % %%)',
    (select count(*) from lesson_sessions), (select count(*) from attendance),
    (select min((x ->> 'final_percent')::numeric) from jsonb_array_elements(g) x),
    (select max((x ->> 'final_percent')::numeric) from jsonb_array_elements(g) x),
    (select max((x ->> 'weight_covered')::numeric) from jsonb_array_elements(g) x);
end $$;

-- running the seed a second time must change nothing
\i seed.sql
select case when (select count(*) from classes) = 12 and (select count(*) from students) = 300
            then 'ok   seed is safe to run twice' else 'FAILED: second seed run changed the data' end;
\echo 'SEED CHECK PASSED'
