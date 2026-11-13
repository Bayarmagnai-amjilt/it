import type { ReactNode } from 'react';
import { Brand } from '@/components/Brand';
import { Mascot } from '@/components/Mascot';
import { mn } from '@/locales/mn';

// Login and password pages of the teacher: dark banner on the left, form card on the right.
export default function TeacherAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b-[3px] border-ink-900 bg-white">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-3">
          <Brand />
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 py-10 md:grid-cols-2">
        <section className="hero-pattern hidden rounded-3xl border-[3px] border-ink-900 p-10 text-white shadow-brut-blush md:block">
          <Mascot className="bob h-24 w-24" />
          <p className="mt-6 font-mono text-xs font-bold uppercase tracking-widest text-sun-400">{mn.footer.forTeachers}</p>
          <h1 className="mt-3 text-3xl font-extrabold leading-tight">{mn.app.name}</h1>
          <p className="mt-4 text-lg text-ink-200">{mn.app.tagline}</p>
        </section>
        <main className="w-full rounded-3xl border-[3px] border-ink-900 bg-white p-8 shadow-brut-lg">{children}</main>
      </div>
    </div>
  );
}
