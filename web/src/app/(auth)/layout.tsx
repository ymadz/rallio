import Link from 'next/link'
import Image from 'next/image'
import logo from '@/assets/logo.png'
import { getPublicSettings } from '@/app/actions/global-admin-settings-actions'
import { TermsPrivacyModal } from '@/components/auth/terms-privacy-modal'
import { DEFAULT_PRIVACY_POLICY, DEFAULT_TERMS_AND_CONDITIONS } from '@/lib/legal-content'

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Fetch terms and privacy content
  const termsResult = await getPublicSettings('terms_and_conditions')
  const privacyResult = await getPublicSettings('privacy_policy')

  const termsContent = termsResult.success && termsResult.data && (termsResult.data as any).setting_value?.content
    ? (termsResult.data as any).setting_value.content 
    : DEFAULT_TERMS_AND_CONDITIONS
    
  const privacyContent = privacyResult.success && privacyResult.data && (privacyResult.data as any).setting_value?.content
    ? (privacyResult.data as any).setting_value.content 
    : DEFAULT_PRIVACY_POLICY

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-rallio-gradient relative overflow-hidden">
        {/* Background pattern overlay */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full p-12">
          {/* Logo */}
          <div className="mb-8">
            <Image
              src={logo}
              alt="Rallio"
              className="w-20 h-20 brightness-0 invert"
              width={80}
              height={80}
            />
          </div>

          <h1 className="text-4xl font-bold text-white mb-4">Rallio</h1>
          <p className="text-white/80 text-center text-lg max-w-md">
            Find and book badminton courts in Zamboanga City. Join queues, track your games, and connect with players.
          </p>

          {/* Feature highlights */}
          <div className="mt-12 space-y-4 text-white/70">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Discover nearby courts</span>
            </div>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Easy online booking</span>
            </div>
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>Real-time queue management</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex flex-col">
        {/* Mobile logo */}
        <div className="lg:hidden bg-rallio-gradient p-6 flex items-center justify-center">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src={logo}
              alt="Rallio"
              className="w-10 h-10"
              width={40}
              height={40}
            />
            <span className="text-xl font-bold text-white">Rallio</span>
          </Link>
        </div>

        {/* Form content */}
        <div className="flex-1 flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md">
            {children}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 text-center text-sm text-muted-foreground">
          <TermsPrivacyModal 
            termsContent={termsContent} 
            privacyContent={privacyContent} 
          />
        </div>
      </div>
    </div>
  )
}
