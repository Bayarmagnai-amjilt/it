import { headers } from 'next/headers';

/** Public address of the site, e.g. https://amjilt-it.vercel.app (no trailing slash). */
export async function siteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '');
  if (configured && !configured.includes('localhost')) return configured;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (!host) return configured ?? 'http://localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || null;
}

export async function userAgent(): Promise<string> {
  return (await headers()).get('user-agent') ?? '';
}
