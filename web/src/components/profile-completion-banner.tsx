'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function ProfileCompletionBanner() {
  const [dismissed, setDismissed] = useState(false)
  const router = useRouter()

  const handleDismiss = async () => {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        // Mark profile as completed when dismissed
        await supabase
          .from('profiles')
          .update({ profile_completed: true })
          .eq('id', user.id)
      }

      setDismissed(true)
      router.refresh()
    } catch (err) {
      console.error('Error dismissing banner:', err)
      setDismissed(true) // Dismiss anyway for better UX
    }
  }

  if (dismissed) return null

  return (
    <div className="mb-6 bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-6 text-white">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-lg mb-1">Complete Your Profile</h3>
          <p className="text-white/80 text-sm mb-4">
            Set up your player profile to get matched with the right courts and players based on your skill level and preferences.
          </p>
          <Link
            href="/setup-profile?from=reminder"
            className="inline-flex items-center gap-2 bg-white text-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-white/90 transition-colors"
          >
            Complete Setup
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-white/10 rounded transition-colors"
          aria-label="Dismiss"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
