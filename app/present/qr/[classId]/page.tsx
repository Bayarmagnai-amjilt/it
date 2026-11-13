import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';
import { ClassLogo } from '@/components/ClassLogo';
import { requireTeacher } from '@/lib/auth/teacher';
import { isUuid } from '@/lib/constants';
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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <div
        className="flex items-center gap-4 rounded-3xl border-4 border-ink-900 px-10 py-4 font-heading text-6xl font-bold text-white shadow-brut-lg [text-shadow:0_3px_0_rgb(0_0_0/0.25)]"
        style={{ backgroundColor: cls.color }}
      >
        <ClassLogo icon={cls.animal_icon} />
        {cls.name}
      </div>
      {/* The SVG comes from the qrcode library, generated on the server from our own URL. */}
      <div
        className="w-full max-w-md rounded-3xl border-4 border-ink-900 bg-white p-4 shadow-brut-lg"
        role="img"
        aria-label={mn.qr.alt}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="text-3xl font-extrabold text-ink-900">{mn.qr.scan}</p>
      <p className="rounded-xl border-2 border-ink-900 bg-sun-100 px-4 py-1 font-mono text-2xl font-bold text-ink-900">
        {url.replace(/^https?:\/\//, '')}
      </p>
    </main>
  );
}
