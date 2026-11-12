import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './env';

/** Pages that need a signed-in teacher. "/teacher/login" is NOT one of them. */
function needsTeacher(pathname: string): boolean {
  return (
    pathname === '/t' ||
    pathname.startsWith('/t/') ||
    pathname.startsWith('/present/') ||
    pathname.startsWith('/api/')
  );
}

/**
 * Runs before teacher pages: refreshes the teacher's session cookies (Server
 * Components cannot write cookies themselves) and sends visitors who are not
 * signed in to the login page.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) return response;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // Do not put code between createServerClient and getUser: the call below is
  // what refreshes an expired session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  if (!user && needsTeacher(pathname)) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/teacher/login';
    url.search = '';
    return NextResponse.redirect(url);
  }
  return response;
}
