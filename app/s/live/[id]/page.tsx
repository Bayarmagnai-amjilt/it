import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LivePlayer } from '@/components/quiz/LivePlayer';
import { requireStudent } from '@/lib/auth/student';
import { isUuid } from '@/lib/constants';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.quiz.liveTitle };
export const dynamic = 'force-dynamic';

export default async function StudentLivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const student = await requireStudent();
  return <LivePlayer liveId={id} studentId={student.student_id} />;
}
