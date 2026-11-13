'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button, buttonClass, cn } from '@/components/ui';
import { isLogoUrl, LOGO_MAX_BYTES, LOGO_PIXELS, LOGO_TYPES } from '@/lib/constants';
import { mn } from '@/locales/mn';

/**
 * Class logo inside a class form: upload a picture, replace it or take it away.
 * Sends the picture as `logo`, and `logo_remove` = '1' when the current logo
 * should go. Without either, the logo stays as it is.
 */
export function LogoPicker({ current }: { current?: string }) {
  const uploaded = isLogoUrl(current) ? current : null;
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [bad, setBad] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const shown = preview ?? (removed ? null : uploaded);

  // free the previous preview picture when a new one replaces it
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const picked = input.files?.[0];
    if (!picked) return;
    const file = await shrink(picked);
    if (!LOGO_TYPES[file.type] || file.size > LOGO_MAX_BYTES) {
      input.value = '';
      setBad(true);
      return;
    }
    if (file !== picked) {
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
      } catch {
        // older browser: the original file is sent and checked on the server
      }
    }
    setBad(false);
    setPreview(URL.createObjectURL(file));
  }

  function remove() {
    if (fileRef.current) fileRef.current.value = '';
    setPreview(null);
    setRemoved(true);
    setBad(false);
  }

  return (
    <fieldset>
      <legend className="mb-1 text-sm font-bold text-ink-900">{mn.classes.logo}</legend>
      {removed && !preview ? <input type="hidden" name="logo_remove" value="1" /> : null}
      <div className="flex items-center gap-3">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-ink-900 bg-white text-center text-[0.65rem] font-semibold leading-tight text-slate-500">
          {/* eslint-disable-next-line @next/next/no-img-element -- local preview or a tiny Storage picture */}
          {shown ? <img src={shown} alt="" className="h-full w-full object-contain" /> : mn.classes.logoNone}
        </span>
        <div className="flex flex-wrap gap-2">
          <label className={buttonClass('secondary', 'sm', 'cursor-pointer focus-within:ring-4 focus-within:ring-brand-200')}>
            <span aria-hidden="true">📷</span> {shown ? mn.classes.logoChange : mn.classes.logoUpload}
            <input
              ref={fileRef}
              type="file"
              name="logo"
              accept={Object.keys(LOGO_TYPES).join(',')}
              onChange={onFile}
              className="sr-only"
            />
          </label>
          {shown ? (
            <Button type="button" size="sm" variant="ghost" onClick={remove}>
              {mn.classes.logoRemove}
            </Button>
          ) : null}
        </div>
      </div>
      <p className={cn('mt-1 text-xs', bad ? 'font-semibold text-red-700' : 'text-slate-500')}>
        {bad ? mn.classes.logoBadFile : mn.classes.logoHint}
      </p>
    </fieldset>
  );
}

/**
 * Scales a picture down to LOGO_PIXELS on its longer side, so even a phone
 * photo becomes a few kilobytes. GIFs stay as they are (they may be animated).
 * Returns the original file if the browser cannot do it.
 */
async function shrink(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, LOGO_PIXELS / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    // browsers without WebP encoding hand back a PNG instead
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9));
    if (!blob || !LOGO_TYPES[blob.type]) return file;
    return new File([blob], `logo.${LOGO_TYPES[blob.type]}`, { type: blob.type });
  } catch {
    return file;
  }
}
