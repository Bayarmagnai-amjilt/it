-- =============================================================================
-- Tsahim Unaga — migration 7: quizzes (self-paced and live) and block games
--
-- Teachers write quizzes and run them as assignments or live games; students
-- answer through the server, which grades and times every answer. The correct
-- answer never leaves the database before the question is over for that student.
-- Block-game levels are seeded at the end (generated from lib/games/levels.ts).
-- Safe to run more than once.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 1. Columns and indexes
-- ----------------------------------------------------------------------------
-- which question a self-paced attempt is on and since when: the server times it
alter table attempts add column if not exists current_question_id uuid references questions (id) on delete set null;
alter table attempts add column if not exists current_started_at timestamptz;
create index if not exists quiz_assignments_quiz on quiz_assignments (quiz_id);
create index if not exists live_sessions_assignment on live_sessions (quiz_assignment_id);
create index if not exists attempts_assignment on attempts (quiz_assignment_id);

-- ----------------------------------------------------------------------------
-- 2. Question pictures: public bucket, files at '<teacher id>/<name>'
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quiz-media', 'quiz-media', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists quiz_media_select on storage.objects;
drop policy if exists quiz_media_insert on storage.objects;
drop policy if exists quiz_media_delete on storage.objects;
create policy quiz_media_select on storage.objects for select to authenticated
  using (bucket_id = 'quiz-media' and public.is_teacher() and (storage.foldername(name))[1] = auth.uid()::text);
create policy quiz_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'quiz-media' and public.is_teacher() and (storage.foldername(name))[1] = auth.uid()::text);
create policy quiz_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'quiz-media' and public.is_teacher() and (storage.foldername(name))[1] = auth.uid()::text);

-- ----------------------------------------------------------------------------
-- 3. Read access for teachers (all writes go through the functions below)
-- ----------------------------------------------------------------------------
drop policy if exists quizzes_select on quizzes;
create policy quizzes_select on quizzes for select to authenticated
  using (is_teacher() and (owner_teacher_id = auth.uid() or is_owner()));
drop policy if exists quiz_assignments_select on quiz_assignments;
create policy quiz_assignments_select on quiz_assignments for select to authenticated
  using (teaches_class(class_id));
drop policy if exists puzzle_levels_select on puzzle_levels;
create policy puzzle_levels_select on puzzle_levels for select to authenticated using (is_teacher());

-- ----------------------------------------------------------------------------
-- 4. Helpers
-- ----------------------------------------------------------------------------
-- Short answers: capital letters and spaces do not matter.
create or replace function normalize_answer(p text) returns text
language sql immutable set search_path = public as
$$ select lower(regexp_replace(coalesce(p, ''), '\s+', '', 'g')) $$;

-- Is a student's response right? Formats (content = what the student sees):
--   single_choice  key {"correct": id}            response {"choice": id}
--   multi_choice   key {"correct": [ids]}         response {"choices": [ids]}   (exactly those)
--   true_false     key {"correct": true|false}    response {"value": true|false}
--   short_answer   key {"accepted": [texts]}      response {"text": "..."}
--   ordering       key {"order": [ids]}           response {"order": [ids]}
--   matching       key {"pairs": {left: right}}   response {"pairs": {left: right}}
create or replace function grade_response(p_type question_type, p_key jsonb, p_response jsonb) returns boolean
language plpgsql immutable set search_path = public as $$
begin
  if p_key is null or p_response is null or jsonb_typeof(p_response) <> 'object' then
    return false;
  end if;
  case p_type
    when 'single_choice' then
      return coalesce(p_response ->> 'choice' = p_key ->> 'correct', false);
    when 'true_false' then
      return jsonb_typeof(p_response -> 'value') = 'boolean' and p_response -> 'value' = p_key -> 'correct';
    when 'multi_choice' then
      return jsonb_typeof(p_response -> 'choices') = 'array'
         and jsonb_typeof(p_key -> 'correct') = 'array'
         and (select coalesce(array_agg(x order by x), '{}') from (select distinct jsonb_array_elements_text(p_response -> 'choices') x) a)
           = (select coalesce(array_agg(x order by x), '{}') from (select distinct jsonb_array_elements_text(p_key -> 'correct') x) b);
    when 'short_answer' then
      return normalize_answer(p_response ->> 'text') <> ''
         and jsonb_typeof(p_key -> 'accepted') = 'array'
         and exists (select 1 from jsonb_array_elements_text(p_key -> 'accepted') a
                     where normalize_answer(a) = normalize_answer(p_response ->> 'text'));
    when 'ordering' then
      return jsonb_typeof(p_response -> 'order') = 'array' and p_response -> 'order' = p_key -> 'order';
    when 'matching' then
      return jsonb_typeof(p_response -> 'pairs') = 'object' and p_response -> 'pairs' = p_key -> 'pairs';
    else
      return false;
  end case;
end $$;

-- Live-game points for a right answer: faster = more (500 … 1000 per question point).
create or replace function game_points(p_points numeric, p_time_ms integer, p_limit_sec integer) returns integer
language sql immutable set search_path = public as $$
  select round(coalesce(p_points, 1) * case
           when p_limit_sec is null or p_limit_sec <= 0 then 1000
           else 500 + 500 * greatest(0, 1 - coalesce(p_time_ms, 0)::numeric / (p_limit_sec * 1000)) end)::integer
$$;

-- One question of a quiz as JSON; the answer key only when asked for.
create or replace function quiz_question_json(p_quiz_id uuid, p_question_id uuid, p_with_key boolean default false)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
           'id', q.id, 'type', q.type, 'position', qq.position,
           'prompt', q.prompt, 'content', q.content,
           'time_limit', coalesce(qq.time_limit_override, q.default_time_limit_sec),
           'points', coalesce(qq.points_override, q.default_points))
         || case when p_with_key
                 then jsonb_build_object('answer_key', k.answer_key, 'explanation', k.explanation)
                 else '{}'::jsonb end
    from quiz_questions qq
    join questions q on q.id = qq.question_id
    left join question_answer_keys k on k.question_id = q.id
   where qq.quiz_id = p_quiz_id and qq.question_id = p_question_id
$$;

create or replace function quiz_total_points(p_quiz_id uuid) returns numeric
language sql stable security definer set search_path = public as $$
  select coalesce(sum(coalesce(qq.points_override, q.default_points)), 0)
    from quiz_questions qq join questions q on q.id = qq.question_id
   where qq.quiz_id = p_quiz_id
$$;

