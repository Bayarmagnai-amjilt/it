import Link from 'next/link';
import type { ReactNode } from 'react';
import { AutoRefresh } from '@/components/AutoRefresh';
import { BrandMark } from '@/components/Brand';
import { studentLogout } from '@/features/auth/actions';
import { requireStudent } from '@/lib/auth/student';
import { animalEmoji } from '@/lib/constants';
import { displayName } from '@/lib/mn/names';
import { mn } from '@/locales/mn';

export const dynamic = 'force-dynamic';

// Everything a logged-in student sees. "Home" and "Log out" are always on screen.
export default async function StudentLayout({ children }: { children: ReactNode }) {
  const student = await requireStudent();
  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      {/* When the lesson ends or the teacher logs everyone out, the next refresh
          finds no session and requireStudent() sends this computer to the start page. */}
      <AutoRefresh seconds={20} />
      <header className="bg-ink-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link
            href="/s/home"
            className="flex min-h-16 items-center gap-3 rounded-full bg-white/10 pl-2 pr-6 font-heading text-2xl font-bold text-white ring-1 ring-white/20 hover:bg-white/20"
          >
            <BrandMark size="md" /> {mn.common.home}
          </Link>
          <div className="flex items-center gap-3">
            <span
              className="flex items-center gap-2 rounded-full px-5 py-2 font-heading text-2xl font-black text-white shadow"
              style={{ backgroundColor: student.color }}
            >
              <span aria-hidden="true">{animalEmoji(student.animal_icon)}</span>
              {student.class_name}
            </span>
            <span className="font-heading text-2xl font-bold text-white">{displayName(student)}</span>
          </div>
          <form action={studentLogout}>
            <button
              type="submit"
              className="min-h-16 rounded-full bg-sun-500 px-8 font-heading text-2xl font-bold text-ink-900 shadow hover:bg-sun-400"
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
