// Small building blocks of the teacher interface (no client-side state here).
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { ClassLogo } from '@/components/ClassLogo';

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'accent' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

// Outlined "sticker" buttons: thick navy border, hard shadow, sink in when pressed.
const BUTTON_BASE =
  'press inline-flex items-center justify-center gap-2 rounded-xl border-2 font-extrabold ' +
  'focus:outline-none focus-visible:ring-4 focus-visible:ring-brand-200 ' +
  'disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap';
const BUTTON_VARIANT: Record<Variant, string> = {
  primary: 'border-ink-900 bg-brand-500 text-white shadow-brut-sm hover:bg-brand-600',
  accent: 'border-ink-900 bg-sun-500 text-ink-900 shadow-brut-sm hover:bg-sun-400',
  secondary: 'border-ink-900 bg-white text-ink-900 shadow-brut-sm hover:bg-sun-100',
  danger: 'border-ink-900 bg-white text-red-700 shadow-brut-sm hover:bg-red-50',
  ghost: 'border-transparent text-ink-700 hover:border-ink-900 hover:bg-white hover:text-ink-900',
};
const BUTTON_SIZE: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-5 text-sm',
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
  'rounded-xl border-2 border-ink-900 bg-white px-3 font-semibold text-ink-900 placeholder:font-normal placeholder:text-slate-400 ' +
  'focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:border-ink-200 disabled:bg-slate-100 disabled:text-slate-500';

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
      <span className="mb-1 block font-bold text-ink-900">{label}</span>
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
    <section className={cn('rounded-2xl border-[3px] border-ink-900 bg-white p-5 shadow-brut', className)}>
      {title || actions ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title ? <h2 className="text-base font-bold text-ink-900 sm:text-lg">{title}</h2> : <span />}
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
        <h1 className="text-2xl font-extrabold text-ink-900 sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1.5 font-semibold text-slate-600">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

type Tone = 'info' | 'success' | 'warning' | 'error';
const ALERT_TONE: Record<Tone, string> = {
  info: 'bg-brand-50 text-ink-900',
  success: 'bg-mint-100 text-ink-900',
  warning: 'bg-sun-100 text-ink-900',
  error: 'bg-red-50 text-red-900',
};

export function Alert({ tone = 'info', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('rounded-xl border-2 border-ink-900 px-4 py-3 text-sm font-semibold shadow-brut-sm', ALERT_TONE[tone])}>
      {children}
    </div>
  );
}

const BADGE_TONE: Record<Tone | 'neutral', string> = {
  neutral: 'bg-white text-ink-700',
  info: 'bg-brand-100 text-ink-900',
  success: 'bg-mint-200 text-ink-900',
  warning: 'bg-sun-200 text-ink-900',
  error: 'bg-red-100 text-red-800',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone | 'neutral'; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center whitespace-nowrap rounded-lg border-2 border-ink-900 px-2 py-0.5 text-xs font-bold', BADGE_TONE[tone])}>
      {children}
    </span>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border-[3px] border-dashed border-ink-300 bg-white/80 px-6 py-10 text-center">
      <p className="font-heading font-bold text-ink-900">{title}</p>
      {hint ? <p className="mt-1 text-sm text-slate-600">{hint}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** Colored chip with the class name and its logo, if it has one, e.g. "4-2". */
export function ClassChip({ name, color, icon }: { name: string; color: string; icon: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border-2 border-ink-900 px-3 py-1 text-sm font-extrabold text-white shadow-brut-sm [text-shadow:0_1px_0_rgb(0_0_0/0.25)]"
      style={{ backgroundColor: color }}
    >
      <ClassLogo icon={icon} />
      {name}
    </span>
  );
}

// Table cells. Base classes carry no text colour or alignment of their own, so a
// cell can add "text-right" or a colour without two classes fighting each other.
export const tableClass = 'w-full border-collapse text-sm';
const TH_BASE = 'border-b-2 border-ink-900 bg-ink-50 px-3 py-2 font-extrabold text-ink-900';
export const thClass = `${TH_BASE} text-left`;
export const thRightClass = `${TH_BASE} text-right`;
export const tdClass = 'border-b border-ink-100 px-3 py-2';