-- Live leaderboard of one assignment: game points and right answers per player.
create or replace function live_scores(p_assignment_id uuid)
returns table (student_id uuid, name text, score bigint, correct bigint)
language sql stable security definer set search_path = public as $$
  select a.student_id,
         coalesce(s.family_initial || '. ', '') || s.first_name,
         coalesce(sum(case when an.is_correct
                           then game_points(coalesce(qq.points_override, q.default_points), an.time_ms,
                                            coalesce(qq.time_limit_override, q.default_time_limit_sec))
                           else 0 end), 0)::bigint,
         count(an.id) filter (where an.is_correct)
    from attempts a
    join quiz_assignments qa on qa.id = a.quiz_assignment_id
    join students s on s.id = a.student_id
    left join answers an on an.attempt_id = a.id
    left join quiz_questions qq on qq.quiz_id = qa.quiz_id and qq.question_id = an.question_id
    left join questions q on q.id = an.question_id
   where a.quiz_assignment_id = p_assignment_id
   group by a.student_id, s.family_initial, s.first_name
$$;

create or replace function leaderboard_json(p_assignment_id uuid, p_limit integer) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('student_id', x.student_id, 'name', x.name, 'score', x.score, 'correct', x.correct)
                            order by x.score desc, x.name), '[]'::jsonb)
    from (select * from live_scores(p_assignment_id) order by score desc, name limit p_limit) x
$$;

-- How the class answered one question: right/wrong counts, and picks per option.
create or replace function answer_distribution(p_assignment_id uuid, p_question_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with r as (
    select an.response, an.is_correct
      from answers an join attempts a on a.id = an.attempt_id
     where a.quiz_assignment_id = p_assignment_id and an.question_id = p_question_id)
  select jsonb_build_object(
    'correct', (select count(*) from r where is_correct),
    'wrong', (select count(*) from r where not coalesce(is_correct, false)),
    'picks', coalesce((
      select jsonb_object_agg(k, n) from (
        select k, count(*) as n from (
          select response ->> 'choice' as k from r where response ? 'choice'
          union all
          select jsonb_array_elements_text(response -> 'choices') from r where jsonb_typeof(response -> 'choices') = 'array'
          union all
          select response ->> 'value' from r where response ? 'value'
        ) x where k is not null group by k) y), '{}'::jsonb))
$$;

-- The student behind a live session cookie (no rows when the session is over).
create or replace function session_student(p_session_id uuid)
returns table (student_id uuid, class_id uuid, in_lesson boolean)
language sql stable security definer set search_path = public as $$
  select ss.student_id, ss.class_id, ss.lesson_session_id is not null
    from student_sessions ss
   where ss.id = p_session_id and ss.ended_at is null and ss.expires_at > now()
$$;

create or replace function can_edit_quiz(p_quiz_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from quizzes q
                 where q.id = p_quiz_id and q.archived_at is null and is_teacher()
                   and (q.owner_teacher_id = auth.uid() or is_owner()))
$$;

-- Closes a self-paced attempt: totals the points.
create or replace function attempt_finalize(p_attempt_id uuid) returns void
language sql security definer set search_path = public as $$
  update attempts a
     set status = 'submitted', submitted_at = now(), current_question_id = null,
         score = (select coalesce(sum(points_awarded), 0) from answers where attempt_id = a.id),
         max_score = quiz_total_points((select quiz_id from quiz_assignments where id = a.quiz_assignment_id))
   where a.id = p_attempt_id and a.status = 'in_progress'
$$;

-- Ends a live game and closes every player's attempt.
create or replace function live_finalize(p_live_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_assignment uuid;
begin
  update live_sessions set state = 'finished', finished_at = coalesce(finished_at, now())
   where id = p_live_id
   returning quiz_assignment_id into v_assignment;
  if v_assignment is null then
    return;
  end if;
  update quiz_assignments set closes_at = greatest(clock_timestamp(), opens_at + interval '1 millisecond') where id = v_assignment and (closes_at is null or closes_at > now());
  update attempts a
     set status = 'graded', submitted_at = coalesce(submitted_at, now()),
         score = (select coalesce(sum(points_awarded), 0) from answers where attempt_id = a.id),
         max_score = quiz_total_points((select quiz_id from quiz_assignments where id = v_assignment))
   where a.quiz_assignment_id = v_assignment and a.status = 'in_progress';
end $$;

-- ----------------------------------------------------------------------------
-- 5. Teacher functions (each checks the caller)
-- ----------------------------------------------------------------------------
-- Creates or replaces a quiz with its questions in one go.
-- p_quiz: {"title", "description", "grade", "questions": [{"id"?, "type", "prompt", "content",
--          "answer_key", "explanation", "time_limit", "points"}]}
create or replace function save_quiz(p_quiz_id uuid, p_quiz jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_quiz uuid := p_quiz_id;
  v_grade smallint;
  v_old uuid[] := '{}';
  v_keep uuid[] := '{}';
  v_qid uuid;
  v_pos integer := 0;
  v_limit integer;
  q jsonb;
begin
  if not is_teacher() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if nullif(trim(p_quiz ->> 'title'), '') is null then
    raise exception 'title_required' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_quiz -> 'questions') is distinct from 'array' or jsonb_array_length(p_quiz -> 'questions') = 0 then
    raise exception 'questions_required' using errcode = 'P0001';
  end if;
  v_grade := case when (p_quiz ->> 'grade') ~ '^[1-5]$' then (p_quiz ->> 'grade')::smallint end;

  if v_quiz is null then
    insert into quizzes (owner_teacher_id, title, description, grade)
    values (auth.uid(), left(trim(p_quiz ->> 'title'), 120), nullif(left(trim(p_quiz ->> 'description'), 500), ''), v_grade)
    returning id into v_quiz;
  else
    if not can_edit_quiz(v_quiz) then
      raise exception 'not_allowed' using errcode = '42501';
    end if;
    update quizzes
       set title = left(trim(p_quiz ->> 'title'), 120),
           description = nullif(left(trim(p_quiz ->> 'description'), 500), ''),
           grade = v_grade
     where id = v_quiz;
    v_old := array(select question_id from quiz_questions where quiz_id = v_quiz);
    delete from quiz_questions where quiz_id = v_quiz;
  end if;

  for q in select * from jsonb_array_elements(p_quiz -> 'questions') loop
    if (q ->> 'type') is null
       or (q ->> 'type') not in ('single_choice', 'multi_choice', 'true_false', 'short_answer', 'ordering', 'matching') then
      raise exception 'invalid' using errcode = 'P0001';
    end if;
    v_pos := v_pos + 1;
    v_limit := case when (q ->> 'time_limit') ~ '^\d{1,3}$' and (q ->> 'time_limit')::integer between 5 and 120
                    then (q ->> 'time_limit')::integer end;
    -- an existing row is reused only when it already belonged to this quiz
    v_qid := case when (q ->> 'id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                  then (q ->> 'id')::uuid end;
    if v_qid is not null and (v_qid = any(v_keep) or not (v_qid = any(v_old))) then
      v_qid := null;
    end if;
    if v_qid is null then
      insert into questions (owner_teacher_id, type, prompt, content, default_time_limit_sec, default_points,
                             shuffle_options, grade_from, grade_to)
      values (auth.uid(), (q ->> 'type')::question_type, coalesce(q -> 'prompt', '{}'), coalesce(q -> 'content', '{}'),
              v_limit, least(greatest(coalesce((q ->> 'points')::numeric, 1), 0), 100), false,
              coalesce(v_grade, 1), coalesce(v_grade, 5))
      returning id into v_qid;
    else
      update questions
         set type = (q ->> 'type')::question_type, prompt = coalesce(q -> 'prompt', '{}'),
             content = coalesce(q -> 'content', '{}'), default_time_limit_sec = v_limit,
             default_points = least(greatest(coalesce((q ->> 'points')::numeric, 1), 0), 100),
             grade_from = coalesce(v_grade, 1), grade_to = coalesce(v_grade, 5), updated_at = now()
       where id = v_qid;
    end if;
    insert into question_answer_keys (question_id, answer_key, explanation)
    values (v_qid, coalesce(q -> 'answer_key', '{}'), nullif(left(trim(q ->> 'explanation'), 1000), ''))
    on conflict (question_id) do update set answer_key = excluded.answer_key, explanation = excluded.explanation;
    insert into quiz_questions (quiz_id, question_id, position) values (v_quiz, v_qid, v_pos);
    v_keep := v_keep || v_qid;
  end loop;

  -- questions taken out of the quiz go away unless a student already answered them
  delete from questions qs
   where qs.id = any(v_old) and not (qs.id = any(v_keep))
     and not exists (select 1 from answers an where an.question_id = qs.id)
     and not exists (select 1 from quiz_questions qq where qq.question_id = qs.id);
  return v_quiz;
end $$;

-- Everything the editor and the quiz page need, answers included (teacher only).
create or replace function quiz_detail(p_quiz_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not can_edit_quiz(p_quiz_id) then
    return null;
  end if;
  return (
    select jsonb_build_object(
      'id', q.id, 'title', q.title, 'description', q.description, 'grade', q.grade, 'created_at', q.created_at,
      'questions', coalesce((
        select jsonb_agg(quiz_question_json(q.id, qq.question_id, true) order by qq.position)
          from quiz_questions qq where qq.quiz_id = q.id), '[]'::jsonb),
      'assignments', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', qa.id, 'mode', qa.mode, 'class_id', qa.class_id, 'class_name', c.name,
                 'created_at', qa.created_at, 'closes_at', qa.closes_at, 'max_attempts', qa.max_attempts,
                 'show_correct', qa.show_correct,
                 'live_id', ls.id, 'live_state', ls.state,
                 'players', (select count(distinct a.student_id) from attempts a where a.quiz_assignment_id = qa.id))
               order by qa.created_at desc)
          from quiz_assignments qa
          join classes c on c.id = qa.class_id
          left join live_sessions ls on ls.quiz_assignment_id = qa.id
         where qa.quiz_id = q.id and teaches_class(qa.class_id)), '[]'::jsonb))
      from quizzes q where q.id = p_quiz_id);
