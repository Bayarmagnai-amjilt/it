import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

// Next.js 16 calls this file proxy.ts (it was middleware.ts in earlier versions).
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Teacher area, projector pages, API routes, and the login / auth pages.
  // Student and public pages do not use the teacher session and are skipped.
  matcher: ['/t/:path*', '/present/:path*', '/api/:path*', '/teacher/:path*', '/auth/:path*'],
};
