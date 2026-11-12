'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { mn } from '@/locales/mn';

// Horizontal tab bar under the dark header.
// Items with "soon: true" belong to later phases: shown so the teacher sees the
// whole map, but not clickable yet.
const ITEMS: { href: string; label: string; icon: string; soon?: boolean }[] = [
  { href: '/t/dashboard', label: mn.nav.dashboard, icon: '📊' },
  { href: '/t/classes', label: mn.nav.classes, icon: '🏫' },
  { href: '/t/students', label: mn.nav.students, icon: '🧒' },
  { href: '/t/attendance', label: mn.nav.attendance, icon: '✅' },
  { href: '/t/grades', label: mn.nav.grades, icon: '📒' },
  { href: '/t/quizzes', label: mn.nav.quizzes, icon: '❓', soon: true },
  { href: '/t/practice', label: mn.nav.practice, icon: '⌨️', soon: true },
  { href: '/t/scratch', label: mn.nav.scratch, icon: '🐱', soon: true },
  { href: '/t/lessons', label: mn.nav.lessons, icon: '🖥️', soon: true },
  { href: '/t/reports/export', label: mn.nav.reports, icon: '📥' },
  { href: '/t/settings', label: mn.nav.settings, icon: '⚙️' },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav aria-label={mn.nav.label} className="flex gap-1 overflow-x-auto">
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        if (item.soon) {
          return (
            <span
              key={item.href}
              className="flex shrink-0 items-center gap-1.5 border-b-4 border-transparent px-3 py-3 text-sm font-semibold text-slate-400"
              title={mn.common.soon}
            >
              <span aria-hidden="true">{item.icon}</span>
              {item.label}
              <span className="hidden rounded-full bg-ink-50 px-2 text-[10px] uppercase lg:inline">{mn.common.soon}</span>
            </span>
          );
        }
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`flex shrink-0 items-center gap-1.5 border-b-4 px-3 py-3 font-heading text-sm font-bold transition-colors ${
              active ? 'border-brand-500 text-ink-900' : 'border-transparent text-ink-700 hover:border-ink-100 hover:text-ink-900'
            }`}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
