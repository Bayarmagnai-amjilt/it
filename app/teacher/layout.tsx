import type { ReactNode } from 'react';
import { Brand } from '@/components/Brand';
import { mn } from '@/locales/mn';

// Login and password pages of the teacher: dark band on the left, form on the right.
export default function TeacherAuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <header className="bg-ink-900">
        <div className="mx-auto flex max-w-6xl items-center px-4 py-3">
          <Brand inverse />
        </div>
      </header>
      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-10 px-4 py-10 md:grid-cols-2">
        <section className="hero-pattern hidden rounded-3xl p-10 text-white md:block">
          <p className="font-heading text-sm font-bold uppercase tracking-[0.2em] text-brand-300">{mn.footer.forTeachers}</p>
          <h1 className="mt-3 text-4xl font-black leading-tight">{mn.app.name}</h1>
          <p className="mt-4 text-lg text-ink-100">{mn.app.tagline}</p>
        </section>
        <main className="w-full rounded-3xl border border-ink-100 bg-white p-8 shadow-lg">{children}</main>
      </div>
    </div>
  );
}
