import Link from 'next/link';
import { cn } from '@/components/ui';
import { mn } from '@/locales/mn';

/** Square mark: a blue tile with "</>" — a plain sign for "code", not anyone's logo. */
export function BrandMark({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const box = {
    sm: 'h-8 w-8 rounded-lg text-xs shadow-brut-sm',
    md: 'h-10 w-10 rounded-xl text-sm shadow-brut-sm',
    lg: 'h-16 w-16 rounded-2xl text-xl shadow-brut',
    xl: 'h-24 w-24 rounded-3xl text-3xl shadow-brut-lg',
  }[size];
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center border-2 border-ink-900 bg-brand-500 font-heading font-bold text-white',
        box,
        className,
      )}
    >
      &lt;/&gt;
    </span>
  );
}

/** Mark + school name. `inverse` for dark bars. */
export function Brand({ href = '/', inverse = false, compact = false }: { href?: string; inverse?: boolean; compact?: boolean }) {
  return (
    <Link href={href} className="flex min-w-0 items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200">
      <BrandMark size="md" />
      <span className="leading-tight">
        <span className={cn('block font-heading text-base font-bold sm:text-lg', inverse ? 'text-white' : 'text-ink-900')}>
          {compact ? (
            mn.app.short
          ) : (
            <>
              <span className="sm:hidden">{mn.app.short}</span>
              <span className="hidden sm:inline">{mn.app.name}</span>
            </>
          )}
        </span>
        {!compact ? (
          <span className={cn('hidden font-mono text-[11px] font-bold sm:block', inverse ? 'text-brand-200' : 'text-slate-500')}>
            {mn.footer.forStudents} · {mn.footer.forTeachers}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

/** Dark footer with link columns, shared by the public pages. */
export function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="no-print border-t-[3px] border-ink-900 bg-ink-900 text-ink-100">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3">
            <BrandMark size="md" />
            <span className="font-heading text-lg font-bold text-white">{mn.app.name}</span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-ink-100/80">{mn.footer.about}</p>
        </div>
        <div>
          <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-sun-400">{mn.footer.forStudents}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/" className="hover:text-white hover:underline">
                {mn.footer.pickClass}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="font-mono text-xs font-bold uppercase tracking-widest text-sun-400">{mn.footer.forTeachers}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/teacher/login" className="hover:text-white hover:underline">
                {mn.footer.teacherLogin}
              </Link>
            </li>
            <li>
              <Link href="/teacher/forgot-password" className="hover:text-white hover:underline">
                {mn.footer.forgotPassword}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-4 text-xs text-ink-100/60">
          © {year} {mn.app.school}. {mn.footer.rights}
        </p>
      </div>
    </footer>
  );
}
