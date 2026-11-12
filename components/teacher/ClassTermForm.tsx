import type { ReactNode } from 'react';
import { Button, Field, Select } from '@/components/ui';
import type { Term } from '@/lib/types';
import { mn } from '@/locales/mn';

/** "Class + term" chooser shared by the grading pages (a plain GET form). */
export function ClassTermForm({
  classes,
  terms,
  classId,
  termId,
  children,
}: {
  classes: { id: string; name: string }[];
  terms: Term[];
  classId: string;
  termId: string;
  children?: ReactNode;
}) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3">
      <Field label={mn.common.class}>
        <Select name="class" defaultValue={classId} className="w-28">
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label={mn.common.term}>
        <Select name="term" defaultValue={termId} className="w-44">
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" variant="secondary">
        {mn.common.show}
      </Button>
      {children}
    </form>
  );
}
