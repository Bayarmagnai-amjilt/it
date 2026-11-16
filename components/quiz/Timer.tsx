'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/components/ui';
import { fill } from '@/lib/errors';
import { mn } from '@/locales/mn';

/**
 * Counts down from what the server said was left. The server keeps the real
 * clock; this only shows it, and calls onEnd once when it reaches zero.
 */
export function Timer({
  remainingMs,
  limitSec,
  onEnd,
  big = false,
}: {
  remainingMs: number;
  limitSec: number;
  onEnd?: () => void;
  big?: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  const endAt = useRef(Date.now() + remainingMs);
  const ended = useRef(false);

  // a fresh number from the server moves the finish line
  useEffect(() => {
    endAt.current = Date.now() + remainingMs;
    ended.current = false;
  }, [remainingMs]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, []);

  const left = Math.max(0, endAt.current - now);
  useEffect(() => {
    if (left === 0 && !ended.current) {
      ended.current = true;
      onEnd?.();
    }
  }, [left, onEnd]);

  const share = limitSec > 0 ? left / (limitSec * 1000) : 0;
  const seconds = Math.ceil(left / 1000);
  return (
    <div className="flex items-center gap-3" role="timer" aria-live="off">
      <div className={cn('relative flex-1 overflow-hidden rounded-full border-[3px] border-ink-900 bg-white', big ? 'h-6' : 'h-4')}>
        <div
          className={cn('h-full transition-[width] duration-200 ease-linear', share > 0.3 ? 'bg-mint-500' : 'bg-blush-400')}
          style={{ width: `${Math.min(100, share * 100)}%` }}
        />
      </div>
      <span className={cn('min-w-16 text-right font-heading font-bold tabular-nums text-ink-900', big ? 'text-4xl' : 'text-2xl')}>
        {fill(mn.play.timeLeft, { n: seconds })}
      </span>
    </div>
  );
}
