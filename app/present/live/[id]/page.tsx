import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { LiveHost } from '@/components/quiz/LiveHost';
import { requireTeacher } from '@/lib/auth/teacher';
import { isUuid } from '@/lib/constants';
import type { LiveHostState } from '@/lib/quiz/types';
import { siteUrl } from '@/lib/site';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: mn.quiz.liveTitle };
export const dynamic = 'force-dynamic';

// Full-screen page for the projector: lobby, questions, answers, podium.
export default async function LiveHostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const { supabase } = await requireTeacher();
  const { data } = await supabase.rpc('live_host_state', { p_live_id: id });
  const state = data as LiveHostState | null;
  if (!state) notFound();
  const origin = await siteUrl();
  return <LiveHost initial={state} siteUrl={origin.replace(/^https?:\/\//, '')} />;
}
