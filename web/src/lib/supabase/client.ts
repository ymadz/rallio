import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://angddotiqwhhktqdkiyx.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFuZ2Rkb3RpcXdoaGt0cWRraXl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0MzMxNTksImV4cCI6MjA3OTAwOTE1OX0.dKpIkOzctWTg9RKQ69aa1SNat84bCC3GZzE-RoZm1EA'
  );
}
