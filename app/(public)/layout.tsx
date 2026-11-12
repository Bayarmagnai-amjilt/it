import Link from 'next/link';
import type { ReactNode } from 'react';
import { Brand, SiteFooter } from '@/components/Brand';
import { mn } from '@/locales/mn';

// Student-facing pages before login: dark top bar, big bright cards, dark footer.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <header className="bg-ink-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Brand inverse />
          <Link
            href="/teacher/login"
            className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-full border-2 border-white/70 px-5 font-heading text-sm font-bold text-white transition-colors hover:border-white hover:bg-white hover:text-ink-900"
          >
            {mn.public.teacherLink}
          </Link>
        </div>
      </header>
      <main className="w-full flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
