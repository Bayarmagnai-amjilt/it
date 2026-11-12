'use client';

import { useEffect, useRef } from 'react';

/**
 * Signs the teacher out after a stretch without any mouse, keyboard or touch
 * activity (30 minutes by default), by submitting the hidden logout form.
 */
export function IdleLogout({ minutes = 30, action }: { minutes?: number; action: () => Promise<void> }) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => formRef.current?.requestSubmit(), minutes * 60 * 1000);
    };
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [minutes]);

  return <form ref={formRef} action={action} hidden />;
}
