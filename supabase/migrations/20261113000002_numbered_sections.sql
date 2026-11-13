-- =============================================================================
-- Tsahim Unaga — migration 5: letter sections become numbers
--
--   1А -> 1-1, 1Б -> 1-2, 4В -> 4-3 ...
--
-- Within each school year and grade the letters are numbered in alphabet order.
-- A class that already has one of those numbers moves to the next free number,
-- so no class is lost and nothing else about any class changes (students,
-- lessons, attendance, grades, class code and QR stay as they are).
-- Safe to run more than once: it only touches classes that still have a letter.
-- =============================================================================

-- Step 1: give every class that changes a temporary, unique section
-- '~<new number>~<id>', so the (year, grade, section) unique key never clashes.
with stats as (
  select school_year_id, grade,
         count(*) filter (where section !~ '^[0-9]+$') as letters,
         coalesce(max(case when section ~ '^[0-9]+$' then section::integer end), 0) as top_number
    from classes
   group by school_year_id, grade
),
lettered as (
  select c.id,
         row_number() over (
           partition by c.school_year_id, c.grade
           order by coalesce(nullif(strpos('АБВГДЕЁЖЗИЙКЛМНОӨПРСТУҮФХЦЧШЩЪЫЬЭЮЯ', upper(c.section)), 0), 999), c.section
         ) as n
    from classes c
   where c.section !~ '^[0-9]+$'
),
bumped as (
  select c.id,
         greatest(s.letters, s.top_number) + row_number() over (
           partition by c.school_year_id, c.grade
           order by case when c.section ~ '^[0-9]+$' then c.section::integer end, c.id
         ) as n
    from classes c
    join stats s on s.school_year_id = c.school_year_id and s.grade = c.grade
   where case when c.section ~ '^[0-9]+$' then c.section::integer end <= s.letters
),
moves as (
  select id, n from lettered
  union all
  select id, n from bumped
)
update classes c
   set section = '~' || m.n::text || '~' || c.id::text
  from moves m
 where m.id = c.id;

-- Step 2: drop the temporary part.
update classes
   set section = split_part(section, '~', 2)
 where section like '~%~%';
