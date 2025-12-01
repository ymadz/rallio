import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired
  const { data: { user } } = await supabase.auth.getUser();

  // Check if user is banned or deactivated
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_banned, is_active, banned_until')
      .eq('id', user.id)
      .single();

    if (profile) {
      // Check if user is banned (permanently or temporarily)
      if (profile.is_banned) {
        if (profile.banned_until) {
          const bannedUntil = new Date(profile.banned_until);
          if (bannedUntil > new Date()) {
            // Still suspended, redirect to login
            return NextResponse.redirect(new URL('/login?error=suspended', request.url));
          }
        } else {
          // Permanently banned
          return NextResponse.redirect(new URL('/login?error=banned', request.url));
        }
      }

      // Check if account is deactivated
      if (!profile.is_active) {
        return NextResponse.redirect(new URL('/login?error=deactivated', request.url));
      }
    }
  }

  return supabaseResponse;
}
