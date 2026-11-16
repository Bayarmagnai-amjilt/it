'use client';

import type { ComponentProps } from 'react';
import { Button } from '@/components/ui';

/** A submit button that asks "are you sure?" before its form is sent. */
export function ConfirmButton({ message, ...props }: ComponentProps<typeof Button> & { message: string }) {
  return (
    <Button
      type="submit"
      {...props}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    />
  );
}
