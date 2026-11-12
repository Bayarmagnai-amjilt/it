import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AutoRefresh } from '@/components/AutoRefresh';
import { StudentPicker } from '@/components/student/StudentPicker';
import { animalEmoji, isUuid } from '@/lib/constants';
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
      <div className="mx-auto max-w-xl rounded-3xl border border-ink-100 bg-white p-10 text-center shadow-lg">
        <AutoRefresh seconds={10} />
        <div
          className="mx-auto flex h-28 w-28 items-center justify-center rounded-full text-6xl"
          style={{ backgroundColor: roster.class.color }}
          aria-hidden="true"
        >
          {animalEmoji(roster.class.animal_icon)}
        </div>
        <p className="mt-4 text-3xl font-black text-ink-900">{roster.class.name}</p>
        <p className="mt-6 text-5xl" aria-hidden="true">💤</p>
        <h1 className="mt-2 text-3xl font-black text-ink-900">{mn.public.lockedTitle}</h1>
        <p className="mt-2 text-xl text-slate-600">{mn.public.lockedHint}</p>
        <Link
          href="/"
          className="mt-8 inline-flex min-h-16 items-center rounded-full border-2 border-ink-900 px-8 font-heading text-xl font-bold text-ink-900 transition-colors hover:bg-ink-900 hover:text-white"
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
