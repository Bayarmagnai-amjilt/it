// Shapes of the JSON the database functions return (supabase/migrations/..._functions.sql).

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused' | 'sick';
export type ComponentSource = 'attendance' | 'quiz' | 'scratch' | 'practice' | 'lesson' | 'manual';
export type MissingPolicy = 'zero' | 'exclude';

export interface NameLike {
  first_name: string;
  family_initial?: string | null;
}

export interface ClassCard {
  id: string;
  grade: number;
  section: string;
  name: string;
  color: string;
  animal_icon: string;
  is_open: boolean;
}

export interface TeacherClass {
  id: string;
  grade: number;
  section: string;
  name: string;
  color: string;
  animal_icon: string;
  status: 'active' | 'archived';
  class_code: string;
  picture_password_enabled: boolean;
  home_practice_enabled: boolean;
  open_lesson_id: string | null;
  student_count: number;
}

export interface RosterStudent extends NameLike {
  student_id: string;
  first_name: string;
  family_initial: string | null;
  gender: 'male' | 'female' | null;
  has_picture_password: boolean;
  online: boolean;
}

export interface ListedStudent extends NameLike {
  student_id: string;
  first_name: string;
  family_initial: string | null;
  class_id: string;
  class_name: string;
  grade: number;
  color: string;
}

export interface LoginClass {
  id: string;
  grade: number;
  name: string;
  color: string;
  animal_icon: string;
  picture_password_enabled: boolean;
}

export interface LoginStudent extends NameLike {
  id: string;
  first_name: string;
  family_initial: string | null;
  has_picture_password: boolean;
}

export interface LoginRoster {
  ok: boolean;
  error?: 'not_found' | 'locked';
  mode?: 'lesson' | 'home';
  class?: LoginClass;
  students?: LoginStudent[];
}

export type StudentLoginError =
  | 'not_found'
  | 'locked'
  | 'picture_required'
  | 'wrong_picture'
  | 'too_many_attempts'
  | 'setup_in_class'
  | 'invalid'
  | 'server';

export interface StudentLoginResult {
  ok: boolean;
  error?: StudentLoginError;
  setup?: boolean;
  attempts_left?: number;
}

export interface StudentSession {
  session_id: string;
  student_id: string;
  class_id: string;
  first_name: string;
  family_initial: string | null;
  class_name: string;
  grade: number;
  color: string;
  animal_icon: string;
  in_lesson: boolean;
  expires_at: string;
}

export interface AttendanceRow extends NameLike {
  student_id: string;
  first_name: string;
  family_initial: string | null;
  status: AttendanceStatus;
  note: string | null;
  saved: boolean;
  logged_in: boolean;
  suggested: AttendanceStatus | null;
}

export interface AttendanceSheetData {
  lesson: { id: string; held_on: string; period: number; opened_at: string | null; closed_at: string | null } | null;
  date: string;
  period: number;
  any_login: boolean;
  rows: AttendanceRow[];
}

export interface GradeComponentInput {
  id?: string | null;
  name: string;
  weight: number;
  source: ComponentSource;
  missing_policy: MissingPolicy;
}

export interface GradeComponentRow extends GradeComponentInput {
  id: string;
  sort_order: number;
}

export interface TermGradeComponent {
  component_id: string;
  name: string;
  weight: number;
  source: ComponentSource;
  percent: number | null;
}

export interface TermGradeRow extends NameLike {
  student_id: string;
  first_name: string;
  family_initial: string | null;
  final_percent: number | null;
  weight_covered: number;
  letter: string | null;
  teacher_label: string | null;
  stars: number | null;
  components: TermGradeComponent[];
}

export interface GradeItemSheet {
  item: {
    id: string;
    title: string;
    max_score: number;
    held_on: string | null;
    component_id: string;
    component_name: string;
  } | null;
  rows: (NameLike & {
    student_id: string;
    first_name: string;
    family_initial: string | null;
    score: number | null;
    is_excused: boolean;
  })[];
}

export interface DashboardSummary {
  today: string;
  classes: number;
  students: number;
  online: number;
  today_attendance: number | null;
  week_attendance: number | null;
  prev_week_attendance: number | null;
  schedule: {
    class_id: string;
    name: string;
    color: string;
    animal_icon: string;
    starts_at: string;
    ends_at: string;
    open_lesson_id: string | null;
    attendance_done: boolean;
  }[];
}

export interface StudentProfile {
  student: {
    id: string;
    first_name: string;
    family_initial: string | null;
    gender: 'male' | 'female' | null;
    status: string;
    has_picture_password: boolean;
  };
  class: { id: string; name: string; color: string; animal_icon: string } | null;
  history: { class_name: string; started_on: string; ended_on: string | null; end_reason: string | null }[];
  attendance: Record<AttendanceStatus, number>;
  recent_attendance: { held_on: string; period: number; status: AttendanceStatus; note: string | null }[];
  notes: { id: string; body: string; created_at: string; teacher: string }[];
}

export interface Term {
  id: string;
  school_year_id: string;
  name: string;
  starts_on: string;
  ends_on: string;
  sort_order: number;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
  message?: string;
}
