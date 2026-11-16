'use client';

import type { MouseEvent } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui';
import { deleteClass } from '@/features/classes/actions';
import { fill } from '@/lib/errors';
import { mn } from '@/locales/mn';

/**
 * Deletes a class for good. The browser asks "are you sure?" first.
 * `compact` is a single small button (class cards, page header);
 * otherwise the consequences are spelled out above a wide button.
 */
export function DeleteClassForm({
  classId,
  name,
  returnTo,
  compact = false,
}: {
  classId: string;
  name: string;
  returnTo: string;
  compact?: boolean;
}) {
  return (
    <form action={deleteClass} className={compact ? undefined : 'space-y-3'}>
      <input type="hidden" name="id" value={classId} />
      <input type="hidden" name="return_to" value={returnTo} />
      {compact ? null : <p className="text-sm text-slate-600">{mn.classes.deleteHint}</p>}
      <DeleteButton name={name} compact={compact} />
    </form>
  );
}

function DeleteButton({ name, compact }: { name: string; compact: boolean }) {
  const { pending } = useFormStatus();
  function confirmDelete(e: MouseEvent<HTMLButtonElement>) {
    if (!window.confirm(fill(mn.classes.deleteConfirm, { name }))) e.preventDefault();
  }
  return (
    <Button
      type="submit"
      variant="danger"
      size={compact ? 'sm' : 'md'}
      className={compact ? undefined : 'w-full'}
      disabled={pending}
      onClick={confirmDelete}
    >
      <span aria-hidden="true">🗑</span> {pending ? mn.classes.deleting : compact ? mn.classes.deleteTitle : mn.classes.deleteButton}
    </Button>
  );
}
