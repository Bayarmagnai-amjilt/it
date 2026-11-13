import Link from 'next/link';
import { Mascot } from '@/components/Mascot';
import { buttonClass } from '@/components/ui';
import { mn } from '@/locales/mn';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-3xl border-[3px] border-ink-900 bg-white p-10 text-center shadow-brut-lg">
        <Mascot className="bob h-24 w-24" />
        <p className="font-heading text-6xl font-extrabold text-brand-500 [text-shadow:4px_4px_0_var(--color-ink-900)]">404</p>
        <h1 className="text-2xl font-extrabold text-ink-900">{mn.notFound.title}</h1>
        <p className="font-semibold text-slate-600">{mn.notFound.hint}</p>
        <Link href="/" className={buttonClass('accent', 'lg', 'mt-2 min-h-14 text-lg')}>
          {mn.common.home}
        </Link>
      </div>
    </main>
  );
}
