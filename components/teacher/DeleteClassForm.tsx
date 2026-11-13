import { Button, Field, Input } from '@/components/ui';
import { deleteClass } from '@/features/classes/actions';
import { fill } from '@/lib/errors';
import { mn } from '@/locales/mn';

/** Deletes a class for good. The teacher types the class name to confirm. */
export function DeleteClassForm({ classId, name, returnTo }: { classId: string; name: string; returnTo: string }) {
  return (
    <form action={deleteClass} className="space-y-3">
      <input type="hidden" name="id" value={classId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <p className="text-sm text-slate-600">{mn.classes.deleteHint}</p>
      <Field label={fill(mn.classes.deleteConfirm, { name })}>
        <Input name="confirm_name" required autoComplete="off" spellCheck={false} placeholder={name} />
      </Field>
      <Button type="submit" variant="danger" className="w-full">
        {mn.classes.deleteButton}
      </Button>
    </form>
  );
}
