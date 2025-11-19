import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export const metadata = {
  title: 'Home | Rallio',
  description: 'Find badminton courts near you',
}

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get user profile
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, phone, profile_completed')
    .eq('id', user?.id)
    .single()

  // Get suggested courts
  const { data: courts } = await supabase
    .from('courts')
    .select(`
      id,
      name,
      hourly_rate,
      court_type,
      venue:venues(id, name, address)
    `)
    .eq('is_active', true)
    .limit(4)

  const firstName = userProfile?.display_name?.split(' ')[0] || 'Player'
  const profileCompleted = userProfile?.profile_completed ?? false

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-6 py-6 flex items-center justify-between border-b border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back, {firstName}!
          </h1>
          <p className="text-gray-500 mt-1">Ready to hit the court?</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Notification */}
          <button className="p-2 hover:bg-gray-100 rounded-full transition-colors relative">
            <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </button>
          {/* Avatar */}
          <Link href="/profile" className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center overflow-hidden">
            {userProfile?.avatar_url ? (
              <img src={userProfile.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-medium text-orange-600">
                {firstName.charAt(0).toUpperCase()}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-6">
        {/* Profile Completion Reminder */}
        {!profileCompleted && (
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
              <button className="p-1 hover:bg-white/10 rounded transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}
        {/* Quick Actions - Large Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link
            href="/courts"
            className="bg-primary hover:bg-primary/90 rounded-2xl p-6 flex flex-col justify-between min-h-[160px] transition-colors"
          >
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <span className="text-white text-lg font-semibold">Book a court</span>
          </Link>

          <Link
            href="/compete"
            className="bg-primary hover:bg-primary/90 rounded-2xl p-6 flex flex-col justify-between min-h-[160px] transition-colors"
          >
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <span className="text-white text-lg font-semibold">Compete</span>
          </Link>

          <Link
            href="/ai-help"
            className="bg-gradient-to-br from-rose-300 via-pink-300 to-orange-200 hover:from-rose-400 hover:via-pink-400 hover:to-orange-300 rounded-2xl p-6 flex flex-col justify-between min-h-[160px] transition-colors"
          >
            <div className="w-12 h-12 bg-white/30 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
            <span className="text-white text-lg font-semibold">Help AI</span>
          </Link>
        </div>

        {/* Suggested Courts */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Suggested Courts for you</h2>
            <Link href="/courts" className="text-sm font-medium text-primary hover:text-primary/80">
              See all
            </Link>
          </div>

          <div className="space-y-3">
            {courts && courts.length > 0 ? (
              courts.slice(0, 2).map((court: any) => (
                <Link
                  key={court.id}
                  href={`/courts/${court.venue?.id}`}
                  className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate">{court.venue?.name || court.name}</h3>
                    <p className="text-sm text-gray-500 truncate">
                      {court.venue?.address}
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))
            ) : (
              <>
                <Link href="/courts/1" className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-primary/30 hover:shadow-sm transition-all">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">SmashPoint Arena</h3>
                    <p className="text-sm text-gray-500">Tetuan, ZC</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link href="/courts/2" className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-primary/30 hover:shadow-sm transition-all">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">Rally Club Court</h3>
                    <p className="text-sm text-gray-500">Sta. Maria, ZC</p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </>
            )}
          </div>
        </section>

        {/* Near You */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Near you</h2>
            <Link href="/courts?sort=distance" className="text-sm font-medium text-primary hover:text-primary/80">
              See more
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Court Card 1 */}
            <div className="bg-gray-100 rounded-xl overflow-hidden">
              <div className="relative h-24 bg-gray-200 flex items-center justify-center">
                <span className="absolute top-2 right-2 bg-primary text-white text-[10px] px-2 py-0.5 rounded font-medium">
                  OPEN
                </span>
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="p-3">
                <h3 className="font-medium text-sm text-gray-900">DropZone Court</h3>
                <p className="text-xs text-gray-500 mt-0.5">La Purisima St., Zone II</p>
                <Link
                  href="/courts/1"
                  className="mt-3 block text-center border border-gray-300 text-gray-700 text-xs py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  See Court
                </Link>
              </div>
            </div>

            {/* Court Card 2 */}
            <div className="bg-gray-100 rounded-xl overflow-hidden">
              <div className="relative h-24 bg-gray-200 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="p-3">
                <h3 className="font-medium text-sm text-gray-900">AceCourt Arena</h3>
                <p className="text-xs text-gray-500 mt-0.5">Nuñez Ave., Tumaga</p>
                <Link
                  href="/courts/2"
                  className="mt-3 block text-center border border-gray-300 text-gray-700 text-xs py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  See Court
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
