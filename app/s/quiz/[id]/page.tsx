import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { QuizPlayer } from '@/components/quiz/QuizPlayer';
import { requireStudent } from '@/lib/auth/student';
import { isUuid } from '@/lib/constants';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.play.quizzes };
export const dynamic = 'force-dynamic';

export default async function StudentQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  await requireStudent();
  return <QuizPlayer assignmentId={id} />;
}
