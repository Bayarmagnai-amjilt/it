-- =============================================================================
-- Tsahim Unaga — demo data (optional)
--
-- 12 classes x 25 fictional students, a weekly timetable, four weeks of
-- attendance, the prompt's example grading weights and two scored pieces of work.
-- Run once after the three migrations. Running it again does nothing: it stops
-- when classes already exist. All names are invented.
-- =============================================================================
do $$
declare
  v_today date := local_today();
  v_y integer := case when extract(month from local_today()) >= 8
                      then extract(year from local_today())::integer
                      else extract(year from local_today())::integer - 1 end;
  v_year uuid;
  v_term uuid;
  v_class uuid;
  v_student uuid;
  v_lesson uuid;
  v_comp uuid;
  v_item_part uuid;
  v_item_quiz uuid;
  class_defs text[][] := array[
    ['1', 'А', '#F59E0B', 'camel_calf'], ['1', 'Б', '#EF4444', 'foal'],
    ['2', 'А', '#10B981', 'lamb'],       ['2', 'Б', '#3B82F6', 'kid'],
    ['3', 'А', '#8B5CF6', 'calf'],       ['3', 'Б', '#EC4899', 'puppy'],
    ['4', 'А', '#14B8A6', 'marmot'],     ['4', 'Б', '#F97316', 'eagle'],
    ['4', 'В', '#6366F1', 'deer'],       ['5', 'А', '#84CC16', 'rabbit'],
    ['5', 'Б', '#06B6D4', 'fox'],        ['5', 'В', '#D946EF', 'swan']];
  boys text[] := array['Тэмүүлэн', 'Билгүүн', 'Ананд', 'Тэнүүн', 'Хүслэн', 'Эрхэс', 'Ирмүүн', 'Дөлгөөн',
    'Төгөлдөр', 'Тэргэл', 'Жавхлан', 'Тамир', 'Тулга', 'Цэлмэг', 'Золбоо', 'Өлзий', 'Мөнх-Эрдэнэ',
    'Сод-Эрдэнэ', 'Амин-Эрдэнэ', 'Билгүүдэй', 'Ганбат', 'Наранбаатар', 'Үүрээ', 'Чингүүн', 'Эрдэм'];
  girls text[] := array['Анужин', 'Номин', 'Мишээл', 'Марал', 'Сувд', 'Уянга', 'Хулан', 'Номуун', 'Сарнай',
    'Энэрэл', 'Мөнхзул', 'Нандин', 'Эгшиглэн', 'Оюу', 'Ариунзаяа', 'Энхжин', 'Гэрэлмаа', 'Одгэрэл',
    'Баясгалан', 'Яргуй', 'Цэцэг', 'Үүрийнтуяа', 'Өнөржаргал', 'Тэмүүжин', 'Гоомарал'];
  initials text[] := array['А', 'Б', 'Г', 'Д', 'Ж', 'Л', 'М', 'Н', 'О', 'Ө', 'П', 'С', 'Т', 'У', 'Ү', 'Х', 'Ц', 'Ч', 'Ш', 'Э'];
  i integer;
  j integer;
  d date;
  wd1 integer;
  wd2 integer;
  slot integer;
  t_start time;
  ts_start timestamptz;
  r double precision;
  v_status attendance_status;
