import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { requireTeacher } from '@/lib/auth/teacher';
import { animalEmoji, isUuid } from '@/lib/constants';
import { siteUrl } from '@/lib/site';
import { mn } from '@/locales/mn';

export const metadata: Metadata = { title: 'QR' };
export const dynamic = 'force-dynamic';

// Full-screen page for the projector: students scan the code (or type the short
// address) and land on their own class. The lesson lock still applies.
export default async function ClassQrPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  if (!isUuid(classId)) notFound();
  const { supabase } = await requireTeacher();
  const { data } = await supabase
    .from('classes')
    .select('name, color, animal_icon, class_code')
    .eq('id', classId)
    .maybeSingle();
  const cls = data as { name: string; color: string; animal_icon: string; class_code: string } | null;
  if (!cls) notFound();

  const origin = await siteUrl();
  const url = `${origin}/c/${cls.class_code}`;
  const svg = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-white p-8 text-center">
      <div
        className="flex items-center gap-4 rounded-3xl px-10 py-4 text-6xl font-extrabold text-white"
        style={{ backgroundColor: cls.color }}
      >
        <span aria-hidden="true">{animalEmoji(cls.animal_icon)}</span>
        {cls.name}
      </div>
      {/* The SVG comes from the qrcode library, generated on the server from our own URL. */}
      <div className="w-full max-w-md" role="img" aria-label={mn.qr.alt} dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="text-3xl font-bold text-slate-800">{mn.qr.scan}</p>
      <p className="font-mono text-2xl text-slate-600">{url.replace(/^https?:\/\//, '')}</p>
    </main>
  );
}
