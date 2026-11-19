// Browser only: scales a picture down before it is uploaded, so even a phone
// photo becomes a small file. GIFs stay as they are (they may be animated).
// Returns the original file when the browser cannot do it.
import { LOGO_TYPES } from '@/lib/constants';

export async function shrinkImage(file: File, maxPixels: number): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxPixels / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    // browsers without WebP encoding hand back a PNG instead
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.85));
    if (!blob || !LOGO_TYPES[blob.type]) return file;
    return new File([blob], `image.${LOGO_TYPES[blob.type]}`, { type: blob.type });
  } catch {
    return file;
  }
}
