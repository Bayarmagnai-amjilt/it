import Link from 'next/link';
import { ClassLogo } from '@/components/ClassLogo';
import { Mascot } from '@/components/Mascot';
import { buttonClass } from '@/components/ui';
import { studentLogout } from '@/features/auth/actions';
import { getStudentSession } from '@/lib/auth/student';
import { fill } from '@/lib/errors';
import { compareText, displayName } from '@/lib/mn/names';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ClassCard } from '@/lib/types';
import { mn } from '@/locales/mn';

// Always rendered per request: which lessons are open changes minute by minute.
export const dynamic = 'force-dynamic';

async function loadClasses(): Promise<ClassCard[] | null> {
  try {
    const { data, error } = await createAdminClient().rpc('login_classes');
    if (error) return null;
    return (data ?? []) as ClassCard[];
  } catch {
    return null;
  }
}

export default async function ClassPickerPage() {
  const [classes, session] = await Promise.all([loadClasses(), getStudentSession().catch(() => null)]);

  if (classes === null) {
    return (
      <div className="px-4 py-16">
        <div className="mx-auto max-w-xl rounded-3xl border-[3px] border-ink-900 bg-white p-8 text-center shadow-brut-lg">
          <div className="text-6xl" aria-hidden="true">🔌</div>
          <h1 className="mt-4 text-2xl font-extrabold">{mn.public.notConfiguredTitle}</h1>
          <p className="mt-2 text-ink-700">{mn.public.notConfiguredHint}</p>
        </div>
      </div>
    );
  }

  const byGrade = [1, 2, 3, 4, 5]
    .map((grade) => ({
      grade,
      classes: classes.filter((c) => c.grade === grade).sort((a, b) => compareText(a.section, b.section)),
    }))
    .filter((g) => g.classes.length > 0);

  return (
    <>
      {/* Greeting; a student who is still logged in gets a dark "continue" banner */}
      <section className="mx-auto max-w-6xl px-4 pt-10 sm:pt-14">
        <div className="flex items-center gap-5">
          <Mascot className="bob hidden h-24 w-24 sm:block" />
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-brand-600">{mn.public.heroEyebrow}</p>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight text-ink-900 sm:text-5xl">{mn.public.heroTitle}</h1>
            <p className="mt-3 max-w-2xl text-lg font-semibold text-slate-600">{mn.public.heroHint}</p>
            {!session ? (
              <a href="#classes" className={buttonClass('accent', 'lg', 'mt-6 min-h-14 text-lg')}>
                {mn.public.pickClass} <span aria-hidden="true">↓</span>
              </a>
            ) : null}
          </div>
        </div>

        {session ? (
          <div className="hero-pattern mt-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl border-[3px] border-ink-900 px-6 py-6 text-white shadow-brut-blush sm:px-8">
            <p className="text-xl font-extrabold sm:text-2xl">
              <ClassLogo icon={session.animal_icon} />{' '}
              {fill(mn.public.alreadyIn, { name: displayName(session) })}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/s/home" className={buttonClass('accent', 'lg', 'min-h-14 text-lg')}>
                {mn.public.continue} <span aria-hidden="true">→</span>
              </Link>
              <form action={studentLogout}>
                <button type="submit" className={buttonClass('secondary', 'lg', 'min-h-14 text-lg')}>
                  {mn.common.logout}
                </button>
              </form>
            </div>
          </div>
        ) : null}
      </section>

      {/* Class cards */}
      <div id="classes" className="mx-auto max-w-6xl scroll-mt-4 space-y-10 px-4 py-10 sm:py-12">
        {byGrade.length === 0 ? (
          <p className="text-center text-xl font-semibold text-ink-700">{mn.public.noClasses}</p>
        ) : (
          byGrade.map(({ grade, classes: list }) => (
            <section key={grade} aria-label={fill(mn.public.gradeLabel, { grade })}>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-xl font-bold text-ink-900 sm:text-2xl">{fill(mn.public.gradeLabel, { grade })}</h2>
                <span className="flex-1 border-t-[3px] border-dashed border-ink-200" aria-hidden="true" />
              </div>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {list.map((c, i) => (
                  <Link
                    key={c.id}
                    href={`/class/${c.id}`}
                    className="card-in lift group flex flex-col gap-4 rounded-2xl border-[3px] border-ink-900 bg-white p-4 shadow-brut focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-300"
                    style={{ animationDelay: `${i * 60}ms` }}
                    aria-label={`${c.name}${c.is_open ? '' : ` — ${mn.public.lockedShort}`}`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-[3px] border-ink-900 text-4xl sm:h-20 sm:w-20 sm:text-5xl"
                        style={{ backgroundColor: c.color, opacity: c.is_open ? 1 : 0.6 }}
                        aria-hidden="true"
                      >
                        <ClassLogo icon={c.animal_icon} />
                      </span>
                      <span className="font-heading text-2xl font-bold text-ink-900 sm:text-3xl">{c.name}</span>
                    </span>
                    {c.is_open ? (
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-lg border-2 border-ink-900 bg-mint-200 px-2.5 py-1 text-xs font-extrabold text-ink-900 sm:text-sm">
                        <span className="h-2.5 w-2.5 animate-pulse rounded-full border border-ink-900 bg-mint-500" aria-hidden="true" />
                        {mn.public.openNow}
                      </span>
                    ) : (
                      <span className="inline-flex w-fit items-center gap-1.5 rounded-lg border-2 border-ink-200 bg-ink-50 px-2.5 py-1 text-xs font-bold text-slate-600 sm:text-sm">
                        <span aria-hidden="true">🔒</span>
                        <span className="first-letter:uppercase">{mn.public.lockedShort}</span>
                      </span>
                    )}
                    <span className="mt-auto flex items-center justify-between border-t-2 border-dashed border-ink-200 pt-3 font-extrabold text-brand-600">
                      <span className="group-hover:underline">{mn.public.enter}</span>
                      <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  );
}
