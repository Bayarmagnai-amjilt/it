'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { hashIp, hashPictures, validPictures } from '@/lib/auth/picture';
import { STUDENT_COOKIE } from '@/lib/auth/student';
import { isUuid } from '@/lib/constants';
import { clientIp, siteUrl, userAgent } from '@/lib/site';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import type { StudentLoginError, StudentLoginResult } from '@/lib/types';

// ---------------------------------------------------------------------------
// Teacher: e-mail and password (Supabase Auth)
// ---------------------------------------------------------------------------
export async function teacherLogin(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) redirect('/teacher/login?error=missing');

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect('/teacher/login?error=invalid');
  redirect('/t/dashboard');
}

export async function teacherLogout(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/teacher/login');
}

export async function requestPasswordReset(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  if (email) {
    const supabase = await createClient();
    const origin = await siteUrl();
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=/teacher/reset-password`,
    });
  }
  // Same answer whether or not the address belongs to a teacher.
  redirect('/teacher/forgot-password?sent=1');
}

export async function updatePassword(formData: FormData): Promise<void> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  if (password.length < 8) redirect('/teacher/reset-password?error=short');
  if (password !== confirm) redirect('/teacher/reset-password?error=mismatch');

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirect('/teacher/reset-password?error=failed');
  redirect('/t/dashboard?ok=password');
}

// ---------------------------------------------------------------------------
// Student: class -> name -> (picture password). Nothing to type.
// ---------------------------------------------------------------------------
export async function studentLogin(input: {
  classId: string;
  studentId: string;
  pictures?: string[] | null;
  code?: string | null;
}): Promise<StudentLoginResult> {
  if (!input || !isUuid(input.classId) || !isUuid(input.studentId)) {
    return { ok: false, error: 'invalid' };
  }
  let pictureHash: string | null = null;
  if (input.pictures != null) {
    if (!validPictures(input.pictures)) return { ok: false, error: 'invalid' };
    pictureHash = hashPictures(input.studentId, input.pictures);
  }
  const code = typeof input.code === 'string' && input.code.length <= 40 ? input.code : null;

  const { data, error } = await createAdminClient().rpc('student_login', {
    p_class_id: input.classId,
    p_student_id: input.studentId,
    p_picture_hash: pictureHash,
    p_class_code: code,
    p_ip_hash: hashIp(await clientIp()),
    p_device: (await userAgent()).slice(0, 120),
  });
  if (error || !data) return { ok: false, error: 'server' };

  const result = data as {
    ok: boolean;
    error?: StudentLoginError;
    setup?: boolean;
    attempts_left?: number;
    session_id?: string;
    expires_at?: string;
  };
  if (!result.ok || !result.session_id || !result.expires_at) {
    return { ok: false, error: result.error ?? 'server', setup: result.setup, attempts_left: result.attempts_left };
  }

  (await cookies()).set(STUDENT_COOKIE, result.session_id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(result.expires_at),
  });
  return { ok: true };
}

export async function studentLogout(): Promise<void> {
  const store = await cookies();
  const id = store.get(STUDENT_COOKIE)?.value;
  if (isUuid(id)) {
    await createAdminClient().rpc('student_logout', { p_session_id: id });
  }
  store.delete(STUDENT_COOKIE);
  redirect('/');
}
