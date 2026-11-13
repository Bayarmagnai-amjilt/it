import Link from 'next/link';
import type { ReactNode } from 'react';
import { AutoRefresh } from '@/components/AutoRefresh';
import { BrandMark } from '@/components/Brand';
import { ClassLogo } from '@/components/ClassLogo';
import { studentLogout } from '@/features/auth/actions';
import { requireStudent } from '@/lib/auth/student';
import { displayName } from '@/lib/mn/names';
import { mn } from '@/locales/mn';

export const dynamic = 'force-dynamic';

// Everything a logged-in student sees. "Home" and "Log out" are always on screen.
export default async function StudentLayout({ children }: { children: ReactNode }) {
  const student = await requireStudent();
  return (
    <div className="flex min-h-screen flex-col">
      {/* When the lesson ends or the teacher logs everyone out, the next refresh
          finds no session and requireStudent() sends this computer to the start page. */}
      <AutoRefresh seconds={20} />
      <header className="border-b-[3px] border-ink-900 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <BrandMark size="md" />
            <Link
              href="/s/home"
              className="press flex min-h-14 items-center rounded-2xl border-[3px] border-ink-900 bg-sun-100 px-6 font-heading text-xl font-bold text-ink-900 shadow-brut-sm hover:bg-sun-200"
            >
              {mn.common.home}
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="flex items-center gap-2 rounded-2xl border-[3px] border-ink-900 px-4 py-1.5 font-heading text-xl font-bold text-white shadow-brut-sm [text-shadow:0_1px_0_rgb(0_0_0/0.25)]"
              style={{ backgroundColor: student.color }}
            >
              <ClassLogo icon={student.animal_icon} />
              {student.class_name}
            </span>
            <span className="text-2xl font-extrabold text-ink-900">{displayName(student)}</span>
          </div>
          <form action={studentLogout}>
            <button
              type="submit"
              className="press min-h-14 rounded-2xl border-[3px] border-ink-900 bg-white px-7 font-heading text-xl font-bold text-ink-900 shadow-brut-sm hover:bg-blush-100"
            >
              {mn.common.logout} <span aria-hidden="true">👋</span>
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
