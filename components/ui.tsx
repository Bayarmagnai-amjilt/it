// Small building blocks of the teacher interface (no client-side state here).
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-heading font-bold transition-all ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ' +
  'disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap';
const BUTTON_VARIANT: Record<Variant, string> = {
  primary: 'bg-brand-500 text-white shadow-sm hover:bg-brand-600 active:translate-y-px',
  secondary: 'bg-white text-ink-900 border-2 border-ink-900 hover:bg-ink-900 hover:text-white',
  danger: 'bg-white text-red-700 border-2 border-red-300 hover:bg-red-50',
  ghost: 'text-ink-700 hover:bg-ink-100',
};
const BUTTON_SIZE: Record<Size, string> = {
  sm: 'h-8 px-4 text-sm',
  md: 'h-10 px-5 text-sm',
  lg: 'h-12 px-7 text-base',
};

/** Same look as <Button>, for links: <Link className={buttonClass('secondary')}> */
export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string): string {
  return cn(BUTTON_BASE, BUTTON_VARIANT[variant], BUTTON_SIZE[size], extra);
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

const FIELD_BASE =
  'rounded-lg border border-ink-100 bg-white px-3 text-ink-900 placeholder:text-slate-400 ' +
  'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-100 disabled:text-slate-500';

/**
 * Classes of a text field. Tailwind does not decide between two conflicting
 * classes (w-full and w-28), so the defaults for width, height and text size
 * are added only when `extra` does not set that property itself.
 */
export function fieldClass(extra?: string): string {
  const has = (pattern: RegExp) => Boolean(extra && pattern.test(extra));
  return cn(
    FIELD_BASE,
    !has(/(^|\s)w-/) && 'w-full',
    !has(/(^|\s)h-/) && 'h-10',
    !has(/(^|\s)text-(xs|sm|base|lg|xl)(\s|$)/) && 'text-sm',
    extra,
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={fieldClass(className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={fieldClass(className)} {...props}>
      {children}
    </select>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-semibold text-ink-800">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Card({
  title,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-2xl border border-ink-100 bg-white p-5 shadow-[0_1px_3px_rgb(41_47_54/0.08)]', className)}>
      {title || actions ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title ? <h2 className="text-lg font-extrabold text-ink-900">{title}</h2> : <span />}
          {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-black text-ink-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

type Tone = 'info' | 'success' | 'warning' | 'error';
const ALERT_TONE: Record<Tone, string> = {
  info: 'border-brand-200 bg-brand-50 text-brand-900',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warning: 'border-amber-200 bg-amber-50 text-amber-900',
  error: 'border-red-200 bg-red-50 text-red-900',
};

export function Alert({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-xl border px-4 py-3 text-sm', ALERT_TONE[tone])}>
      {children}
    </div>
  );
}

const BADGE_TONE: Record<Tone | 'neutral', string> = {
  neutral: 'bg-slate-100 text-slate-700',
  info: 'bg-brand-100 text-brand-800',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  error: 'bg-red-100 text-red-800',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone | 'neutral'; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold', BADGE_TONE[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-ink-100 bg-white px-6 py-10 text-center">
      <p className="font-heading font-bold text-ink-900">{title}</p>
      {hint ? <p className="mt-1 text-sm text-slate-600">{hint}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Colored chip with the class mascot and name, e.g. "🦅 4Б". */
export function ClassChip({ name, color, emoji }: { name: string; color: string; emoji: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold text-white"
      style={{ backgroundColor: color }}
    >
      <span aria-hidden="true">{emoji}</span>
      {name}
    </span>
  );
}

// Table cells. Base classes carry no text colour or alignment of their own, so a
// cell can add "text-right" or a colour without two classes fighting each other.
export const tableClass = 'w-full border-collapse text-sm';
const TH_BASE = 'border-b-2 border-ink-100 bg-ink-50 px-3 py-2 font-semibold text-ink-800';
export const thClass = `${TH_BASE} text-left`;
export const thRightClass = `${TH_BASE} text-right`;
export const tdClass = 'border-b border-slate-100 px-3 py-2';
