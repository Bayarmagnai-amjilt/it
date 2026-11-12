import type { Metadata } from 'next';
import Link from 'next/link';
import { Alert, Button, Field, Input } from '@/components/ui';
import { requestPasswordReset } from '@/features/auth/actions';
import { param, type SearchParams } from '@/lib/params';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.teacherAuth.forgotTitle };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const sent = param((await searchParams).sent);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">{mn.teacherAuth.forgotTitle}</h1>
      {sent ? (
        <Alert tone="success">{mn.teacherAuth.forgotSent}</Alert>
      ) : (
        <form action={requestPasswordReset} className="space-y-4">
          <p className="text-sm text-slate-600">{mn.teacherAuth.forgotHint}</p>
          <Field label={mn.teacherAuth.email}>
            <Input type="email" name="email" autoComplete="username" required autoFocus />
          </Field>
          <Button type="submit" size="lg" className="w-full">
            {mn.teacherAuth.forgotButton}
          </Button>
        </form>
      )}
      <Link href="/teacher/login" className="block text-center text-sm font-semibold text-brand-700 hover:underline">
        {mn.teacherAuth.backToLogin}
      </Link>
    </div>
  );
}
