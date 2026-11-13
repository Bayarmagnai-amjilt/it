import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Nunito, Unbounded } from 'next/font/google';
import type { ReactNode } from 'react';
import { mn } from '@/locales/mn';
import './globals.css';

// "cyrillic-ext" matters: the Mongolian letters Ө and Ү are not in the plain
// "cyrillic" subset and would otherwise fall back to a different font.
const display = Unbounded({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  weight: ['500', '600', '700', '800', '900'],
  variable: '--font-display',
  display: 'swap',
});
const body = Nunito({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-body',
  display: 'swap',
});
const code = JetBrains_Mono({
  subsets: ['latin', 'cyrillic', 'cyrillic-ext'],
  weight: ['500', '700'],
  variable: '--font-code',
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
    <html lang="mn" className={`${display.variable} ${body.variable} ${code.variable}`}>
      <body className="min-h-screen font-sans text-ink-900 antialiased">{children}</body>
    </html>
  );
}
