'use server';

import { cookies } from 'next/headers';
import { STUDENT_COOKIE } from '@/lib/auth/student';
import { isUuid } from '@/lib/constants';
import { isGameId } from '@/lib/games/levels';
import type { AnswerResult, AttemptStep, Response } from '@/lib/quiz/types';
import { createAdminClient } from '@/lib/supabase/admin';

// Every call names the student only through the session cookie; the database
// functions derive the student, class and permissions from that session.
async function sessionId(): Promise<string | null> {
  const id = (await cookies()).get(STUDENT_COOKIE)?.value;
  return isUuid(id) ? id : null;
}

type Result = { ok: true; [key: string]: unknown } | { ok: false; error: string };

async function call<T = Result>(fn: string, args: Record<string, unknown>): Promise<T> {
  const session = await sessionId();
  if (!session) return { ok: false, error: 'no_session' } as T;
  const { data, error } = await createAdminClient().rpc(fn, { p_session_id: session, ...args });
  if (error || !data) return { ok: false, error: 'generic' } as T;
  return data as T;
}

/** A response is a small JSON object of one of the known shapes. */
function cleanResponse(value: unknown): Response | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (JSON.stringify(value).length > 4000) return null;
  return value as Response;
}

export async function startAttempt(assignmentId: string): Promise<{ ok: true; attempt_id: string } | { ok: false; error: string }> {
  if (!isUuid(assignmentId)) return { ok: false, error: 'invalid' };
  return call('start_attempt', { p_assignment_id: assignmentId });
}

export async function nextQuestion(attemptId: string): Promise<AttemptStep> {
  if (!isUuid(attemptId)) return { ok: false, error: 'invalid' };
  return call<AttemptStep>('attempt_next', { p_attempt_id: attemptId });
}

export async function submitAnswer(
  attemptId: string,
  questionId: string,
  response: unknown,
  clientUuid: string,
): Promise<AnswerResult> {
  const clean = cleanResponse(response);
  if (!isUuid(attemptId) || !isUuid(questionId) || !isUuid(clientUuid) || !clean) return { ok: false, error: 'invalid' };
  return call<AnswerResult>('attempt_answer', {
    p_attempt_id: attemptId,
    p_question_id: questionId,
    p_response: clean,
    p_client_uuid: clientUuid,
  });
}

export async function joinLive(liveId: string): Promise<Result> {
  if (!isUuid(liveId)) return { ok: false, error: 'invalid' };
  return call('live_join', { p_live_id: liveId });
}

export async function answerLive(liveId: string, response: unknown, clientUuid: string): Promise<Result> {
  const clean = cleanResponse(response);
  if (!isUuid(liveId) || !isUuid(clientUuid) || !clean) return { ok: false, error: 'invalid' };
  return call('live_answer', { p_live_id: liveId, p_response: clean, p_client_uuid: clientUuid });
}

/** Saves a solved level for a logged-in student. Guests get "no_session" and keep playing. */
export async function savePuzzle(
  game: string,
  level: number,
  workspace: unknown,
  blockCount: number,
): Promise<{ ok: true; stars: number; best: number } | { ok: false; error: string }> {
  if (!isGameId(game) || !Number.isInteger(level) || !Number.isInteger(blockCount)) return { ok: false, error: 'invalid' };
  const ws = workspace && typeof workspace === 'object' ? workspace : {};
  if (JSON.stringify(ws).length > 200000) return { ok: false, error: 'invalid' };
  return call('save_puzzle_result', { p_game: game, p_level: level, p_workspace: ws, p_block_count: blockCount });
}
