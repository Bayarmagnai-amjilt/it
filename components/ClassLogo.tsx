import { isLogoUrl } from '@/lib/constants';

/**
 * The picture the teacher uploaded as the class logo, sized by the surrounding
 * text. Renders nothing when the class has no logo.
 * (Imported by components/ui.tsx, so it must not import ui itself.)
 */
export function ClassLogo({ icon }: { icon: string | null | undefined }) {
  if (!isLogoUrl(icon)) return null;
  // eslint-disable-next-line @next/next/no-img-element -- a tiny Storage picture; no optimisation needed
  return <img src={icon} alt="" className="inline-block h-[1.15em] w-[1.15em] rounded-[0.25em] object-contain align-[-0.2em]" />;
}
