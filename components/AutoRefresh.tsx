'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Re-asks the server for the current page every few seconds. Used where the
 * screen must follow something the teacher does: the "lesson has not started"
 * screen opens by itself, and a student is sent out when the lesson ends.
 */
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') router.refresh();
    }, seconds * 1000);
    return () => clearInterval(timer);
  }, [router, seconds]);
  return null;
}