end $$;

-- The teacher's quizzes and the latest assignments of their classes.
create or replace function my_quizzes() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not is_teacher() then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'quizzes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', q.id, 'title', q.title, 'grade', q.grade, 'created_at', q.created_at,
               'questions', (select count(*) from quiz_questions qq where qq.quiz_id = q.id))
             order by q.created_at desc)
        from quizzes q
       where q.archived_at is null and (q.owner_teacher_id = auth.uid() or is_owner())), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(s.x order by s.created_at desc) from (
        select qa.created_at,
               jsonb_build_object(
                 'id', qa.id, 'quiz_id', qa.quiz_id, 'quiz_title', q.title, 'mode', qa.mode,
                 'class_name', c.name, 'created_at', qa.created_at, 'closes_at', qa.closes_at,
                 'live_id', ls.id, 'live_state', ls.state,
                 'players', (select count(distinct a.student_id) from attempts a where a.quiz_assignment_id = qa.id)) as x
          from quiz_assignments qa
          join quizzes q on q.id = qa.quiz_id
          join classes c on c.id = qa.class_id
          join school_years y on y.id = c.school_year_id and y.is_current
          left join live_sessions ls on ls.quiz_assignment_id = qa.id
         where teaches_class(qa.class_id)
         order by qa.created_at desc
         limit 30) s), '[]'::jsonb));
end $$;

