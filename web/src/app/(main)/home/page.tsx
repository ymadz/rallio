import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ProfileCompletionBanner } from '@/components/profile-completion-banner'
import { NearbyVenues } from '@/components/home/nearby-venues'
import { NearbyQueues } from '@/components/home/nearby-queues'
import { formatCurrency } from '@rallio/shared'

export const metadata = {
  title: 'Home | Rallio',
  description: 'Find badminton courts near you',
}

// Disable caching to always show fresh profile completion status
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get user profile - with fresh data to show correct banner state
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url, phone, profile_completed')
    .eq('id', user?.id)
    .single()

  // Get suggested venues with full details
  const { data: suggestedVenues } = await supabase
    .from('venues')
    .select(`
      id,
      name,
      address,
      latitude,
      longitude,
      opening_hours,
      courts (
        id,
        name,
        hourly_rate,
        court_type,
        is_active,
        court_images (
          url,
          is_primary,
          display_order
        )
      )
    `)
    .eq('is_active', true)
    .eq('is_verified', true) // Only show verified/approved venues
    .eq('courts.is_active', true)
    .limit(3)

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
        {!profileCompleted && <ProfileCompletionBanner />}

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
            href="/queue"
            className="bg-primary hover:bg-primary/90 rounded-2xl p-6 flex flex-col justify-between min-h-[160px] transition-colors"
          >
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 10H9m6 4a7 7 0 11-14 0 7 7 0 0114 0zM9 15h6" />
              </svg>
            </div>
            <span className="text-white text-lg font-semibold">Queue</span>
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
            {suggestedVenues && suggestedVenues.length > 0 ? (
              suggestedVenues.slice(0, 2).map((venue: any) => {
                // Get primary image or first available image
                const primaryImage = venue.courts
                  ?.flatMap((c: any) => c.court_images || [])
                  .find((img: any) => img.is_primary)
                const imageUrl = primaryImage?.url || venue.courts?.[0]?.court_images?.[0]?.url

                // Calculate price range
                const prices = venue.courts?.map((c: any) => c.hourly_rate) || []
                const minPrice = prices.length > 0 ? Math.min(...prices) : null
                const maxPrice = prices.length > 0 ? Math.max(...prices) : null

                return (
                  <Link
                    key={venue.id}
                    href={`/courts/${venue.id}`}
                    className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-xl hover:border-primary/30 hover:shadow-sm transition-all"
                  >
                    <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {imageUrl ? (
                        <img src={imageUrl} alt={venue.name} className="w-full h-full object-cover" />
                      ) : (
                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{venue.name}</h3>
                      <p className="text-sm text-gray-500 truncate">{venue.address}</p>
                      {minPrice !== null && maxPrice !== null && (
                        <p className="text-xs text-primary font-medium mt-1">
                          {minPrice === maxPrice
                            ? formatCurrency(minPrice)
                            : `${formatCurrency(minPrice)} - ${formatCurrency(maxPrice)}`}
                          /hr
                        </p>
                      )}
                    </div>
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )
              })
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
                <p className="text-sm text-gray-500 mb-2">No courts available at the moment</p>
                <Link
                  href="/courts"
                  className="text-sm font-medium text-primary hover:text-primary/80"
                >
                  Browse all courts
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Active Queues Nearby - Only shows if there are active queues */}
        <NearbyQueues />

        {/* Near You */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Near you</h2>
            <Link href="/courts?sort=distance" className="text-sm font-medium text-primary hover:text-primary/80">
              See more
            </Link>
          </div>

          <NearbyVenues />
        </section>
      </div>
    </div>
  )
}
