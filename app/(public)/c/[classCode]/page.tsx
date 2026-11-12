import { notFound, redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// Target of the class QR code: /c/<class code> jumps straight to that class.
export default async function ClassCodePage({ params }: { params: Promise<{ classCode: string }> }) {
  const { classCode } = await params;
  const code = decodeURIComponent(classCode).trim().toLowerCase();
  if (!/^[a-z0-9]{6,20}$/.test(code)) notFound();

  const { data } = await createAdminClient().rpc('class_id_by_code', { p_class_code: code });
  if (!data) notFound();
  redirect(`/class/${data}?code=${code}`);
}
