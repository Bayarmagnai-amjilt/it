import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutoRefresh } from '@/components/AutoRefresh';
import { ClassLogo } from '@/components/ClassLogo';
import { StudentPicker } from '@/components/student/StudentPicker';
import { isUuid } from '@/lib/constants';
import { letterIndex, sortByName } from '@/lib/mn/names';
import { param, type SearchParams } from '@/lib/params';
import { createAdminClient } from '@/lib/supabase/admin';
import type { LoginRoster } from '@/lib/types';
import { mn } from '@/locales/mn';

export const dynamic = 'force-dynamic';

export default async function ClassLoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ classId: string }>;
  searchParams: SearchParams;
}) {
  const { classId } = await params;
  const code = param((await searchParams).code)?.slice(0, 40) ?? null;
  if (!isUuid(classId)) notFound();

  const { data, error } = await createAdminClient().rpc('login_roster', {
    p_class_id: classId,
    p_class_code: code,
  });
  const roster = data as LoginRoster | null;
  if (error || !roster || roster.error === 'not_found' || !roster.class) notFound();

  if (!roster.ok) {
    // Lesson not started: no names are sent to the browser at all.
    return (
      <div className="px-4 py-10">
      <div className="mx-auto max-w-xl rounded-3xl border-[3px] border-ink-900 bg-white p-10 text-center shadow-brut-lg">
        <AutoRefresh seconds={10} />
        <div
          className="mx-auto flex h-28 w-28 items-center justify-center rounded-3xl border-[3px] border-ink-900 text-6xl shadow-brut"
          style={{ backgroundColor: roster.class.color }}
          aria-hidden="true"
        >
          <ClassLogo icon={roster.class.animal_icon} />
        </div>
        <p className="mt-4 font-heading text-3xl font-bold text-ink-900">{roster.class.name}</p>
        <p className="mt-6 text-5xl" aria-hidden="true">💤</p>
        <h1 className="mt-2 text-2xl font-extrabold text-ink-900 sm:text-3xl">{mn.public.lockedTitle}</h1>
        <p className="mt-2 text-xl font-semibold text-slate-600">{mn.public.lockedHint}</p>
        <Link
          href="/"
          className="press mt-8 inline-flex min-h-16 items-center rounded-2xl border-[3px] border-ink-900 bg-white px-8 font-heading text-xl font-bold text-ink-900 shadow-brut-sm hover:bg-sun-100"
        >
          <span aria-hidden="true">← </span>
          {mn.public.backToClasses}
        </Link>
      </div>
      </div>
    );
  }

  // Sorted on the server: its "mn" collation puts Ө and Ү where they belong.
  const students = sortByName(roster.students ?? []);
  return <StudentPicker cls={roster.class} students={students} letters={letterIndex(students)} code={code} />;
}
