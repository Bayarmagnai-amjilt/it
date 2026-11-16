// Quiz shapes shared by the server actions, pages and components.
// Formats match grade_response() in supabase/migrations/20261116000002_quizzes_games.sql.

export type QuestionType = 'single_choice' | 'multi_choice' | 'true_false' | 'short_answer' | 'ordering' | 'matching';
export const QUESTION_TYPES: QuestionType[] = ['single_choice', 'multi_choice', 'true_false', 'short_answer', 'ordering', 'matching'];

export interface TextItem {
  id: string;
  text: string;
}

export interface Prompt {
  text: string;
  image?: string | null;
}

/** What a student sees: never the answer. */
export interface QuestionContent {
  options?: TextItem[]; // single / multi choice
  items?: TextItem[]; // ordering, already shuffled
  left?: TextItem[]; // matching
  right?: TextItem[]; // matching, already shuffled
}

export interface AnswerKey {
  correct?: string | string[] | boolean;
  accepted?: string[];
  order?: string[];
  pairs?: Record<string, string>;
}

export type Response =
  | { choice: string }
  | { choices: string[] }
  | { value: boolean }
  | { text: string }
  | { order: string[] }
  | { pairs: Record<string, string> };

/** A question as the database sends it to a student (or to the teacher, with the key). */
export interface PublicQuestion {
  id: string;
  type: QuestionType;
  position: number;
  prompt: Prompt;
  content: QuestionContent;
  time_limit: number | null;
  points: number;
  answer_key?: AnswerKey;
  explanation?: string | null;
}

export interface QuizDetail {
  id: string;
  title: string;
  description: string | null;
  grade: number | null;
  created_at: string;
  questions: PublicQuestion[];
  assignments: AssignmentRow[];
}

export type QuizMode = 'self_paced' | 'live' | 'practice';
export type LiveState = 'lobby' | 'question' | 'reveal' | 'finished';
export type ShowCorrect = 'after_each' | 'after_submit' | 'never';

export interface AssignmentRow {
  id: string;
  mode: QuizMode;
  class_id?: string;
  class_name: string;
  quiz_id?: string;
  quiz_title?: string;
  created_at: string;
  closes_at: string | null;
  max_attempts?: number | null;
  show_correct?: ShowCorrect;
  live_id: string | null;
  live_state: LiveState | null;
  players: number;
}

export interface QuizListItem {
  id: string;
  title: string;
  grade: number | null;
  created_at: string;
  questions: number;
}

export interface Distribution {
  correct: number;
  wrong: number;
  picks: Record<string, number>;
}

export interface LeaderRow {
  student_id: string;
  name: string;
  score: number;
  correct: number;
}

export interface LiveHostState {
  id: string;
  state: LiveState;
  title: string;
  class_id: string;
  class_name: string;
  assignment_id: string;
  position: number | null;
  total: number;
  question: PublicQuestion | null;
  remaining_ms: number | null;
  players: string[];
  answered: number;
  distribution: Distribution | null;
  top: LeaderRow[] | null;
}

export interface LiveStudentState {
  ok: boolean;
  error?: string;
  state: LiveState;
  title: string;
  position: number | null;
  total: number;
  joined: boolean;
  question: PublicQuestion | null;
  remaining_ms: number | null;
  answered: boolean;
  my_response: Response | null;
  my_correct: boolean | null;
  my_points: number | null;
  score: number;
  rank: number | null;
  players: number;
  top: LeaderRow[] | null;
}

export type AttemptStep =
  | {
      ok: true;
      done: false;
      title: string;
      index: number;
      total: number;
      question: PublicQuestion;
      remaining_ms: number | null;
    }
  | {
      ok: true;
      done: true;
      title: string;
      score: number;
      max_score: number;
      correct: number;
      total: number;
      review: { question: PublicQuestion; response: Response; correct: boolean; points: number }[] | null;
    }
  | { ok: false; error: string };

export interface AnswerResult {
  ok: boolean;
  error?: string;
  correct?: boolean;
  points?: number;
  late?: boolean;
  answer_key?: AnswerKey;
  explanation?: string | null;
}

export interface StudentActivities {
  live: { id: string; state: LiveState; title: string } | null;
  quizzes: {
    assignment_id: string;
    title: string;
    closes_at: string | null;
    max_attempts: number | null;
    questions: number;
    total_points: number;
    attempts: number;
    best: number | null;
    in_progress: boolean;
  }[];
}

export interface QuizResults {
  assignment: {
    id: string;
    quiz_id: string;
    title: string;
    class_name: string;
    mode: QuizMode;
    created_at: string;
    closes_at: string | null;
    max_attempts: number | null;
    total_points: number;
  };
  questions: {
    id: string;
    position: number;
    type: QuestionType;
    text: string | null;
    points: number;
    answered: number;
    correct: number;
    avg_time_ms: number | null;
  }[];
  students: {
    student_id: string;
    first_name: string;
    family_initial: string | null;
    attempts: number;
    score: number | null;
    answered: number | null;
    status: 'in_progress' | 'submitted' | 'graded' | null;
    submitted_at: string | null;
    game_points: number | null;
  }[];
}
