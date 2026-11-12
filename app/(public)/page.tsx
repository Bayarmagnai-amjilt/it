import Link from 'next/link';
import { studentLogout } from '@/features/auth/actions';
import { getStudentSession } from '@/lib/auth/student';
import { animalEmoji } from '@/lib/constants';
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
        <div className="mx-auto max-w-xl rounded-3xl border border-ink-100 bg-white p-8 text-center shadow-lg">
          <div className="text-6xl" aria-hidden="true">🔌</div>
          <h1 className="mt-4 text-2xl font-black">{mn.public.notConfiguredTitle}</h1>
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
      {/* Hero band */}
      <section className="hero-pattern text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <p className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-brand-300">{mn.public.heroEyebrow}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-black leading-tight sm:text-6xl">{mn.public.heroTitle}</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-100 sm:text-xl">{mn.public.heroHint}</p>

          {session ? (
            <div className="mt-8 flex flex-wrap items-center gap-4 rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur">
              <p className="text-xl font-bold">
                <span aria-hidden="true">{animalEmoji(session.animal_icon)} </span>
                {fill(mn.public.alreadyIn, { name: displayName(session) })}
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/s/home"
                  className="inline-flex min-h-14 items-center rounded-full bg-brand-500 px-8 font-heading text-xl font-bold text-white hover:bg-brand-400"
                >
                  {mn.public.continue} <span aria-hidden="true">&nbsp;→</span>
                </Link>
                <form action={studentLogout}>
                  <button
                    type="submit"
                    className="min-h-14 rounded-full border-2 border-white px-8 font-heading text-xl font-bold text-white hover:bg-white hover:text-ink-900"
                  >
                    {mn.common.logout}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <a
              href="#classes"
              className="mt-8 inline-flex min-h-14 items-center rounded-full bg-brand-500 px-8 font-heading text-xl font-bold text-white shadow-lg hover:bg-brand-400"
            >
              {mn.public.pickClass} <span aria-hidden="true">&nbsp;↓</span>
            </a>
          )}
        </div>
      </section>

      {/* Class cards */}
      <div id="classes" className="mx-auto max-w-6xl scroll-mt-4 space-y-10 px-4 py-12">
        {byGrade.length === 0 ? (
          <p className="text-center text-xl text-ink-700">{mn.public.noClasses}</p>
        ) : (
          byGrade.map(({ grade, classes: list }) => (
            <section key={grade} aria-label={fill(mn.public.gradeLabel, { grade })}>
              <div className="mb-4 flex items-center gap-3">
                <h2 className="text-2xl font-black text-ink-900">{fill(mn.public.gradeLabel, { grade })}</h2>
                <span className="h-1 flex-1 rounded-full bg-ink-100" aria-hidden="true" />
              </div>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {list.map((c, i) => (
                  <Link
                    key={c.id}
                    href={`/class/${c.id}`}
                    className="card-in group flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-500"
                    style={{ animationDelay: `${i * 60}ms` }}
                    aria-label={`${c.name}${c.is_open ? '' : ` — ${mn.public.lockedShort}`}`}
                  >
                    <span
                      className="relative flex h-28 items-center justify-center text-6xl"
                      style={{ backgroundColor: c.color, opacity: c.is_open ? 1 : 0.55 }}
                      aria-hidden="true"
                    >
                      {animalEmoji(c.animal_icon)}
                      {!c.is_open ? (
                        <span className="absolute right-3 top-3 rounded-full bg-black/30 px-2 py-1 text-lg">🔒</span>
                      ) : null}
                    </span>
                    <span className="flex flex-1 flex-col gap-2 p-4">
                      <span className="font-heading text-3xl font-black text-ink-900">{c.name}</span>
                      {c.is_open ? (
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-bold text-brand-800 sm:text-sm">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-brand-500" aria-hidden="true" />
                          {mn.public.openNow}
                        </span>
                      ) : (
                        <span className="text-sm font-semibold text-ink-700 first-letter:uppercase">{mn.public.lockedShort}</span>
                      )}
                      <span className="mt-auto pt-1 font-heading text-base font-bold text-brand-700 group-hover:underline">
                        {mn.public.enter} <span aria-hidden="true">→</span>
                      </span>
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
