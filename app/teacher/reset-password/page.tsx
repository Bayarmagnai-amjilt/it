import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Alert, Button, Field, Input } from '@/components/ui';
import { updatePassword } from '@/features/auth/actions';
import { param, type SearchParams } from '@/lib/params';
import { createClient } from '@/lib/supabase/server';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.teacherAuth.resetTitle };

// Reached from the link in the password e-mail (through /auth/callback, which
// signs the teacher in), so a session must exist here.
export default async function ResetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/teacher/login?error=link');

  const error = param((await searchParams).error);
  const errors = mn.teacherAuth.errors as Record<string, string>;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">{mn.teacherAuth.resetTitle}</h1>
      {error ? <Alert tone="error">{errors[error] ?? mn.errors.generic}</Alert> : null}
      <form action={updatePassword} className="space-y-4">
        <Field label={mn.teacherAuth.newPassword} hint={mn.teacherAuth.passwordHint}>
          <Input type="password" name="password" autoComplete="new-password" minLength={8} required autoFocus />
        </Field>
        <Field label={mn.teacherAuth.confirmPassword}>
          <Input type="password" name="confirm" autoComplete="new-password" minLength={8} required />
        </Field>
        <Button type="submit" size="lg" className="w-full">
          {mn.common.save}
        </Button>
      </form>
    </div>
  );
}
