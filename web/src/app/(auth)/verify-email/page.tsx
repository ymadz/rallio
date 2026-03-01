'use client';

import { useState, Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const [isResending, setIsResending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    const interval = setInterval(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user?.email_confirmed_at) {
          router.replace('/home');
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [router]);

  const handleResendEmail = async () => {
    if (!email) {
      setError('No email address provided');
      return;
    }

    setIsResending(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setError(error.message);
        return;
      }

      setMessage('Verification email sent. Please check your inbox.');
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 text-center max-w-md mx-auto px-4">
      {/* Brand Logo - Ensure logo.png is in your /public folder */}
      <div className="mb-2">
        <Image 
          src="/logo.png" 
          alt="Rallio Logo" 
          width={80} 
          height={80} 
          priority
          className="rounded-lg shadow-sm"
        />
      </div>

      {/* Header Section */}
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Verify your email</h1>
        <p className="text-slate-500 text-lg">
          To finish setting up your account, we sent a verification link to:
        </p>
        <p className="text-xl font-semibold text-slate-900 underline decoration-primary/30 underline-offset-4">
          {email || 'your email'}
        </p>
      </div>

      {/* Status Messages */}
      <div className="w-full max-w-sm">
        {error && <Alert variant="destructive" className="animate-in fade-in zoom-in duration-300">{error}</Alert>}
        {message && <Alert className="border-green-200 bg-green-50 text-green-800 animate-in fade-in zoom-in duration-300">{message}</Alert>}
      </div>

      {/* Minimalist Instructions */}
      <div className="text-sm text-slate-400 space-y-1">
        <p>Click the link in the email to confirm your account.</p>
        <p>If you don't see it, please check your spam folder.</p>
      </div>

      <hr className="w-16 border-slate-200" />

      {/* Actions */}
      <div className="w-full max-w-sm space-y-4">
        <Button
          onClick={handleResendEmail}
          className="w-full h-12 text-base font-semibold bg-slate-950 hover:bg-slate-800 transition-colors"
          disabled={isResending}
        >
          {isResending ? 'Sending Link...' : 'Resend verification email'}
        </Button>

        <Link href="/login" className="block text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">
          Back to login
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-slate-400">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}