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
