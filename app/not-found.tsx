import Link from 'next/link';
import { BrandMark } from '@/components/Brand';
import { mn } from '@/locales/mn';

export default function NotFound() {
  return (
    <main className="hero-pattern flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center text-white">
      <BrandMark size="xl" />
      <p className="font-heading text-7xl font-black text-brand-300">404</p>
      <h1 className="text-3xl font-black">{mn.notFound.title}</h1>
      <p className="text-ink-100">{mn.notFound.hint}</p>
      <Link
        href="/"
        className="mt-2 inline-flex min-h-14 items-center rounded-full bg-brand-500 px-8 font-heading text-xl font-bold text-white hover:bg-brand-400"
      >
        {mn.common.home}
      </Link>
    </main>
  );
}
