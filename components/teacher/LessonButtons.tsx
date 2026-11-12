import Link from 'next/link';
import { Button, buttonClass } from '@/components/ui';
import { closeLesson, openLesson } from '@/features/classes/actions';
import { mn } from '@/locales/mn';

/** "Start lesson" / "End lesson" plus shortcuts to attendance and the QR page. */
export function LessonButtons({
  classId,
  isOpen,
  returnTo,
  showLinks = true,
}: {
  classId: string;
  isOpen: boolean;
  returnTo: string;
  showLinks?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={isOpen ? closeLesson : openLesson}>
        <input type="hidden" name="class_id" value={classId} />
        <input type="hidden" name="return_to" value={returnTo} />
        <Button type="submit" size="sm" variant={isOpen ? 'danger' : 'primary'}>
          {isOpen ? mn.lesson.end : mn.lesson.start}
        </Button>
      </form>
      {showLinks ? (
        <>
          <Link href={`/t/attendance?class=${classId}`} className={buttonClass('secondary', 'sm')}>
            {mn.nav.takeAttendance}
          </Link>
          <Link href={`/present/qr/${classId}`} target="_blank" className={buttonClass('ghost', 'sm')}>
            QR
          </Link>
        </>
      ) : null}
    </div>
  );
}
