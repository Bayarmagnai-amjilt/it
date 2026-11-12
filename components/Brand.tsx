import Link from 'next/link';
import { cn } from '@/components/ui';
import { mn } from '@/locales/mn';

/** Square mark: a teal tile with "</>" — a plain sign for "code", not anyone's logo. */
export function BrandMark({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const box = { sm: 'h-8 w-8 text-sm', md: 'h-10 w-10 text-base', lg: 'h-16 w-16 text-2xl', xl: 'h-24 w-24 text-4xl' }[size];
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-xl bg-brand-500 font-heading font-black text-white shadow-[inset_0_-4px_0_rgb(0_0_0/0.15)]',
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
    <Link href={href} className="flex items-center gap-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
      <BrandMark size="md" />
      <span className="leading-tight">
        <span className={cn('block font-heading text-lg font-extrabold', inverse ? 'text-white' : 'text-ink-900')}>
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
          <span className={cn('hidden text-xs font-semibold sm:block', inverse ? 'text-brand-200' : 'text-brand-700')}>
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
    <footer className="no-print bg-ink-950 text-ink-100">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <div className="flex items-center gap-3">
            <BrandMark size="md" />
            <span className="font-heading text-lg font-extrabold text-white">{mn.app.name}</span>
          </div>
          <p className="mt-3 max-w-sm text-sm text-ink-100/80">{mn.footer.about}</p>
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-300">{mn.footer.forStudents}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link href="/" className="hover:text-white hover:underline">
                {mn.footer.pickClass}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-brand-300">{mn.footer.forTeachers}</h2>
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