begin
  if exists (select 1 from classes) then
    raise notice 'Seed skipped: classes already exist.';
    return;
  end if;
  perform setseed(0.42);

  -- school year and four terms (placeholder dates: adjust them in Settings)
  select id into v_year from school_years where is_current;
  if v_year is null then
    insert into school_years (name, starts_on, ends_on, is_current)
    values (v_y || '-' || (v_y + 1), make_date(v_y, 9, 1), make_date(v_y + 1, 6, 1), true)
    returning id into v_year;
  end if;
  if not exists (select 1 from terms where school_year_id = v_year) then
    insert into terms (school_year_id, name, starts_on, ends_on, sort_order) values
      (v_year, '1-р улирал', make_date(v_y, 9, 1),      make_date(v_y, 10, 30),    1),
      (v_year, '2-р улирал', make_date(v_y, 11, 2),     make_date(v_y, 12, 25),    2),
      (v_year, '3-р улирал', make_date(v_y + 1, 1, 18), make_date(v_y + 1, 3, 19), 3),
      (v_year, '4-р улирал', make_date(v_y + 1, 3, 29), make_date(v_y + 1, 6, 1),  4);
  end if;
  v_term := current_term_id(v_today);

  insert into topics (name, sort_order) values
    ('Компьютерийн эд анги', 1), ('Оролт гаралтын төхөөрөмж', 2),
    ('Гарын товчлуур', 3), ('Интернэтийн аюулгүй байдал', 4)
  on conflict (name) do nothing;

  for i in 1 .. array_length(class_defs, 1) loop
    insert into classes (school_year_id, grade, section, color, animal_icon)
    values (v_year, class_defs[i][1]::smallint, class_defs[i][2], class_defs[i][3], class_defs[i][4])
    returning id into v_class;
    insert into class_practice_settings (class_id) values (v_class);

    -- timetable: two lessons a week
    wd1 := ((i - 1) % 5) + 1;
    wd2 := ((i + 1) % 5) + 1;
    slot := (i - 1) % 4;
    t_start := time '08:00' + make_interval(mins => slot * 50);
    insert into class_schedule_slots (class_id, weekday, starts_at, ends_at) values
      (v_class, wd1, t_start, t_start + interval '40 minutes'),
      (v_class, wd2, t_start, t_start + interval '40 minutes');

    -- 25 students, enrolled since the first school day
    for j in 1 .. 25 loop
      insert into students (first_name, family_initial, gender)
      values (
        case when j % 2 = 1 then boys[((i * 7 + j * 3) % array_length(boys, 1)) + 1]
             else girls[((i * 5 + j * 3) % array_length(girls, 1)) + 1] end,
        initials[((i * 5 + j * 11) % array_length(initials, 1)) + 1],
        case when j % 2 = 1 then 'male' else 'female' end)
      returning id into v_student;
      insert into enrollments (student_id, class_id, school_year_id, started_on)
      values (v_student, v_class, v_year, make_date(v_y, 9, 1));
    end loop;

    -- 4Б gets two students with the same first name, told apart by the initial
    if class_defs[i][1] = '4' and class_defs[i][2] = 'Б' then
      update students s set first_name = 'Тэмүүлэн', family_initial = x.ini, gender = 'male'
        from (select e.student_id, (array['Б', 'Д'])[(row_number() over (order by e.student_id))::integer] as ini
                from enrollments e where e.class_id = v_class
               order by e.student_id limit 2) x
       where s.id = x.student_id;
    end if;

    -- lessons and attendance for the last four weeks (up to yesterday)
    for d in select generate_series(v_today - 28, v_today - 1, interval '1 day')::date loop
      continue when extract(isodow from d)::integer not in (wd1, wd2);
      continue when not exists (
        select 1 from terms t where t.school_year_id = v_year and d between t.starts_on and t.ends_on);
      ts_start := (d + t_start) at time zone 'Asia/Ulaanbaatar';
      insert into lesson_sessions (class_id, term_id, held_on, period, starts_at, ends_at, opened_at, closed_at)
      values (v_class, current_term_id(d), d, 1, ts_start, ts_start + interval '40 minutes',
              ts_start, ts_start + interval '40 minutes')
      returning id into v_lesson;
      for v_student in select e.student_id from enrollments e where e.class_id = v_class loop
        r := random();
        v_status := case when r < 0.88 then 'present' when r < 0.93 then 'late'
                         when r < 0.97 then 'absent' when r < 0.99 then 'excused' else 'sick' end;
        insert into attendance (lesson_session_id, student_id, status, confirmed_at)
        values (v_lesson, v_student, v_status, ts_start + interval '5 minutes');
      end loop;
    end loop;

    -- grading setup: the example weights of the prompt (they add up to 100)
    insert into grade_components (class_id, term_id, name, weight, source, missing_policy, sort_order) values
      (v_class, v_term, 'Ирц',                10, 'attendance', 'zero',    1),
      (v_class, v_term, 'Явцын шалгалт',      30, 'quiz',       'zero',    2),
      (v_class, v_term, 'Scratch даалгавар',  20, 'scratch',    'zero',    3),
      (v_class, v_term, 'Өдөр тутмын дасгал', 10, 'practice',   'exclude', 4),
      (v_class, v_term, 'Идэвх оролцоо',      10, 'manual',     'zero',    5),
      (v_class, v_term, 'Улирлын шалгалт',    20, 'quiz',       'zero',    6);

    select id into v_comp from grade_components
     where class_id = v_class and term_id = v_term and name = 'Идэвх оролцоо';
    insert into grade_items (component_id, title, max_score, held_on)
    values (v_comp, 'Идэвх оролцоо (эхний 2 долоо хоног)', 10, v_today - 3)
    returning id into v_item_part;

    select id into v_comp from grade_components
     where class_id = v_class and term_id = v_term and name = 'Явцын шалгалт';
    insert into grade_items (component_id, title, max_score, held_on)
    values (v_comp, 'Компьютерийн эд анги (сорил)', 20, v_today - 7)
    returning id into v_item_quiz;

    for v_student in select e.student_id from enrollments e where e.class_id = v_class loop
      insert into scores (grade_item_id, student_id, score) values (v_item_part, v_student, 6 + floor(random() * 5));
      if random() > 0.04 then   -- a few students have not handed the quiz in
        insert into scores (grade_item_id, student_id, score) values (v_item_quiz, v_student, 8 + floor(random() * 13));
      end if;
    end loop;
  end loop;

  raise notice 'Seed done: % classes, % students, % lessons, % attendance rows.',
    (select count(*) from classes), (select count(*) from students),
    (select count(*) from lesson_sessions), (select count(*) from attendance);
end $$;
