import { cn } from '@/components/ui';

/** The site's own little robot helper, drawn inline so it needs no image file. */
export function Mascot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 96" className={cn('h-20 w-20 shrink-0', className)} aria-hidden="true">
      {/* antenna */}
      <line x1="48" y1="8" x2="48" y2="20" stroke="var(--color-ink-900)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="48" cy="8" r="6" fill="var(--color-sun-500)" stroke="var(--color-ink-900)" strokeWidth="3" />
      {/* ears */}
      <rect x="4" y="42" width="12" height="22" rx="5" fill="var(--color-blush-400)" stroke="var(--color-ink-900)" strokeWidth="3" />
      <rect x="80" y="42" width="12" height="22" rx="5" fill="var(--color-blush-400)" stroke="var(--color-ink-900)" strokeWidth="3" />
      {/* head */}
      <rect x="15" y="22" width="66" height="62" rx="18" fill="var(--color-ink-900)" />
      <rect x="12" y="19" width="66" height="62" rx="18" fill="var(--color-brand-500)" stroke="var(--color-ink-900)" strokeWidth="3.5" />
      {/* face screen */}
      <rect x="22" y="31" width="46" height="38" rx="12" fill="var(--color-ink-900)" />
      <circle cx="35" cy="47" r="5" fill="var(--color-mint-200)" />
      <circle cx="55" cy="47" r="5" fill="var(--color-mint-200)" />
      <path d="M36 58 Q45 65 54 58" fill="none" stroke="var(--color-mint-200)" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
