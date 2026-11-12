-- =============================================================================
-- Tsahim Unaga — complete database setup in one file
--
-- How to use: Supabase Dashboard -> SQL Editor -> New query -> paste this whole
-- file -> Run. Run it ONCE, on a new project. (Demo data: run seed.sql after it.)
--
-- This file is generated from supabase/migrations/*.sql by build_all_in_one.sh.
-- Do not edit it by hand.
-- =============================================================================

-- >>>>>>>>>> migrations/20261112000001_schema.sql
-- =============================================================================
-- Tsahim Unaga ("Цахим Унага") — migration 1 of 3: tables, types, constraints
-- Target: Supabase (PostgreSQL 15+).
--
-- Conventions:
--   * Identifiers and comments are English; user-facing text is Mongolian and
--     lives in locales/mn.ts (labels a teacher can edit are stored as data).
--   * RLS is ENABLED on every table at the bottom of this file. With no policy a
--     table is readable only by the server (secret key). Policies: migration 3.
--   * Tables marked [NEW] are not in the original prompt's table list.
--   * Student personal data is limited to: first name, family initial, class.
-- =============================================================================

-- ----------------------------------------------------------------------------
-- Enumerated types
-- ----------------------------------------------------------------------------
create type teacher_role          as enum ('owner', 'teacher');
create type class_status          as enum ('active', 'archived');
create type student_status        as enum ('active', 'transferred', 'graduated');
create type enrollment_end_reason as enum ('transfer', 'promotion', 'graduation', 'left');
create type session_end_reason    as enum ('logout', 'replaced', 'lesson_end', 'teacher_kick', 'expired');
create type attendance_status     as enum ('present', 'late', 'absent', 'excused', 'sick');
create type excused_policy        as enum ('count_present', 'exclude');
create type component_source      as enum ('attendance', 'quiz', 'scratch', 'practice', 'lesson', 'manual');
create type missing_policy        as enum ('zero', 'exclude');
create type question_type         as enum (
  'single_choice', 'multi_choice', 'true_false', 'fill_blank', 'matching', 'ordering',
  'categorize', 'hotspot', 'flashcard', 'memory_pairs', 'short_answer', 'open_ended');
create type media_kind            as enum ('image', 'audio', 'video_link', 'file');
create type quiz_mode             as enum ('live', 'self_paced', 'practice');
create type show_correct_policy   as enum ('after_each', 'after_submit', 'after_close', 'never');
create type attempt_status        as enum ('in_progress', 'submitted', 'graded');
create type live_state            as enum ('lobby', 'question', 'reveal', 'finished');
create type practice_kind         as enum ('typing', 'blocks', 'mouse', 'daily_quiz');
create type typing_level          as enum ('home_row', 'all_letters', 'words', 'sentences', 'proverbs');
create type puzzle_game           as enum ('maze', 'turtle', 'herder');
create type lesson_template       as enum (
  'characters', 'explore', 'sort', 'assemble', 'riddle', 'flow',
  'custom_sort', 'custom_hotspot', 'custom_steps');
create type progress_status       as enum ('not_started', 'in_progress', 'completed');
create type avatar_slot           as enum ('deel', 'hat', 'boots', 'mount');
create type wrestling_title       as enum ('nachin', 'khartsaga', 'zaan', 'garid', 'arslan', 'avarga');

-- ----------------------------------------------------------------------------
-- 1. People, classes, school calendar
-- ----------------------------------------------------------------------------
create table teachers (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null,
  email       text not null unique,
  role        teacher_role not null default 'teacher',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table school_years (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,               -- e.g. '2026-2027'
  starts_on   date not null,
  ends_on     date not null,
  is_current  boolean not null default false,
  archived_at timestamptz,
  check (ends_on > starts_on)
);
create unique index school_years_one_current on school_years (is_current) where is_current;

create table terms (
  id             uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references school_years (id) on delete cascade,
  name           text not null,
  starts_on      date not null,
  ends_on        date not null,
  sort_order     smallint not null default 1,
  unique (school_year_id, name),
  check (ends_on > starts_on)
);

create table classes (
  id                       uuid primary key default gen_random_uuid(),
  school_year_id           uuid not null references school_years (id) on delete restrict,
  grade                    smallint not null check (grade between 1 and 5),
  section                  text not null,                         -- 'А', 'Б', 'В' ...
  name                     text generated always as (grade::text || section) stored,  -- '4Б'
  color                    text not null default '#F59E0B',
  animal_icon              text not null default 'foal',
  homeroom_teacher_name    text,
  status                   class_status not null default 'active',
  -- login settings (prompt section 2)
  class_code               text not null unique
                             default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  picture_password_enabled boolean not null default false,
  home_practice_enabled    boolean not null default false,
  -- attendance settings (prompt section 5)
  late_after_minutes       smallint not null default 10 check (late_after_minutes >= 0),
  late_coefficient         numeric(3,2) not null default 0.50
                             check (late_coefficient between 0 and 1),
  excused_policy           excused_policy not null default 'exclude',
  -- grade visibility (prompt section 6)
  show_grades_to_students  boolean not null default false,
  created_at               timestamptz not null default now(),
  unique (school_year_id, grade, section),
  -- home practice is only allowed when the picture password is on
  check (not home_practice_enabled or picture_password_enabled)
);

-- [NEW] which teacher works with which class (owner / teacher permissions)
create table class_teachers (
  class_id   uuid not null references classes (id) on delete cascade,
  teacher_id uuid not null references teachers (id) on delete cascade,
  primary key (class_id, teacher_id)
);

-- [NEW] weekly timetable; feeds "today's schedule" and practice target days
create table class_schedule_slots (
  id        uuid primary key default gen_random_uuid(),
  class_id  uuid not null references classes (id) on delete cascade,
  weekday   smallint not null check (weekday between 1 and 7),   -- 1 = Monday
  starts_at time not null,
  ends_at   time not null,
  room      text,
  check (ends_at > starts_at)
);

create table students (
  id                      uuid primary key default gen_random_uuid(),
  first_name              text not null,
  family_initial          text,                                   -- 'Б' in 'Б. Тэмүүлэн'
  gender                  text check (gender in ('male', 'female')),
  avatar                  jsonb not null default '{}'::jsonb,     -- base look + equipped items
  picture_password_hash   text,
  picture_password_set_at timestamptz,
  status                  student_status not null default 'active',
  created_at              timestamptz not null default now()
);

-- [NEW] student <-> class per school year; keeps history on transfer and promotion
create table enrollments (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid not null references students (id) on delete cascade,
  class_id       uuid not null references classes (id) on delete restrict,
  school_year_id uuid not null references school_years (id) on delete restrict,
  started_on     date not null default current_date,
  ended_on       date,
  end_reason     enrollment_end_reason,
  check ((ended_on is null) = (end_reason is null)),
  check (ended_on is null or ended_on >= started_on)
);
create unique index enrollments_one_current on enrollments (student_id) where ended_on is null;
create index enrollments_class_current on enrollments (class_id) where ended_on is null;

-- [NEW] private teacher notes on a student's profile page
create table teacher_notes (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references students (id) on delete cascade,
  teacher_id uuid not null references teachers (id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. Lessons, student sessions, attendance
-- ----------------------------------------------------------------------------
create table lesson_sessions (
  id         uuid primary key default gen_random_uuid(),
  class_id   uuid not null references classes (id) on delete cascade,
  term_id    uuid not null references terms (id) on delete restrict,
  held_on    date not null,
  period     smallint not null default 1,
  starts_at  timestamptz,
  ends_at    timestamptz,
  opened_at  timestamptz,          -- teacher pressed "start lesson": class login is open
  closed_at  timestamptz,          -- lesson ended: students are logged out
  created_by uuid references teachers (id) on delete set null,
  unique (class_id, held_on, period)
);

-- [NEW] one row per student login; drives auto-attendance and single-device rule
create table student_sessions (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references students (id) on delete cascade,
  class_id          uuid not null references classes (id) on delete cascade,
  lesson_session_id uuid references lesson_sessions (id) on delete set null,  -- null = at home
  device_label      text,
  started_at        timestamptz not null default now(),
  last_seen_at      timestamptz not null default now(),
  expires_at        timestamptz not null,
  ended_at          timestamptz,
  end_reason        session_end_reason,
  check ((ended_at is null) = (end_reason is null))
);
-- a student can be logged in on one device only
create unique index student_sessions_one_active on student_sessions (student_id) where ended_at is null;
create index student_sessions_lesson on student_sessions (lesson_session_id);

-- [NEW] picture-password attempts, used for rate limiting
create table login_attempts (
  id         bigint generated always as identity primary key,
  student_id uuid references students (id) on delete cascade,
  class_id   uuid references classes (id) on delete cascade,
  ip_hash    text,
  succeeded  boolean not null,
  created_at timestamptz not null default now()
);
create index login_attempts_student_time on login_attempts (student_id, created_at desc);

create table attendance (
  id                uuid primary key default gen_random_uuid(),
  lesson_session_id uuid not null references lesson_sessions (id) on delete cascade,
  student_id        uuid not null references students (id) on delete cascade,
  status            attendance_status not null default 'present',
  note              text,
  is_auto_suggested boolean not null default false,
  confirmed_at      timestamptz,
  updated_by        uuid references teachers (id) on delete set null,
  updated_at        timestamptz not null default now(),
  unique (lesson_session_id, student_id)
);
create index attendance_student on attendance (student_id);

-- ----------------------------------------------------------------------------
-- 3. Grading
-- ----------------------------------------------------------------------------
-- [NEW] letter bands; class_id null = school default, a class may override
create table grade_scale_bands (
  id              uuid primary key default gen_random_uuid(),
  class_id        uuid references classes (id) on delete cascade,
  min_percent     numeric(5,2) not null check (min_percent between 0 and 100),
  letter          text not null,
  teacher_label   text not null,
  stars           smallint not null check (stars between 1 and 5),
  student_message text not null,
  unique nulls not distinct (class_id, letter),
  unique nulls not distinct (class_id, min_percent)
);

create table grade_components (
  id             uuid primary key default gen_random_uuid(),
  class_id       uuid not null references classes (id) on delete cascade,
  term_id        uuid not null references terms (id) on delete cascade,
  name           text not null,
  weight         numeric(5,2) not null check (weight > 0 and weight <= 100),
  source         component_source not null default 'manual',
  missing_policy missing_policy not null default 'zero',
  sort_order     smallint not null default 1,
  unique (class_id, term_id, name)
);

-- Weights of one class in one term must add up to exactly 100.
-- Deferred: checked at COMMIT, so several rows can change in one transaction.
create function check_component_weights() returns trigger
language plpgsql set search_path = public as $$
declare
  v_class uuid;
  v_term  uuid;
  v_total numeric;
begin
  if tg_op = 'DELETE' then
    v_class := old.class_id; v_term := old.term_id;
  else
    v_class := new.class_id; v_term := new.term_id;
  end if;
  select coalesce(sum(weight), 0) into v_total
    from grade_components where class_id = v_class and term_id = v_term;
  if v_total <> 100 and v_total <> 0 then
    raise exception 'grade component weights sum to %, expected 100', v_total
      using errcode = '23514';
  end if;
  return null;
end $$;

create constraint trigger grade_components_weights_sum
  after insert or update or delete on grade_components
  deferrable initially deferred
  for each row execute function check_component_weights();

create table grade_items (
  id           uuid primary key default gen_random_uuid(),
  component_id uuid not null references grade_components (id) on delete cascade,
  title        text not null,
  max_score    numeric(7,2) not null check (max_score > 0),
  item_weight  numeric(5,2) not null default 1 check (item_weight > 0),
  held_on      date,
  source_type  text check (source_type in ('quiz_assignment', 'scratch_assignment', 'lesson')),
  source_id    uuid,
  created_at   timestamptz not null default now(),
  check ((source_type is null) = (source_id is null))
);

create table scores (
  id            uuid primary key default gen_random_uuid(),
  grade_item_id uuid not null references grade_items (id) on delete cascade,
  student_id    uuid not null references students (id) on delete cascade,
  score         numeric(7,2) check (score >= 0),     -- null = not submitted
  is_excused    boolean not null default false,
  entered_by    uuid references teachers (id) on delete set null,
  updated_at    timestamptz not null default now(),
  unique (grade_item_id, student_id)
);
create index scores_student on scores (student_id);

-- [NEW] final grades are computed live; a frozen copy is taken when a term is closed
create table term_grade_snapshots (
  id            uuid primary key default gen_random_uuid(),
  term_id       uuid not null references terms (id) on delete cascade,
  class_id      uuid not null references classes (id) on delete cascade,
  student_id    uuid not null references students (id) on delete cascade,
  final_percent numeric(5,2) not null,
  letter        text not null,
  breakdown     jsonb not null,
  taken_at      timestamptz not null default now(),
  unique (term_id, student_id)
);

-- ----------------------------------------------------------------------------
-- 4. Question bank, quizzes, attempts
-- ----------------------------------------------------------------------------
-- [NEW] fixed topic list; makes the class x topic heatmap reliable
create table topics (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  grade_from smallint not null default 1 check (grade_from between 1 and 5),
  grade_to   smallint not null default 5 check (grade_to between 1 and 5),
  sort_order smallint not null default 1,
  check (grade_to >= grade_from)
);

-- [NEW] images, teacher voice recordings, video links, files (Supabase Storage paths)
create table media_assets (
  id               uuid primary key default gen_random_uuid(),
  owner_teacher_id uuid references teachers (id) on delete set null,
  kind             media_kind not null,
  storage_path     text,
  external_url     text,
  duration_ms      integer,
  alt_text         text,
  created_at       timestamptz not null default now(),
  check (storage_path is not null or external_url is not null)
);

create table questions (
  id                     uuid primary key default gen_random_uuid(),
  owner_teacher_id       uuid references teachers (id) on delete set null,
  type                   question_type not null,
  grade_from             smallint not null default 1 check (grade_from between 1 and 5),
  grade_to               smallint not null default 5 check (grade_to between 1 and 5),
  topic_id               uuid references topics (id) on delete set null,
  tags                   text[] not null default '{}',
  difficulty             smallint not null default 1 check (difficulty between 1 and 3),
  prompt                 jsonb not null,      -- text, image / audio asset ids, video link
  content                jsonb not null,      -- options, pairs, zones ... NEVER the answer
  default_time_limit_sec integer check (default_time_limit_sec between 5 and 120),  -- null = untimed
  default_points         numeric(5,2) not null default 1 check (default_points >= 0),
  speed_bonus            boolean not null default false,
  shuffle_options        boolean not null default true,
  is_seed                boolean not null default false,
  archived_at            timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (grade_to >= grade_from)
);
create index questions_topic on questions (topic_id);
create index questions_tags on questions using gin (tags);

-- [NEW] correct answers live in their own table so a student token can never read them
create table question_answer_keys (
  question_id uuid primary key references questions (id) on delete cascade,
  answer_key  jsonb not null,
  explanation text
);

create table quizzes (
  id                uuid primary key default gen_random_uuid(),
  owner_teacher_id  uuid references teachers (id) on delete set null,
  title             text not null,
  description       text,
  grade             smallint check (grade between 1 and 5),
  shuffle_questions boolean not null default false,
  settings          jsonb not null default '{}'::jsonb,   -- music, confetti ...
  archived_at       timestamptz,
  created_at        timestamptz not null default now()
);

create table quiz_questions (
  quiz_id             uuid not null references quizzes (id) on delete cascade,
  question_id         uuid not null references questions (id) on delete restrict,
  position            integer not null,
  points_override     numeric(5,2) check (points_override >= 0),
  time_limit_override integer check (time_limit_override between 5 and 120),
  primary key (quiz_id, question_id),
  unique (quiz_id, position) deferrable initially deferred
);

create table quiz_assignments (
  id                  uuid primary key default gen_random_uuid(),
  quiz_id             uuid not null references quizzes (id) on delete cascade,
  class_id            uuid not null references classes (id) on delete cascade,
  term_id             uuid not null references terms (id) on delete restrict,
  mode                quiz_mode not null,
  opens_at            timestamptz,
  closes_at           timestamptz,
  max_attempts        smallint check (max_attempts > 0),            -- null = unlimited
  show_correct        show_correct_policy not null default 'after_submit',
  leaderboard_enabled boolean not null default false,              -- off unless teacher turns it on
  counts_toward_grade boolean not null default true,
  grade_item_id       uuid references grade_items (id) on delete set null,
  created_by          uuid references teachers (id) on delete set null,
  created_at          timestamptz not null default now(),
  check (closes_at is null or opens_at is null or closes_at > opens_at),
  check (mode <> 'practice' or not counts_toward_grade)            -- practice never counts
);
create index quiz_assignments_class on quiz_assignments (class_id);

-- [NEW] state of a live (projector-led) quiz, broadcast over Realtime
create table live_sessions (
  id                  uuid primary key default gen_random_uuid(),
  quiz_assignment_id  uuid not null references quiz_assignments (id) on delete cascade,
  state               live_state not null default 'lobby',
  current_position    integer,
  question_started_at timestamptz,
  started_by          uuid references teachers (id) on delete set null,
  started_at          timestamptz not null default now(),
  finished_at         timestamptz
);

create table attempts (
  id                 uuid primary key default gen_random_uuid(),
  quiz_assignment_id uuid not null references quiz_assignments (id) on delete cascade,
  student_id         uuid not null references students (id) on delete cascade,
  attempt_no         smallint not null default 1 check (attempt_no > 0),
  status             attempt_status not null default 'in_progress',
  question_order     jsonb,                       -- per-student shuffled order
  started_at         timestamptz not null default now(),
  submitted_at       timestamptz,
  score              numeric(7,2),
  max_score          numeric(7,2),
  unique (quiz_assignment_id, student_id, attempt_no)
);
create index attempts_student on attempts (student_id);

create table answers (
  id                   uuid primary key default gen_random_uuid(),
  attempt_id           uuid not null references attempts (id) on delete cascade,
  question_id          uuid not null references questions (id) on delete restrict,
  response             jsonb not null,
  is_correct           boolean,                   -- null until graded
  points_awarded       numeric(5,2),
  time_ms              integer check (time_ms >= 0),
  answered_at          timestamptz not null default now(),
  client_uuid          uuid not null unique,      -- idempotency key for offline re-sends
  needs_manual_grading boolean not null default false,
  graded_by            uuid references teachers (id) on delete set null,
  graded_at            timestamptz,
  unique (attempt_id, question_id)
);
create index answers_question on answers (question_id);

-- ----------------------------------------------------------------------------
-- 5. Daily practice
-- ----------------------------------------------------------------------------
-- [NEW] typing texts the teacher can add (letters, words, sentences, proverbs)
create table practice_texts (
  id               uuid primary key default gen_random_uuid(),
  owner_teacher_id uuid references teachers (id) on delete set null,
  language         text not null check (language in ('mn', 'en')),
  level            typing_level not null,
  body             text not null,
  grade_from       smallint not null default 1 check (grade_from between 1 and 5),
  grade_to         smallint not null default 5 check (grade_to between 1 and 5),
  is_active        boolean not null default true,
  check (grade_to >= grade_from)
);

-- [NEW] block-coding puzzle levels (maze, pattern turtle, herder's count)
create table puzzle_levels (
  id             uuid primary key default gen_random_uuid(),
  game           puzzle_game not null,
  level_no       smallint not null check (level_no > 0),
  title          text not null,
  concept        text not null,                  -- sequence, loop, condition, function, variable
  config         jsonb not null,
  optimal_blocks smallint check (optimal_blocks > 0),
  unique (game, level_no)
);

create table practice_sessions (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references students (id) on delete cascade,
  class_id         uuid not null references classes (id) on delete cascade,
  kind             practice_kind not null,
  practice_text_id uuid references practice_texts (id) on delete set null,
  puzzle_level_id  uuid references puzzle_levels (id) on delete set null,
  practiced_on     date not null default current_date,
  started_at       timestamptz not null default now(),
  duration_sec     integer check (duration_sec >= 0),
  cpm              numeric(6,1) check (cpm >= 0),            -- characters per minute
  accuracy         numeric(5,2) check (accuracy between 0 and 100),
  error_keys       jsonb,                                    -- {"ө": 4, "ү": 2}
  stars            smallint check (stars between 0 and 3),
  block_count      smallint check (block_count >= 0),
  score            numeric(5,2),
  max_score        numeric(5,2),
  is_personal_best boolean not null default false,
  at_home          boolean not null default false
);
create index practice_sessions_student_day on practice_sessions (student_id, practiced_on);

-- [NEW] saved block solutions, so the teacher can open them
create table puzzle_solutions (
  id              uuid primary key default gen_random_uuid(),
  student_id      uuid not null references students (id) on delete cascade,
  puzzle_level_id uuid not null references puzzle_levels (id) on delete cascade,
  workspace       jsonb not null,
  block_count     smallint not null check (block_count >= 0),
  stars           smallint not null check (stars between 1 and 3),
  solved_at       timestamptz not null default now(),
  unique (student_id, puzzle_level_id)
);

-- [NEW] per-class practice settings: duration, level, daily goal
create table class_practice_settings (
  class_id             uuid primary key references classes (id) on delete cascade,
  typing_language      text not null default 'mn' check (typing_language in ('mn', 'en')),
  typing_level         typing_level not null default 'home_row',
  typing_duration_sec  integer not null default 60 check (typing_duration_sec in (30, 60, 0)),  -- 0 = until text ends
  daily_goal           jsonb not null default '{"typing": 1, "blocks": 1, "daily_quiz": 1}'::jsonb,
  target_days_per_week smallint check (target_days_per_week between 1 and 7)  -- null = lesson days only
);

-- [NEW] one row per student per day; source of streaks and of the practice grade
create table daily_progress (
  student_id uuid not null references students (id) on delete cascade,
  day        date not null,
  goals_done jsonb not null default '{}'::jsonb,
  goal_met   boolean not null default false,
  primary key (student_id, day)
);

-- ----------------------------------------------------------------------------
-- 6. Scratch tasks
-- ----------------------------------------------------------------------------
create table scratch_tasks (
  id                  uuid primary key default gen_random_uuid(),
  owner_teacher_id    uuid references teachers (id) on delete set null,
  title               text not null,
  grade_from          smallint not null check (grade_from between 1 and 5),
  grade_to            smallint not null check (grade_to between 1 and 5),
  concept             text not null,
  goal                text,
  steps               jsonb not null default '[]'::jsonb,     -- [{text, image_id, audio_id}]
  starter_assets      jsonb not null default '[]'::jsonb,     -- sprites and backdrops
  success_criteria    jsonb not null default '[]'::jsonb,
  extension_challenge text,
  cambridge_unit      text,
  is_template         boolean not null default false,
  archived_at         timestamptz,
  created_at          timestamptz not null default now(),
  check (grade_to >= grade_from)
);

create table rubrics (
  id              uuid primary key default gen_random_uuid(),
  scratch_task_id uuid not null unique references scratch_tasks (id) on delete cascade,
  criteria        jsonb not null          -- [{key, name, max_points}]
);

-- [NEW] a task given to a class in a term
create table scratch_assignments (
  id              uuid primary key default gen_random_uuid(),
  scratch_task_id uuid not null references scratch_tasks (id) on delete cascade,
  class_id        uuid not null references classes (id) on delete cascade,
  term_id         uuid not null references terms (id) on delete restrict,
  due_on          date,
  grade_item_id   uuid references grade_items (id) on delete set null,
  created_at      timestamptz not null default now(),
  unique (scratch_task_id, class_id, term_id)
);

create table submissions (
  id                    uuid primary key default gen_random_uuid(),
  scratch_assignment_id uuid not null references scratch_assignments (id) on delete cascade,
  student_id            uuid not null references students (id) on delete cascade,
  file_path             text,              -- uploaded .sb3 in Storage
  project_url           text,              -- shared scratch.mit.edu project
  submitted_at          timestamptz not null default now(),
  rubric_scores         jsonb,
  total_score           numeric(5,2),
  feedback_text         text,
  feedback_audio_id     uuid references media_assets (id) on delete set null,
  graded_by             uuid references teachers (id) on delete set null,
  graded_at             timestamptz,
  in_gallery            boolean not null default false,
  unique (scratch_assignment_id, student_id),
  check (file_path is not null or project_url is not null)
);

-- ----------------------------------------------------------------------------
-- 7. Interactive lessons and materials
-- ----------------------------------------------------------------------------
create table lessons (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  title             text not null,
  template          lesson_template not null,
  content           jsonb not null default '{}'::jsonb,
  intro_audio_id    uuid references media_assets (id) on delete set null,
  quiz_question_ids uuid[] not null default '{}',     -- 3-5 closing questions
  score_goes_to     component_source not null default 'practice',
  is_builtin        boolean not null default false,
  owner_teacher_id  uuid references teachers (id) on delete set null,
  created_at        timestamptz not null default now()
);

-- [NEW] teacher opens / closes each lesson per class
create table lesson_access (
  lesson_id uuid not null references lessons (id) on delete cascade,
  class_id  uuid not null references classes (id) on delete cascade,
  is_open   boolean not null default false,
  primary key (lesson_id, class_id)
);

create table lesson_progress (
  student_id   uuid not null references students (id) on delete cascade,
  lesson_id    uuid not null references lessons (id) on delete cascade,
  status       progress_status not null default 'not_started',
  quiz_score   numeric(5,2),
  quiz_max     numeric(5,2),
  completed_at timestamptz,
  primary key (student_id, lesson_id)
);

-- [NEW, PENDING DECISION 3] "Lesson materials" menu: files and links per topic
create table materials (
  id               uuid primary key default gen_random_uuid(),
  owner_teacher_id uuid references teachers (id) on delete set null,
  title            text not null,
  topic_id         uuid references topics (id) on delete set null,
  media_asset_id   uuid not null references media_assets (id) on delete cascade,
  created_at       timestamptz not null default now()
);

-- [NEW, PENDING DECISION 3]
create table material_access (
  material_id uuid not null references materials (id) on delete cascade,
  class_id    uuid not null references classes (id) on delete cascade,
  is_open     boolean not null default false,
  primary key (material_id, class_id)
);

-- ----------------------------------------------------------------------------
-- 8. Rewards (gamification)
-- ----------------------------------------------------------------------------
-- [NEW] how much XP each action gives; teacher-editable
create table xp_rules (
  key         text primary key,           -- 'practice_done', 'quiz_done', 'streak_day' ...
  xp_amount   integer not null check (xp_amount >= 0),
  description text
);

create table xp_events (
  id          bigint generated always as identity primary key,
  student_id  uuid not null references students (id) on delete cascade,
  class_id    uuid not null references classes (id) on delete cascade,
  rule_key    text not null references xp_rules (key) on update cascade on delete restrict,
  xp          integer not null check (xp >= 0),
  source_type text,
  source_id   uuid,
  created_at  timestamptz not null default now()
);
create index xp_events_student_time on xp_events (student_id, created_at);
create index xp_events_class_time on xp_events (class_id, created_at);

create table badges (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,       -- 'fast_fingers', 'seven_day_trek' ...
  name        text not null,
  description text not null,
  icon        text not null,
  rule        jsonb not null default '{}'::jsonb
);

create table student_badges (
  student_id uuid not null references students (id) on delete cascade,
  badge_id   uuid not null references badges (id) on delete cascade,
  earned_at  timestamptz not null default now(),
  primary key (student_id, badge_id)
);

-- [NEW] avatar decorations unlocked with XP
create table avatar_items (
  id          uuid primary key default gen_random_uuid(),
  slot        avatar_slot not null,
  name        text not null,
  xp_required integer not null default 0 check (xp_required >= 0),
  asset       text not null
);

-- [NEW]
create table student_avatar_items (
  student_id     uuid not null references students (id) on delete cascade,
  avatar_item_id uuid not null references avatar_items (id) on delete cascade,
  unlocked_at    timestamptz not null default now(),
  primary key (student_id, avatar_item_id)
);

-- [NEW] end-of-term wrestling titles, awarded by progress (not by score)
create table term_titles (
  student_id uuid not null references students (id) on delete cascade,
  term_id    uuid not null references terms (id) on delete cascade,
  title      wrestling_title not null,
  basis      jsonb not null default '{}'::jsonb,
  awarded_at timestamptz not null default now(),
  primary key (student_id, term_id)
);

-- [NEW] shared class goal: collect XP to finish building the class ger
create table class_goals (
  class_id  uuid not null references classes (id) on delete cascade,
  term_id   uuid not null references terms (id) on delete cascade,
  target_xp integer not null check (target_xp > 0),
  primary key (class_id, term_id)
);

-- ----------------------------------------------------------------------------
-- 9. Settings and audit trail
-- ----------------------------------------------------------------------------
-- [NEW] thresholds the teacher can change: at-risk 60 %, 2 absences, 30 % / 95 % ...
create table app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references teachers (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table audit_log (
  id         bigint generated always as identity primary key,
  actor_type text not null check (actor_type in ('teacher', 'student', 'system')),
  actor_id   uuid,
  action     text not null,               -- 'insert', 'update', 'delete', 'login', 'export' ...
  table_name text,
  row_id     text,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_row on audit_log (table_name, row_id);

-- Edit history for attendance and scores ("who changed what, and when").
create function audit_row_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (actor_type, actor_id, action, table_name, row_id, before, after)
  values (
    case when auth.uid() is null then 'system' else 'teacher' end,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(old.id, new.id)::text,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return null;
end $$;

create trigger attendance_audit after update or delete on attendance
  for each row execute function audit_row_change();
create trigger scores_audit after update or delete on scores
  for each row execute function audit_row_change();

-- ----------------------------------------------------------------------------
-- Row Level Security: ON for every table, no policies yet = nobody but the
-- server (secret key) can read or write. Policies arrive in Phase 1.
-- ----------------------------------------------------------------------------
do $$
declare
  t record;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t.tablename);
  end loop;
end $$;

-- >>>>>>>>>> migrations/20261112000002_functions.sql
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

-- >>>>>>>>>> migrations/20261112000003_policies.sql
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


