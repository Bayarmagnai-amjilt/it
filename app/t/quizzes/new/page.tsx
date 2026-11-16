import type { Metadata } from 'next';
import Link from 'next/link';
import { QuizEditor } from '@/components/quiz/QuizEditor';
import { buttonClass, PageHeader } from '@/components/ui';
import { requireTeacher } from '@/lib/auth/teacher';
import { emptyDraft } from '@/lib/quiz/draft';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.quiz.newQuiz };

export default async function NewQuizPage() {
  await requireTeacher();
  return (
    <div>
      <PageHeader
        title={mn.quiz.newQuiz}
        actions={
          <Link href="/t/quizzes" className={buttonClass('ghost', 'md')}>
            ← {mn.common.back}
          </Link>
        }
      />
      <QuizEditor initial={emptyDraft()} />
    </div>
  );
}
