import { Alert } from '@/components/ui';
import { flashMessage } from '@/lib/flash';

/** "Saved" / error line after a form was submitted (reads ?ok= / ?error=). */
export function Flash({ params }: { params: Record<string, string | string[] | undefined> }) {
  const flash = flashMessage(params);
  if (!flash) return null;
  return (
    <div className="mb-4">
      <Alert tone={flash.tone}>{flash.text}</Alert>
    </div>
  );
}
