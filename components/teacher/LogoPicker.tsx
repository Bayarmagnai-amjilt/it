'use client';

import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Button, buttonClass, cn } from '@/components/ui';
import { isLogoUrl, LOGO_MAX_BYTES, LOGO_PIXELS, LOGO_TYPES } from '@/lib/constants';
import { shrinkImage } from '@/lib/shrink-image';
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
    const file = await shrinkImage(picked, LOGO_PIXELS);
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

