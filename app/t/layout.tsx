import Link from 'next/link';
import type { ReactNode } from 'react';
import { Brand } from '@/components/Brand';
import { IdleLogout } from '@/components/teacher/IdleLogout';
import { Sidebar } from '@/components/teacher/Sidebar';
import { buttonClass } from '@/components/ui';
import { teacherLogout } from '@/features/auth/actions';
import { requireTeacher } from '@/lib/auth/teacher';
import { mn } from '@/locales/mn';

export const dynamic = 'force-dynamic';

export default async function TeacherLayout({ children }: { children: ReactNode }) {
  const { teacher } = await requireTeacher();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print border-b-2 border-ink-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Brand href="/t/dashboard" />
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/t/attendance" className={buttonClass('accent', 'sm')}>
              + {mn.nav.takeAttendance}
            </Link>
            <Link href="/t/classes" className={buttonClass('secondary', 'sm')}>
              {mn.nav.startLesson}
            </Link>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span
              className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink-900 bg-grape-500 font-heading font-bold text-white shadow-brut-sm"
              aria-hidden="true"
            >
              {teacher.full_name.trim().charAt(0).toUpperCase()}
            </span>
            <span className="leading-tight">
              <span className="block font-extrabold text-ink-900">{teacher.full_name}</span>
              <span className="block font-mono text-[11px] font-bold text-slate-500">
                {teacher.role === 'owner' ? mn.nav.owner : mn.nav.teacher}
              </span>
            </span>
            <form action={teacherLogout}>
              <button type="submit" className={buttonClass('secondary', 'sm')}>
                {mn.common.logout}
              </button>
            </form>
          </div>
        </div>
      </header>
      <div className="no-print sticky top-0 z-10 border-b-[3px] border-ink-900 bg-white">
        <div className="mx-auto max-w-7xl px-2 sm:px-4">
          <Sidebar />
        </div>
      </div>
      <main className="mx-auto w-full min-w-0 max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      <IdleLogout minutes={30} action={teacherLogout} />
    </div>
  );
}
