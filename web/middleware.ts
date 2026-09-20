import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getUser();

  return supabaseResponse;
}

// Only the routes that actually read the session on the server. The previous
// matcher caught every request that was not a static asset — including the
// public pages, /api/track and sitemap.xml — and each of those cost a function
// invocation just to fall through. Public pages now resolve auth in the
// browser, so they do not belong here.
export const config = {
  matcher: [
    '/profil/:path*',
    '/benachrichtigungen/:path*',
    '/einstellungen/:path*',
    '/fuer-dich/:path*',
    '/admin/:path*',
  ],
};
