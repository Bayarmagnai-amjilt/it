import type { Metadata, Viewport } from 'next';
import { Montserrat, Noto_Sans } from 'next/font/google';
import type { ReactNode } from 'react';
import { mn } from '@/locales/mn';
import './globals.css';

// "cyrillic-ext" matters: the Mongolian letters Ө and Ү are not in the plain
// "cyrillic" subset and would otherwise fall back to a different font.
const heading = Montserrat({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-heading-face',
  display: 'swap',
});
const body = Noto_Sans({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: mn.app.name, template: `%s · ${mn.app.name}` },
  description: mn.app.tagline,
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="mn" className={`${heading.variable} ${body.variable}`}>
      <body className="min-h-screen bg-ink-50 font-sans text-ink-900 antialiased">{children}</body>
    </html>
  );
}
