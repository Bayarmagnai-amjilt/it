import Link from 'next/link';
import type { ReactNode } from 'react';
import { Brand } from '@/components/Brand';
import { IdleLogout } from '@/components/teacher/IdleLogout';
import { Sidebar } from '@/components/teacher/Sidebar';
import { teacherLogout } from '@/features/auth/actions';
import { requireTeacher } from '@/lib/auth/teacher';
import { mn } from '@/locales/mn';

export const dynamic = 'force-dynamic';

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const { teacher } = await requireTeacher();
  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <header className="no-print bg-ink-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Brand href="/t/dashboard" inverse />
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/t/attendance"
              className="inline-flex h-9 items-center rounded-full bg-brand-500 px-4 font-heading text-sm font-bold text-white hover:bg-brand-400"
            >
              + {mn.nav.takeAttendance}
            </Link>
            <Link
              href="/t/classes"
              className="inline-flex h-9 items-center rounded-full border-2 border-white/70 px-4 font-heading text-sm font-bold text-white hover:border-white hover:bg-white hover:text-ink-900"
            >
              {mn.nav.startLesson}
            </Link>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-grape-500 font-heading font-black" aria-hidden="true">
              {teacher.full_name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="font-semibold">{teacher.full_name}</span>
            {teacher.role === 'owner' ? (
              <span className="rounded-full bg-sun-500 px-2.5 py-0.5 text-xs font-bold text-ink-900">{mn.nav.owner}</span>
            ) : null}
            <form action={teacherLogout}>
              <button type="submit" className="rounded-full px-3 py-1.5 font-semibold text-ink-100 hover:bg-white/10 hover:text-white">
                {mn.common.logout}
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="no-print sticky top-0 z-10 border-b border-ink-100 bg-white">
        <div className="mx-auto max-w-7xl px-2 sm:px-4">
          <Sidebar />
        </div>
      </div>
      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <IdleLogout minutes={30} action={teacherLogout} />
    </div>
  );
}
