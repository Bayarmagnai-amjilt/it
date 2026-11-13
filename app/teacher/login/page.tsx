import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Button, Field, Input } from '@/components/ui';
import { teacherLogin } from '@/features/auth/actions';
import { param, type SearchParams } from '@/lib/params';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.teacherAuth.loginTitle };

export default async function TeacherLoginPage({ searchParams }: { searchParams: SearchParams }) {
  const error = param((await searchParams).error);
  const errors = mn.teacherAuth.errors as Record<string, string>;
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold">{mn.teacherAuth.loginTitle}</h1>
      {error ? <Alert tone="error">{errors[error] ?? mn.errors.generic}</Alert> : null}
      <form action={teacherLogin} className="space-y-4">
        <Field label={mn.teacherAuth.email}>
          <Input type="email" name="email" autoComplete="username" required autoFocus />
        </Field>
        <Field label={mn.teacherAuth.password}>
          <Input type="password" name="password" autoComplete="current-password" required />
        </Field>
        <Button type="submit" size="lg" className="w-full">
          {mn.teacherAuth.loginButton}
        </Button>
      </form>
      <Link href="/teacher/forgot-password" className="block text-center text-sm font-extrabold text-brand-600 hover:underline">
        {mn.teacherAuth.forgotLink}
      </Link>
    </div>
  );
}
