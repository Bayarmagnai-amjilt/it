import Link from 'next/link';
import type { ReactNode } from 'react';
import { Brand, SiteFooter } from '@/components/Brand';
import { buttonClass } from '@/components/ui';
import { mn } from '@/locales/mn';

// Student-facing pages before login: white top bar, big sticker cards, dark footer.
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-[3px] border-ink-900 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Brand />
          <Link href="/teacher/login" className={buttonClass('secondary', 'md', 'shrink-0')}>
            {mn.public.teacherLink}
          </Link>
        </div>
      </header>
      <main className="w-full flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
