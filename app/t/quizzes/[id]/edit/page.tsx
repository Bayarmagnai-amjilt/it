import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { QuizEditor } from '@/components/quiz/QuizEditor';
import { buttonClass, PageHeader } from '@/components/ui';
import { requireTeacher } from '@/lib/auth/teacher';
import { isUuid } from '@/lib/constants';
import { fromQuestion } from '@/lib/quiz/draft';
import type { QuizDetail } from '@/lib/quiz/types';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.quiz.edit };

export default async function EditQuizPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase } = await requireTeacher();
  const { data } = await supabase.rpc('quiz_detail', { p_quiz_id: id });
  const quiz = data as QuizDetail | null;
  if (!quiz) notFound();
  return (
    <div>
      <PageHeader
        title={quiz.title}
        actions={
          <Link href={`/t/quizzes/${id}`} className={buttonClass('ghost', 'md')}>
            ← {mn.common.back}
          </Link>
        }
      />
      <QuizEditor
        answered={quiz.assignments.some((a) => a.players > 0)}
        initial={{
          id: quiz.id,
          title: quiz.title,
          description: quiz.description ?? '',
          grade: quiz.grade,
          questions: quiz.questions.map(fromQuestion),
        }}
      />
    </div>
  );
}
