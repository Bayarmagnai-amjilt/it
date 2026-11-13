import type { Metadata } from 'next';
import { ClassLogo } from '@/components/ClassLogo';
import { Mascot } from '@/components/Mascot';
import { requireStudent } from '@/lib/auth/student';
import { fill } from '@/lib/errors';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.common.home };
export const dynamic = 'force-dynamic';

export default async function StudentHomePage() {
  const student = await requireStudent();
  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <Mascot className="bob h-24 w-24" />
          <div>
            <h1 className="text-3xl font-extrabold text-ink-900 sm:text-5xl">{fill(mn.student.hello, { name: student.first_name })}</h1>
            <p className="mt-2 text-xl font-bold text-slate-600 sm:text-2xl">{mn.student.welcome}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-2xl border-[3px] border-ink-900 bg-white p-4 pr-6 shadow-brut">
          <span
            className="flex h-16 w-16 items-center justify-center rounded-2xl border-[3px] border-ink-900 text-4xl"
            style={{ backgroundColor: student.color }}
            aria-hidden="true"
          >
            <ClassLogo icon={student.animal_icon} />
          </span>
          <span>
            <span className="block font-mono text-sm font-bold uppercase text-slate-500">{mn.common.class}</span>
            <span className="block font-heading text-3xl font-bold text-ink-900">{student.class_name}</span>
          </span>
        </div>
      </section>

      <section className="hero-pattern rounded-3xl border-[3px] border-ink-900 p-8 text-white shadow-brut-blush">
        <h2 className="text-2xl font-bold sm:text-3xl">
          <span aria-hidden="true">📋 </span>
          {mn.student.todayTasks}
        </h2>
        {/* Quizzes arrive in the next step of Phase 1; daily practice in Phase 3. */}
        <p className="mt-4 text-2xl font-semibold text-ink-100">{mn.student.noTasks}</p>
      </section>
    </div>
  );
}
