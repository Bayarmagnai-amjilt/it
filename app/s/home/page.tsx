import type { Metadata } from 'next';
import { requireStudent } from '@/lib/auth/student';
import { fill } from '@/lib/errors';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.common.home };
export const dynamic = 'force-dynamic';

export default async function StudentHomePage() {
  const student = await requireStudent();
  return (
    <div className="space-y-6">
      <section className="hero-pattern flex flex-wrap items-center gap-6 rounded-3xl p-8 text-white shadow-lg">
        <span className="bob text-8xl" aria-hidden="true">👋</span>
        <div>
          <h1 className="text-4xl font-black sm:text-5xl">{fill(mn.student.hello, { name: student.first_name })}</h1>
          <p className="mt-2 text-2xl text-ink-100">{mn.student.welcome}</p>
        </div>
      </section>

      <section className="rounded-3xl border border-ink-100 bg-white p-8 shadow-sm">
        <h2 className="text-3xl font-black text-ink-900">
          <span aria-hidden="true">📋 </span>
          {mn.student.todayTasks}
        </h2>
        {/* Quizzes arrive in the next step of Phase 1; daily practice in Phase 3. */}
        <p className="mt-4 text-2xl text-ink-700">{mn.student.noTasks}</p>
      </section>
    </div>
  );
}
