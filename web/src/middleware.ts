import type { NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  // Delegates to the Supabase session updater which returns a NextResponse
  return await updateSession(request);
}

export const config = {
  // Run middleware for protected routes; adjust as needed
  matcher: [
    '/dashboard/:path*',
    '/profile/:path*',
    '/courts/:path*',
    '/queues/:path*',
    '/home/:path*',
    '/bookings/:path*',
    '/admin/:path*',
    '/(global-admin)/:path*',
  ],
};