-- "Delete" keeps results: the quiz is archived and its assignments are closed.
create or replace function archive_quiz(p_quiz_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  if not can_edit_quiz(p_quiz_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  for r in select ls.id from live_sessions ls join quiz_assignments qa on qa.id = ls.quiz_assignment_id
            where qa.quiz_id = p_quiz_id and ls.state <> 'finished' loop
    perform live_finalize(r.id);
  end loop;
  update quiz_assignments set closes_at = greatest(clock_timestamp(), opens_at + interval '1 millisecond') where quiz_id = p_quiz_id and (closes_at is null or closes_at > now());
  update quizzes set archived_at = now() where id = p_quiz_id;
end $$;

-- Gives a quiz to a class to take at their own pace (in class or at home).
create or replace function assign_quiz(
  p_quiz_id uuid, p_class_id uuid, p_closes_at timestamptz default null,
  p_max_attempts integer default null, p_show_correct text default 'after_submit'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_term uuid;
  v_id uuid;
begin
  if not can_edit_quiz(p_quiz_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform assert_teaches(p_class_id);
  v_term := current_term_id(local_today());
  if v_term is null then
    raise exception 'no_terms' using errcode = 'P0001';
  end if;
  if p_closes_at is not null and p_closes_at <= now() then
    raise exception 'invalid' using errcode = 'P0001';
  end if;
  insert into quiz_assignments (quiz_id, class_id, term_id, mode, opens_at, closes_at, max_attempts,
                                show_correct, leaderboard_enabled, counts_toward_grade, created_by)
  values (p_quiz_id, p_class_id, v_term, 'self_paced', now(), p_closes_at,
          case when p_max_attempts > 0 then least(p_max_attempts, 20) end,
          (case when p_show_correct in ('after_each', 'after_submit', 'never') then p_show_correct
                else 'after_submit' end)::show_correct_policy,
          false, false, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

create or replace function close_assignment(p_assignment_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_class uuid;
  r record;
begin
  select class_id into v_class from quiz_assignments where id = p_assignment_id;
  perform assert_teaches(v_class);
  for r in select id from live_sessions where quiz_assignment_id = p_assignment_id and state <> 'finished' loop
    perform live_finalize(r.id);
  end loop;
  update quiz_assignments set closes_at = greatest(clock_timestamp(), opens_at + interval '1 millisecond') where id = p_assignment_id and (closes_at is null or closes_at > now());
  for r in select id from attempts where quiz_assignment_id = p_assignment_id and status = 'in_progress' loop
    perform attempt_finalize(r.id);
  end loop;
end $$;

-- Starts a live game for a class: the lobby opens, and so does the class login.
create or replace function live_start(p_quiz_id uuid, p_class_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_term uuid;
  v_assignment uuid;
  v_live uuid;
  r record;
begin
  if not can_edit_quiz(p_quiz_id) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  perform assert_teaches(p_class_id);
  v_term := current_term_id(local_today());
  if v_term is null then
    raise exception 'no_terms' using errcode = 'P0001';
  end if;
  -- one live game per class at a time
  for r in select ls.id from live_sessions ls join quiz_assignments qa on qa.id = ls.quiz_assignment_id
            where qa.class_id = p_class_id and ls.state <> 'finished' loop
    perform live_finalize(r.id);
  end loop;
  insert into quiz_assignments (quiz_id, class_id, term_id, mode, opens_at, max_attempts, show_correct,
                                leaderboard_enabled, counts_toward_grade, created_by)
  values (p_quiz_id, p_class_id, v_term, 'live', now(), 1, 'after_each', true, false, auth.uid())
  returning id into v_assignment;
  insert into live_sessions (quiz_assignment_id, state, started_by)
  values (v_assignment, 'lobby', auth.uid())
  returning id into v_live;
  perform open_lesson(p_class_id);
  return v_live;
end $$;

-- p_action: 'next' (lobby -> question 1, question/reveal -> next question or the end),
--           'reveal' (show the answer), 'finish'.
create or replace function live_control(p_live_id uuid, p_action text) returns void
language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_total integer;
  v_next integer;
begin
  select ls.id, ls.state, ls.current_position, qa.class_id, qa.quiz_id into r
    from live_sessions ls join quiz_assignments qa on qa.id = ls.quiz_assignment_id
   where ls.id = p_live_id
     for update of ls;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  perform assert_teaches(r.class_id);
  if p_action = 'finish' then
    perform live_finalize(p_live_id);
    return;
  end if;
  if r.state = 'finished' then
    return;
  end if;
  if p_action = 'reveal' then
    if r.state = 'question' then
      update live_sessions set state = 'reveal' where id = p_live_id;
    end if;
  elsif p_action = 'next' then
    select count(*) into v_total from quiz_questions where quiz_id = r.quiz_id;
    v_next := case when r.state = 'lobby' then 1 else coalesce(r.current_position, 0) + 1 end;
    if v_next > v_total then
      perform live_finalize(p_live_id);
    else
      update live_sessions
         set state = 'question', current_position = v_next, question_started_at = now()
       where id = p_live_id;
    end if;
  else
    raise exception 'invalid' using errcode = 'P0001';
  end if;
end $$;

-- What the projector shows. The answer key is included only once it is revealed.
create or replace function live_host_state(p_live_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r record;
  v_qid uuid;
  v_q jsonb;
  v_total integer;
  v_limit integer;
begin
  select ls.*, qa.class_id, qa.quiz_id, q.title, c.name as class_name into r
    from live_sessions ls
    join quiz_assignments qa on qa.id = ls.quiz_assignment_id
    join quizzes q on q.id = qa.quiz_id
    join classes c on c.id = qa.class_id
   where ls.id = p_live_id;
  if not found or not teaches_class(r.class_id) then
    return null;
  end if;
  select count(*) into v_total from quiz_questions where quiz_id = r.quiz_id;
  select question_id into v_qid from quiz_questions where quiz_id = r.quiz_id and position = r.current_position;
  if v_qid is not null and r.state in ('question', 'reveal') then
    v_q := quiz_question_json(r.quiz_id, v_qid, r.state = 'reveal');
    v_limit := (v_q ->> 'time_limit')::integer;
  end if;
  return jsonb_build_object(
    'id', r.id, 'state', r.state, 'title', r.title, 'class_id', r.class_id, 'class_name', r.class_name,
    'assignment_id', r.quiz_assignment_id, 'position', r.current_position, 'total', v_total,
    'question', v_q,
    'remaining_ms', case when r.state = 'question' and v_limit is not null
                         then greatest(0, round(v_limit * 1000 - extract(epoch from now() - r.question_started_at) * 1000))
                    end,
    'players', coalesce((
      select jsonb_agg(coalesce(s.family_initial || '. ', '') || s.first_name order by a.started_at)
        from attempts a join students s on s.id = a.student_id
       where a.quiz_assignment_id = r.quiz_assignment_id), '[]'::jsonb),
    'answered', case when v_qid is null then 0 else (
      select count(*) from answers an join attempts a on a.id = an.attempt_id
       where a.quiz_assignment_id = r.quiz_assignment_id and an.question_id = v_qid) end,
    'distribution', case when r.state = 'reveal' then answer_distribution(r.quiz_assignment_id, v_qid) end,
    'top', case when r.state in ('reveal', 'finished') then leaderboard_json(r.quiz_assignment_id, 5) end);
end $$;

-- Results of one assignment: every question and every student of the class.
create or replace function quiz_results(p_assignment_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r record;
begin
  select qa.*, q.title, c.name as class_name into r
    from quiz_assignments qa
    join quizzes q on q.id = qa.quiz_id
    join classes c on c.id = qa.class_id
   where qa.id = p_assignment_id;
  if not found or not teaches_class(r.class_id) then
    return null;
  end if;
  return jsonb_build_object(
    'assignment', jsonb_build_object(
      'id', r.id, 'quiz_id', r.quiz_id, 'title', r.title, 'class_name', r.class_name, 'mode', r.mode,
      'created_at', r.created_at, 'closes_at', r.closes_at, 'max_attempts', r.max_attempts,
      'total_points', quiz_total_points(r.quiz_id)),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', qq.question_id, 'position', qq.position, 'type', qs.type,
               'text', qs.prompt ->> 'text',
               'points', coalesce(qq.points_override, qs.default_points),
               'answered', (select count(*) from answers an join attempts a on a.id = an.attempt_id
                             where a.quiz_assignment_id = r.id and an.question_id = qq.question_id),
               'correct', (select count(*) from answers an join attempts a on a.id = an.attempt_id
                            where a.quiz_assignment_id = r.id and an.question_id = qq.question_id and an.is_correct),
               'avg_time_ms', (select round(avg(an.time_ms)) from answers an join attempts a on a.id = an.attempt_id
                                where a.quiz_assignment_id = r.id and an.question_id = qq.question_id))
             order by qq.position)
        from quiz_questions qq join questions qs on qs.id = qq.question_id
       where qq.quiz_id = r.quiz_id), '[]'::jsonb),
    'students', coalesce((
      with att as (
        select a.id, a.student_id, a.status, a.submitted_at,
               (select coalesce(sum(points_awarded), 0) from answers where attempt_id = a.id) as score,
               (select count(*) from answers where attempt_id = a.id) as answered
          from attempts a where a.quiz_assignment_id = r.id),
      best as (
        select distinct on (student_id) * from att order by student_id, score desc, submitted_at desc nulls last),
      ids as (
        select e.student_id from enrollments e where e.class_id = r.class_id and e.ended_on is null
        union
        select att.student_id from att)
      select jsonb_agg(jsonb_build_object(
               'student_id', s.id, 'first_name', s.first_name, 'family_initial', s.family_initial,
               'attempts', (select count(*) from att where att.student_id = s.id),
               'score', b.score, 'answered', b.answered, 'status', b.status, 'submitted_at', b.submitted_at,
               'game_points', ls.score)
             order by s.first_name)
        from ids
        join students s on s.id = ids.student_id
        left join best b on b.student_id = s.id
        left join live_scores(r.id) ls on ls.student_id = s.id), '[]'::jsonb));
end $$;

-- Stars of every student of a class in every block-game level.
create or replace function class_puzzle_progress(p_class_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform assert_teaches(p_class_id);
  return jsonb_build_object(
    'levels', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'game', l.game, 'level', l.level_no, 'title', l.title)
                       order by l.game, l.level_no)
        from puzzle_levels l), '[]'::jsonb),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
               'student_id', s.id, 'first_name', s.first_name, 'family_initial', s.family_initial,
               'stars', coalesce((select jsonb_object_agg(ps.puzzle_level_id, ps.stars)
                                    from puzzle_solutions ps where ps.student_id = s.id), '{}'::jsonb))
             order by s.first_name)
        from enrollments e join students s on s.id = e.student_id
       where e.class_id = p_class_id and e.ended_on is null and s.status = 'active'), '[]'::jsonb));
