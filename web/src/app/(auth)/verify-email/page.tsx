'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Alert } from '@/components/ui/alert'

export default function VerifyEmailPage() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') || ''
  const [isResending, setIsResending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleResendEmail = async () => {
    if (!email) {
      setError('No email address provided')
      return
    }

    setIsResending(true)
    setError(null)
    setMessage(null)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setError(error.message)
        return
      }

      setMessage('Verification email sent! Check your inbox.')
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="space-y-6 text-center">
      {/* Icon */}
      <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
        <svg
          className="w-8 h-8 text-primary"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
        <p className="text-muted-foreground">
          We sent a verification link to
        </p>
        <p className="font-medium">{email || 'your email'}</p>
      </div>

      {/* Messages */}
      {error && (
        <Alert variant="destructive">
          {error}
        </Alert>
      )}

      {message && (
        <Alert>
          {message}
        </Alert>
      )}

      {/* Instructions */}
      <div className="text-sm text-muted-foreground space-y-2">
        <p>Click the link in the email to verify your account.</p>
        <p>If you don't see it, check your spam folder.</p>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <Button
          onClick={handleResendEmail}
          variant="outline"
          className="w-full"
          disabled={isResending}
        >
          {isResending ? 'Sending...' : 'Resend email'}
        </Button>

        <Link href="/login">
          <Button variant="ghost" className="w-full">
            Back to login
          </Button>
        </Link>
      </div>
    </div>
  )
}
