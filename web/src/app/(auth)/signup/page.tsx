'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert } from '@/components/ui/alert'
import { PhoneInput, validatePhilippinePhone } from '@/components/ui/phone-input'
import { getPublicSettings } from '@/app/actions/global-admin-settings-actions'
import { LegalContentDialog } from '@/components/auth/legal-content-dialog'
import { DEFAULT_PRIVACY_POLICY, DEFAULT_TERMS_AND_CONDITIONS } from '@/lib/legal-content'

type SignupStep = 'details' | 'phone'

interface SignupData {
  firstName: string
  middleInitial: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
  phoneNumber: string
  agreeToTerms: boolean
}

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<SignupStep>('details')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Legal modal state
  const [legalModal, setLegalModal] = useState<{ open: boolean; type: 'terms' | 'privacy' }>({
    open: false,
    type: 'terms',
  })
  const [legalContent, setLegalContent] = useState<{ terms: string; privacy: string }>({
    terms: '',
    privacy: '',
  })
  
  // Fetch legal content on mount
  useEffect(() => {
    const fetchContent = async () => {
      try {
        const [termsRes, privacyRes] = await Promise.all([
          getPublicSettings('terms_and_conditions'),
          getPublicSettings('privacy_policy')
        ])
        
        setLegalContent({
          terms: termsRes.success && termsRes.data && (termsRes.data as any).setting_value?.content 
            ? (termsRes.data as any).setting_value.content 
            : DEFAULT_TERMS_AND_CONDITIONS,
          privacy: privacyRes.success && privacyRes.data && (privacyRes.data as any).setting_value?.content 
            ? (privacyRes.data as any).setting_value.content 
            : DEFAULT_PRIVACY_POLICY,
        })
      } catch (err) {
        console.error('Failed to fetch legal content', err)
        // Set defaults on error
        setLegalContent({
          terms: DEFAULT_TERMS_AND_CONDITIONS,
          privacy: DEFAULT_PRIVACY_POLICY,
        })
      }
    }
    fetchContent()
  }, [])

  const openLegalModal = (e: React.MouseEvent, type: 'terms' | 'privacy') => {
    e.preventDefault() // Prevent label click propagation
    setLegalModal({ open: true, type })
  }

  const [formData, setFormData] = useState<SignupData>({
    firstName: '',
    middleInitial: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phoneNumber: '',
    agreeToTerms: false,
  })

  const updateFormData = (field: keyof SignupData, value: string | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const handleDetailsSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password) {
      setError('Please fill in all required fields')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    if (!formData.agreeToTerms) {
      setError('Please agree to the Terms and Conditions')
      return
    }

    setStep('phone')
  }

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validate Philippine phone number
    if (!validatePhilippinePhone(formData.phoneNumber)) {
      setError('Please enter a valid Philippine mobile number (10 digits starting with 9)')
      return
    }

    setIsLoading(true)

    try {
      const supabase = createClient()

      const fullName = [
        formData.firstName,
        formData.middleInitial,
        formData.lastName,
      ]
        .filter(Boolean)
        .join(' ')

      const { data: authData, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: fullName,
            first_name: formData.firstName,
            middle_initial: formData.middleInitial,
            last_name: formData.lastName,
            phone_number: formData.phoneNumber,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setError(error.message)
        return
      }

      // Profile and player records are automatically created by database trigger (handle_new_user)
      // No need for manual inserts here

      // Redirect to verification page
      router.push(`/verify-email?email=${encodeURIComponent(formData.email)}`)
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const redirectUrl = `${window.location.origin}/auth/callback`
      console.log('🔍 [Google Signup] Redirect URL:', redirectUrl)
      
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      console.log('🔍 [Google Signup] OAuth response:', { data, error })

      if (error) {
        console.error('❌ [Google Signup] Error:', error)
        setError(error.message)
      }
    } catch (err) {
      console.error('❌ [Google Signup] Unexpected error:', err)
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  if (step === 'phone') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 border-2 border-primary rotate-45 flex items-center justify-center mb-4">
            <svg
              className="-rotate-45 w-8 h-8 text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Ready to Rally?</h1>
          <p className="text-muted-foreground text-sm">
            Enter your number so we can keep you updated on your next match!
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            {error}
          </Alert>
        )}

        {/* Phone Form */}
        <form onSubmit={handlePhoneSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">Mobile Number (Philippines)</Label>
            <PhoneInput
              id="phoneNumber"
              value={formData.phoneNumber}
              onChange={(value) => updateFormData('phoneNumber', value)}
              disabled={isLoading}
              placeholder="9XX XXX XXXX"
            />
            <p className="text-xs text-muted-foreground">
              Enter your 10-digit Philippine mobile number
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? 'Creating account...' : 'Continue'}
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setStep('details')}
            disabled={isLoading}
          >
            Back
          </Button>
        </form>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Sign up</h1>
        <p className="text-muted-foreground text-sm">Create an account to get started</p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          {error}
        </Alert>
      )}

      {/* Signup Form */}
      <form onSubmit={handleDetailsSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name *</Label>
            <Input
              id="firstName"
              placeholder="First Name"
              value={formData.firstName}
              onChange={(e) => updateFormData('firstName', e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="middleInitial">Middle Initial</Label>
            <Input
              id="middleInitial"
              placeholder="M.I."
              value={formData.middleInitial}
              onChange={(e) => updateFormData('middleInitial', e.target.value)}
              disabled={isLoading}
              maxLength={2}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name *</Label>
          <Input
            id="lastName"
            placeholder="Last Name"
            value={formData.lastName}
            onChange={(e) => updateFormData('lastName', e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email *</Label>
          <Input
            id="email"
            type="email"
            placeholder="name@email.com"
            value={formData.email}
            onChange={(e) => updateFormData('email', e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password *</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Create a password"
              value={formData.password}
              onChange={(e) => updateFormData('password', e.target.value)}
              required
              disabled={isLoading}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password *</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              placeholder="Confirm password"
              value={formData.confirmPassword}
              onChange={(e) => updateFormData('confirmPassword', e.target.value)}
              required
              disabled={isLoading}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirmPassword ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Terms checkbox */}
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="terms"
            checked={formData.agreeToTerms}
            onChange={(e) => updateFormData('agreeToTerms', e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <Label htmlFor="terms" className="text-sm font-normal leading-snug">
            I've read and agree with the{' '}
            <button 
              type="button" 
              onClick={(e) => openLegalModal(e, 'terms')}
              className="text-primary hover:underline hover:text-primary/90 inline-block font-normal p-0 h-auto"
            >
              Terms and Conditions
            </button>{' '}
            and the{' '}
            <button 
              type="button" 
              onClick={(e) => openLegalModal(e, 'privacy')}
              className="text-primary hover:underline hover:text-primary/90 inline-block font-normal p-0 h-auto"
            >
              Privacy Policy
            </button>
          </Label>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isLoading}
        >
          Sign up
        </Button>
      </form>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or
          </span>
        </div>
      </div>

      {/* Google OAuth */}
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={handleGoogleSignup}
        disabled={isLoading}
      >
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continue with Google
      </Button>

      {/* Login link */}
      <div className="text-center text-sm">
        <span className="text-muted-foreground">Already have an account? </span>
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </div>

      <LegalContentDialog
        open={legalModal.open}
        onOpenChange={(open) => setLegalModal(prev => ({ ...prev, open }))}
        type={legalModal.type}
        content={legalModal.type === 'terms' ? legalContent.terms : legalContent.privacy}
      />
    </div>
  )
}