end $$;

-- ----------------------------------------------------------------------------
-- 6. Student functions (secret key only; the student comes from the session)
-- ----------------------------------------------------------------------------
-- What the student home page offers: a live game of the class and open quizzes.
create or replace function student_activities(p_session_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v record;
begin
  select * into v from session_student(p_session_id);
  if not found then
    return null;
  end if;
  return jsonb_build_object(
    'live', (
      select jsonb_build_object('id', ls.id, 'state', ls.state, 'title', q.title)
        from live_sessions ls
        join quiz_assignments qa on qa.id = ls.quiz_assignment_id
        join quizzes q on q.id = qa.quiz_id
       where qa.class_id = v.class_id and ls.state <> 'finished' and ls.started_at > now() - interval '6 hours'
       order by ls.started_at desc
       limit 1),
    'quizzes', coalesce((
      select jsonb_agg(jsonb_build_object(
               'assignment_id', qa.id, 'title', q.title, 'closes_at', qa.closes_at, 'max_attempts', qa.max_attempts,
               'questions', (select count(*) from quiz_questions qq where qq.quiz_id = q.id),
               'total_points', quiz_total_points(q.id),
               'attempts', (select count(*) from attempts a where a.quiz_assignment_id = qa.id and a.student_id = v.student_id),
               'best', (select max(a.score) from attempts a
                         where a.quiz_assignment_id = qa.id and a.student_id = v.student_id and a.status <> 'in_progress'),
               'in_progress', exists (select 1 from attempts a
                                       where a.quiz_assignment_id = qa.id and a.student_id = v.student_id
                                         and a.status = 'in_progress'))
             order by qa.created_at desc)
        from quiz_assignments qa join quizzes q on q.id = qa.quiz_id
       where qa.class_id = v.class_id and qa.mode = 'self_paced' and q.archived_at is null
         and (qa.opens_at is null or qa.opens_at <= now())
         and (qa.closes_at is null or qa.closes_at > now())), '[]'::jsonb));
end $$;

-- Starts (or resumes) an attempt at a self-paced quiz.
-- Errors: no_session, not_found, closed, no_attempts_left.
create or replace function start_attempt(p_session_id uuid, p_assignment_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v record;
  r record;
  v_id uuid;
  v_count integer;
begin
  select * into v from session_student(p_session_id);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_session');
  end if;
  select qa.*, q.shuffle_questions into r
    from quiz_assignments qa join quizzes q on q.id = qa.quiz_id
   where qa.id = p_assignment_id and qa.class_id = v.class_id and qa.mode = 'self_paced' and q.archived_at is null;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if (r.opens_at is not null and r.opens_at > now()) or (r.closes_at is not null and r.closes_at <= now()) then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  select id into v_id from attempts
   where quiz_assignment_id = r.id and student_id = v.student_id and status = 'in_progress'
   order by attempt_no desc limit 1;
  if v_id is not null then
    return jsonb_build_object('ok', true, 'attempt_id', v_id);
  end if;
  select count(*) into v_count from attempts where quiz_assignment_id = r.id and student_id = v.student_id;
  if r.max_attempts is not null and v_count >= r.max_attempts then
    return jsonb_build_object('ok', false, 'error', 'no_attempts_left');
  end if;
  insert into attempts (quiz_assignment_id, student_id, attempt_no, question_order)
  values (r.id, v.student_id, v_count + 1, (
    select jsonb_agg(question_id order by case when r.shuffle_questions then random() else position end)
      from quiz_questions where quiz_id = r.quiz_id))
  returning id into v_id;
  return jsonb_build_object('ok', true, 'attempt_id', v_id);
end $$;

-- The next unanswered question (timed by the server), or the summary at the end.
create or replace function attempt_next(p_session_id uuid, p_attempt_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v record;
  r record;
  v_next uuid;
  v_started timestamptz;
  v_q jsonb;
  v_limit integer;
  v_done integer;
begin
  select * into v from session_student(p_session_id);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_session');
  end if;
  select a.*, qa.quiz_id, qa.show_correct, qa.closes_at, qz.title into r
    from attempts a
    join quiz_assignments qa on qa.id = a.quiz_assignment_id
    join quizzes qz on qz.id = qa.quiz_id
   where a.id = p_attempt_id and a.student_id = v.student_id and qa.mode = 'self_paced';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if r.status = 'in_progress' then
    if r.closes_at is null or r.closes_at > now() then
      select (e.value #>> '{}')::uuid into v_next
        from jsonb_array_elements(coalesce(r.question_order, '[]'::jsonb)) with ordinality as e(value, i)
       where exists (select 1 from quiz_questions qq
                      where qq.quiz_id = r.quiz_id and qq.question_id = (e.value #>> '{}')::uuid)
         and not exists (select 1 from answers an
                          where an.attempt_id = r.id and an.question_id = (e.value #>> '{}')::uuid)
       order by e.i
       limit 1;
      if v_next is not null then
        if r.current_question_id is distinct from v_next or r.current_started_at is null then
          update attempts set current_question_id = v_next, current_started_at = now() where id = r.id;
          v_started := now();
        else
          v_started := r.current_started_at;
        end if;
        v_q := quiz_question_json(r.quiz_id, v_next, false);
        v_limit := (v_q ->> 'time_limit')::integer;
        select count(*) into v_done from answers where attempt_id = r.id;
        return jsonb_build_object(
          'ok', true, 'done', false, 'title', r.title, 'index', v_done + 1,
          'total', (select count(*) from quiz_questions where quiz_id = r.quiz_id),
          'question', v_q,
          'remaining_ms', case when v_limit is not null
                               then greatest(0, round(v_limit * 1000 - extract(epoch from now() - v_started) * 1000)) end);
      end if;
    end if;
    perform attempt_finalize(r.id);
  end if;

  return (
    select jsonb_build_object(
      'ok', true, 'done', true, 'title', r.title, 'score', a.score, 'max_score', a.max_score,
      'correct', (select count(*) from answers where attempt_id = a.id and is_correct),
      'total', (select count(*) from quiz_questions where quiz_id = r.quiz_id),
      'review', case when r.show_correct in ('after_each', 'after_submit') then coalesce((
        select jsonb_agg(jsonb_build_object(
                 'question', quiz_question_json(r.quiz_id, an.question_id, true),
                 'response', an.response, 'correct', an.is_correct, 'points', an.points_awarded)
               order by qq.position)
          from answers an join quiz_questions qq on qq.quiz_id = r.quiz_id and qq.question_id = an.question_id
         where an.attempt_id = a.id), '[]'::jsonb) end)
      from attempts a where a.id = r.id);
end $$;

-- Grades one answer. Only the question being shown is accepted; a late answer
-- (time limit + 2 s for the network) is stored as wrong. Re-sends are idempotent.
create or replace function attempt_answer(
  p_session_id uuid, p_attempt_id uuid, p_question_id uuid, p_response jsonb, p_client_uuid uuid
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v record;
  r record;
  q jsonb;
  v_saved answers%rowtype;
  v_limit integer;
  v_elapsed numeric;
  v_late boolean;
  v_correct boolean;
begin
  select * into v from session_student(p_session_id);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_session');
  end if;
  if p_client_uuid is null or p_response is null or length(p_response::text) > 4000 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  select a.*, qa.quiz_id, qa.show_correct, qa.closes_at into r
    from attempts a join quiz_assignments qa on qa.id = a.quiz_assignment_id
   where a.id = p_attempt_id and a.student_id = v.student_id and qa.mode = 'self_paced'
     for update of a;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  if not exists (select 1 from answers where attempt_id = r.id and client_uuid = p_client_uuid) then
    if r.status <> 'in_progress' or (r.closes_at is not null and r.closes_at <= now()) then
      return jsonb_build_object('ok', false, 'error', 'closed');
    end if;
    if r.current_question_id is distinct from p_question_id then
      return jsonb_build_object('ok', false, 'error', 'stale');
    end if;
    q := quiz_question_json(r.quiz_id, p_question_id, true);
    if q is null then
      return jsonb_build_object('ok', false, 'error', 'stale');
    end if;
    v_limit := (q ->> 'time_limit')::integer;
    v_elapsed := extract(epoch from now() - coalesce(r.current_started_at, now())) * 1000;
    v_late := v_limit is not null and v_elapsed > v_limit * 1000 + 2000;
    v_correct := not v_late and grade_response((q ->> 'type')::question_type, q -> 'answer_key', p_response);
    insert into answers (attempt_id, question_id, response, is_correct, points_awarded, time_ms, client_uuid)
    values (r.id, p_question_id, p_response, v_correct,
            case when v_correct then (q ->> 'points')::numeric else 0 end,
            least(v_elapsed, 2147483647)::integer, p_client_uuid)
    on conflict do nothing;
  end if;

  select * into v_saved from answers where attempt_id = r.id and question_id = p_question_id;
  if not found then
    select * into v_saved from answers where attempt_id = r.id and client_uuid = p_client_uuid;
  end if;
  q := quiz_question_json(r.quiz_id, v_saved.question_id, true);
  v_limit := (q ->> 'time_limit')::integer;
  return jsonb_build_object(
           'ok', true, 'correct', coalesce(v_saved.is_correct, false), 'points', v_saved.points_awarded,
           'late', not coalesce(v_saved.is_correct, false) and v_limit is not null and v_saved.time_ms > v_limit * 1000 + 2000)
         || case when r.show_correct = 'after_each'
                 then jsonb_build_object('answer_key', q -> 'answer_key', 'explanation', q -> 'explanation')
                 else '{}'::jsonb end;
end $$;

-- Puts the student into a live game of their class.
create or replace function live_join(p_session_id uuid, p_live_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v record;
  r record;
begin
  select * into v from session_student(p_session_id);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_session');
  end if;
  select ls.state, ls.quiz_assignment_id, qa.quiz_id into r
    from live_sessions ls join quiz_assignments qa on qa.id = ls.quiz_assignment_id
   where ls.id = p_live_id and qa.class_id = v.class_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if r.state = 'finished' then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  insert into attempts (quiz_assignment_id, student_id, attempt_no, question_order)
  values (r.quiz_assignment_id, v.student_id, 1,
          (select jsonb_agg(question_id order by position) from quiz_questions where quiz_id = r.quiz_id))
  on conflict (quiz_assignment_id, student_id, attempt_no) do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- What one player's screen shows. The answer key comes only with the reveal.
create or replace function live_student_state(p_session_id uuid, p_live_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v record;
  r record;
  v_attempt uuid;
  v_qid uuid;
  v_q jsonb;
  v_limit integer;
  v_total integer;
  v_mine answers%rowtype;
  v_me record;
begin
  select * into v from session_student(p_session_id);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_session');
  end if;
  select ls.*, qa.quiz_id, q.title into r
    from live_sessions ls
    join quiz_assignments qa on qa.id = ls.quiz_assignment_id
    join quizzes q on q.id = qa.quiz_id
   where ls.id = p_live_id and qa.class_id = v.class_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  select id into v_attempt from attempts
   where quiz_assignment_id = r.quiz_assignment_id and student_id = v.student_id and attempt_no = 1;
  select count(*) into v_total from quiz_questions where quiz_id = r.quiz_id;
  select question_id into v_qid from quiz_questions where quiz_id = r.quiz_id and position = r.current_position;
  if v_qid is not null and r.state in ('question', 'reveal') then
    v_q := quiz_question_json(r.quiz_id, v_qid, r.state = 'reveal');
    v_limit := (v_q ->> 'time_limit')::integer;
    if v_attempt is not null then
      select * into v_mine from answers where attempt_id = v_attempt and question_id = v_qid;
    end if;
  end if;
  select x.score, x.rnk into v_me
    from (select student_id, score, rank() over (order by score desc) as rnk
            from live_scores(r.quiz_assignment_id)) x
   where x.student_id = v.student_id;
  return jsonb_build_object(
    'ok', true, 'state', r.state, 'title', r.title, 'position', r.current_position, 'total', v_total,
    'joined', v_attempt is not null,
    'question', v_q,
    'remaining_ms', case when r.state = 'question' and v_limit is not null
                         then greatest(0, round(v_limit * 1000 - extract(epoch from now() - r.question_started_at) * 1000)) end,
    'answered', v_mine.id is not null,
    'my_response', case when r.state = 'reveal' then v_mine.response end,
    'my_correct', case when r.state = 'reveal' and v_mine.id is not null then v_mine.is_correct end,
    'my_points', case when r.state = 'reveal' and v_mine.id is not null
                      then case when v_mine.is_correct
                                then game_points((v_q ->> 'points')::numeric, v_mine.time_ms, v_limit) else 0 end end,
    'score', coalesce(v_me.score, 0),
    'rank', v_me.rnk,
    'players', (select count(*) from attempts where quiz_assignment_id = r.quiz_assignment_id),
    'top', case when r.state in ('reveal', 'finished') then leaderboard_json(r.quiz_assignment_id, 5) end);
end $$;

-- One answer to the live question. The server checks the state and the clock;
-- the first answer counts. Whether it was right is told only at the reveal.
create or replace function live_answer(p_session_id uuid, p_live_id uuid, p_response jsonb, p_client_uuid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v record;
  r record;
  v_attempt uuid;
  v_qid uuid;
  q jsonb;
  v_limit integer;
  v_elapsed numeric;
  v_correct boolean;
begin
  select * into v from session_student(p_session_id);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_session');
  end if;
  if p_client_uuid is null or p_response is null or length(p_response::text) > 4000 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  select ls.*, qa.quiz_id into r
    from live_sessions ls join quiz_assignments qa on qa.id = ls.quiz_assignment_id
   where ls.id = p_live_id and qa.class_id = v.class_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  if r.state <> 'question' then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  insert into attempts (quiz_assignment_id, student_id, attempt_no, question_order)
  values (r.quiz_assignment_id, v.student_id, 1,
          (select jsonb_agg(question_id order by position) from quiz_questions where quiz_id = r.quiz_id))
  on conflict (quiz_assignment_id, student_id, attempt_no) do nothing;
  select id into v_attempt from attempts
   where quiz_assignment_id = r.quiz_assignment_id and student_id = v.student_id and attempt_no = 1;
  select question_id into v_qid from quiz_questions where quiz_id = r.quiz_id and position = r.current_position;
  q := quiz_question_json(r.quiz_id, v_qid, true);
  v_limit := (q ->> 'time_limit')::integer;
  v_elapsed := extract(epoch from now() - r.question_started_at) * 1000;
  if v_limit is not null and v_elapsed > v_limit * 1000 + 1500 then
    return jsonb_build_object('ok', false, 'error', 'closed');
  end if;
  v_correct := grade_response((q ->> 'type')::question_type, q -> 'answer_key', p_response);
  insert into answers (attempt_id, question_id, response, is_correct, points_awarded, time_ms, client_uuid)
  values (v_attempt, v_qid, p_response, v_correct,
          case when v_correct then (q ->> 'points')::numeric else 0 end,
          least(v_elapsed, 2147483647)::integer, p_client_uuid)
  on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

-- Stars the student already has in the block games.
create or replace function student_puzzle_progress(p_session_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v record;
begin
  select * into v from session_student(p_session_id);
  if not found then
    return null;
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('game', l.game, 'level', l.level_no, 'stars', ps.stars, 'blocks', ps.block_count))
      from puzzle_solutions ps join puzzle_levels l on l.id = ps.puzzle_level_id
     where ps.student_id = v.student_id), '[]'::jsonb);
end $$;

-- Saves a solved level. The server, not the browser, turns the block count into stars.
create or replace function save_puzzle_result(
  p_session_id uuid, p_game text, p_level integer, p_workspace jsonb, p_block_count integer
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v record;
  l puzzle_levels%rowtype;
  v_stars smallint;
begin
  select * into v from session_student(p_session_id);
  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_session');
  end if;
  if p_game is null or p_game not in ('maze', 'bird', 'turtle') or p_block_count is null
     or p_block_count < 0 or p_block_count > 500 or length(coalesce(p_workspace, '{}'::jsonb)::text) > 200000 then
    return jsonb_build_object('ok', false, 'error', 'invalid');
  end if;
  select * into l from puzzle_levels where game = p_game::puzzle_game and level_no = p_level;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;
  v_stars := case when p_block_count <= (l.config -> 'stars' ->> 'three')::integer then 3
                  when p_block_count <= (l.config -> 'stars' ->> 'two')::integer then 2
                  else 1 end;
  insert into puzzle_solutions (student_id, puzzle_level_id, workspace, block_count, stars)
  values (v.student_id, l.id, coalesce(p_workspace, '{}'::jsonb), p_block_count, v_stars)
  on conflict (student_id, puzzle_level_id) do update
     set workspace = excluded.workspace, block_count = excluded.block_count, stars = excluded.stars, solved_at = now()
   where excluded.stars > puzzle_solutions.stars
      or (excluded.stars = puzzle_solutions.stars and excluded.block_count < puzzle_solutions.block_count);
  insert into practice_sessions (student_id, class_id, kind, puzzle_level_id, stars, block_count, at_home)
  values (v.student_id, v.class_id, 'blocks', l.id, v_stars, p_block_count, not v.in_lesson);
  return jsonb_build_object('ok', true, 'stars', v_stars,
    'best', (select stars from puzzle_solutions where student_id = v.student_id and puzzle_level_id = l.id));
end $$;

-- ----------------------------------------------------------------------------
-- 7. Who may call what (same rule as migration 2: closed first, opened by name)
-- ----------------------------------------------------------------------------
do $$
declare
  f text;
begin
  foreach f in array array[
    'normalize_answer(text)', 'grade_response(question_type, jsonb, jsonb)', 'game_points(numeric, integer, integer)',
    'quiz_question_json(uuid, uuid, boolean)', 'quiz_total_points(uuid)', 'live_scores(uuid)',
    'leaderboard_json(uuid, integer)', 'answer_distribution(uuid, uuid)', 'session_student(uuid)',
    'can_edit_quiz(uuid)', 'attempt_finalize(uuid)', 'live_finalize(uuid)',
    'student_activities(uuid)', 'start_attempt(uuid, uuid)', 'attempt_next(uuid, uuid)',
    'attempt_answer(uuid, uuid, uuid, jsonb, uuid)', 'live_join(uuid, uuid)', 'live_student_state(uuid, uuid)',
    'live_answer(uuid, uuid, jsonb, uuid)', 'student_puzzle_progress(uuid)',
    'save_puzzle_result(uuid, text, integer, jsonb, integer)',
    'save_quiz(uuid, jsonb)', 'quiz_detail(uuid)', 'my_quizzes()', 'archive_quiz(uuid)',
    'assign_quiz(uuid, uuid, timestamptz, integer, text)', 'close_assignment(uuid)', 'live_start(uuid, uuid)',
    'live_control(uuid, text)', 'live_host_state(uuid)', 'quiz_results(uuid)', 'class_puzzle_progress(uuid)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
  -- teacher functions: each one checks the caller itself
  foreach f in array array[
    'save_quiz(uuid, jsonb)', 'quiz_detail(uuid)', 'my_quizzes()', 'archive_quiz(uuid)',
    'assign_quiz(uuid, uuid, timestamptz, integer, text)', 'close_assignment(uuid)', 'live_start(uuid, uuid)',
    'live_control(uuid, text)', 'live_host_state(uuid)', 'quiz_results(uuid)', 'class_puzzle_progress(uuid)'
  ] loop
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- 8. Block-game levels (generated from lib/games/levels.ts)
-- ----------------------------------------------------------------------------
insert into puzzle_levels (game, level_no, title, concept, config, optimal_blocks) values
  ('maze', 1, 'Анхны алхам', 'sequence', '{"stars":{"three":2,"two":3}}', 2),
  ('maze', 2, 'Булан тойрох', 'sequence', '{"stars":{"three":5,"two":7}}', 5),
  ('maze', 3, 'Ухрах', 'sequence', '{"stars":{"three":3,"two":5}}', 3),
  ('maze', 4, 'Тахир зам', 'sequence', '{"stars":{"three":9,"two":12}}', 9),
  ('maze', 5, 'Урт тал', 'loop', '{"stars":{"three":2,"two":4}}', 2),
  ('maze', 6, 'Шат', 'loop', '{"stars":{"three":5,"two":7}}', 5),
  ('maze', 7, 'Гэр хүртэл', 'loop', '{"stars":{"three":2,"two":3}}', 2),
  ('maze', 8, 'Баруун эргэлт', 'condition', '{"stars":{"three":4,"two":5}}', 4),
  ('maze', 9, 'Эсвэл', 'condition', '{"stars":{"three":4,"two":6}}', 4),
  ('maze', 10, 'Ороомог зам', 'condition', '{"stars":{"three":6,"two":8}}', 6),
  ('maze', 11, 'Функц', 'function', '{"stars":{"three":10,"two":13}}', 10),
  ('maze', 12, 'Эргэлдэх зам', 'variable', '{"stars":{"three":7,"two":9}}', 7),
  ('bird', 1, 'Баруун тийш', 'sequence', '{"stars":{"three":1,"two":2}}', 1),
  ('bird', 2, 'Ташуу нислэг', 'sequence', '{"stars":{"three":1,"two":2}}', 1),
  ('bird', 3, 'Эхлээд жимс', 'condition', '{"stars":{"three":4,"two":5}}', 4),
  ('bird', 4, 'Ханын дээгүүр', 'condition', '{"stars":{"three":8,"two":10}}', 8),
  ('bird', 5, 'Хоёр жимс', 'condition', '{"stars":{"three":8,"two":10}}', 8),
  ('bird', 6, 'Тойрог зам', 'condition', '{"stars":{"three":8,"two":10}}', 8),
  ('turtle', 1, 'Шулуун', 'sequence', '{"stars":{"three":1,"two":2}}', 1),
  ('turtle', 2, 'Булан', 'sequence', '{"stars":{"three":3,"two":4}}', 3),
  ('turtle', 3, 'Дөрвөлжин', 'loop', '{"stars":{"three":3,"two":5}}', 3),
  ('turtle', 4, 'Тасархай зураас', 'loop', '{"stars":{"three":5,"two":7}}', 5),
  ('turtle', 5, 'Гурвалжин', 'loop', '{"stars":{"three":3,"two":5}}', 3),
  ('turtle', 6, 'Байшин', 'sequence', '{"stars":{"three":9,"two":11}}', 9),
  ('turtle', 7, 'Од', 'loop', '{"stars":{"three":3,"two":5}}', 3),
  ('turtle', 8, 'Нар', 'loop', '{"stars":{"three":3,"two":5}}', 3),
  ('turtle', 9, 'Цэцэг', 'loop', '{"stars":{"three":5,"two":7}}', 5),
  ('turtle', 10, 'Ороомог', 'variable', '{"stars":{"three":6,"two":8}}', 6)
on conflict (game, level_no) do update
  set title = excluded.title, concept = excluded.concept,
      config = excluded.config, optimal_blocks = excluded.optimal_blocks;
