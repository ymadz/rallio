import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ProfileCompletionBanner } from '@/components/profile-completion-banner'
import { ActiveBookingBanner } from '@/components/booking/active-booking-banner'
import { NearbyQueues } from '@/components/home/nearby-queues'
import { UpcomingBookings } from '@/components/home/upcoming-bookings'
import { formatCurrency } from '@rallio/shared'
import { HomeTutorial } from '@/components/home/home-tutorial'
import { IOChat, IOChatCard } from '@/components/home/io-chat'

export const metadata = {
  title: 'Home | Rallio',
  description: 'Find badminton courts near you',
}

// Disable caching to always show fresh profile completion status
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function HomePage() {
  // ... existing generic supabase and data pulls
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
      image_url,
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

  // Get player profile for skill level etc.
  const { data: playerProfile } = await supabase
    .from('players')
    .select('skill_level, birth_date')
    .eq('user_id', user?.id)
    .single()

  // Get upcoming bookings (future bookings with active statuses)
  const { data: upcomingBookings } = user ? await supabase
    .from('reservations')
    .select(`
      id,
      start_time,
      end_time,
      status,
      total_amount,
      amount_paid,
      num_players,
      payment_type,
      notes,
      created_at,
      recurrence_group_id,
      metadata,
      cancellation_reason,
      courts (
        id,
        name,
        hourly_rate,
        court_images (
          url,
          is_primary,
          display_order
        ),
        venues (
          id,
          name,
          address,
          city,
          image_url
        )
      ),
      payments (
        id,
        status,
        payment_method,
        amount
      )
    `)
    .eq('user_id', user.id)
    .gte('start_time', new Date().toISOString())
    .in('status', ['pending_payment', 'confirmed', 'partially_paid', 'ongoing'])
    .order('start_time', { ascending: true })
    .limit(6) : { data: [] }



  // Logic: Check if critical fields are actually filled.
  // We ignore profile_completed flag for the banner display because users might have skipped it.
  // We want to remind them if they are missing critical info.
  // Birth date is optional, so we only require display_name and skill_level
  const isProfileTrulyComplete =
    !!userProfile?.display_name &&
    !!playerProfile?.skill_level

  return (
    <div className="min-h-screen bg-white">
      {/* Keyframe styles for card effects */}
      <style>{`
        @keyframes card-breathe {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.04); }
        }
        @keyframes card-lift {
          from { transform: translateY(0) scale(1); box-shadow: 0 4px 24px rgba(13,148,136,0.18); }
          to   { transform: translateY(-4px) scale(1.02); box-shadow: 0 16px 40px rgba(13,148,136,0.35); }
        }
        .quick-card {
          position: relative;
          overflow: hidden;
          border-radius: 1.5rem;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 160px;
          border: 1px solid rgba(255,255,255,0.22);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.28), 0 4px 24px rgba(13,148,136,0.18);
          transition: transform 0.32s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.32s ease;
          text-decoration: none;
        }
        .quick-card:hover {
          transform: translateY(-4px) scale(1.02);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.32), 0 16px 40px rgba(13,148,136,0.35);
        }
        .quick-card:hover .card-orbs {
          animation: card-breathe 3s ease-in-out infinite;
        }
        .card-noise {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          opacity: 0.045;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
          background-size: 180px 180px;
          mix-blend-mode: overlay;
        }
        .card-content {
          position: relative;
          z-index: 2;
        }
        .card-icon-wrap {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.12);
          backdrop-filter: blur(20px) saturate(1.8);
          -webkit-backdrop-filter: blur(20px) saturate(1.8);
          border: 1px solid rgba(255,255,255,0.35);
          box-shadow: 0 0 0 4px rgba(255,255,255,0.06), 0 4px 16px rgba(0,0,0,0.10);
          transition: background 0.28s ease, box-shadow 0.28s ease, transform 0.28s cubic-bezier(0.34,1.56,0.64,1);
        }
        .quick-card:hover .card-icon-wrap {
          background: rgba(255,255,255,0.20);
          box-shadow: 0 0 0 6px rgba(255,255,255,0.10), 0 6px 24px rgba(0,0,0,0.14);
          transform: scale(1.08);
        }
        .card-label {
          color: #fff;
          font-size: 1.125rem;
          font-weight: 600;
          text-shadow: 0 1px 6px rgba(0,0,0,0.18);
          letter-spacing: -0.01em;
        }

        /* ── Suggested Court Card ── */
        .sc-card {
          position: relative;
          border-radius: 1.125rem;
          overflow: hidden;
          border: 1px solid rgba(13,148,136,0.18);
          box-shadow: none;
          transition:
            transform 0.30s cubic-bezier(0.34,1.56,0.64,1),
            box-shadow 0.30s ease;
          text-decoration: none;
          display: block;
          height: 230px;
          background: linear-gradient(135deg, #ccfbf1 0%, #d1fae5 100%);
        }
        .sc-card:hover {
          transform: translateY(-4px) scale(1.015);
          box-shadow:
            0 2px 6px rgba(0,0,0,0.08),
            0 8px 28px rgba(13,148,136,0.16),
            0 16px 48px rgba(0,0,0,0.10);
        }
        .sc-card-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.40s cubic-bezier(0.34,1.56,0.64,1);
        }
        .sc-card:hover .sc-card-img {
          transform: scale(1.06);
        }
        .sc-card-placeholder {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #ccfbf1 0%, #a7f3d0 100%);
        }
        .sc-fog-gradient {
          position: absolute;
          left: 0; right: 0;
          bottom: 0;
          height: 55%;
          pointer-events: none;
          z-index: 2;
          background: linear-gradient(
            to bottom,
            transparent              0%,
            rgba(5,46,40,0.18)      30%,
            rgba(5,46,40,0.55)      60%,
            rgba(5,46,40,0.78)     100%
          );
        }
        .sc-fog-blur {
          position: absolute;
          left: 0; right: 0;
          bottom: 0;
          height: 38%;
          pointer-events: none;
          z-index: 3;
          backdrop-filter: blur(16px) saturate(1.4);
          -webkit-backdrop-filter: blur(16px) saturate(1.4);
          mask-image: linear-gradient(to bottom, transparent 0%, black 55%);
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 55%);
        }
        .sc-content {
          position: absolute;
          left: 0; right: 0;
          bottom: 0;
          z-index: 5;
          padding: 0.875rem 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .sc-name {
          font-size: 0.8125rem;
          font-weight: 700;
          color: #ffffff;
          line-height: 1.25;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          letter-spacing: -0.01em;
          text-shadow: 0 1px 4px rgba(0,0,0,0.4);
        }
        .sc-addr {
          font-size: 0.6875rem;
          color: rgba(204,251,241,0.85);
          line-height: 1.35;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .sc-price {
          font-size: 0.6875rem;
          font-weight: 600;
          color: #99f6e4;
          line-height: 1.3;
        }
        .sc-cta {
          display: block;
          width: 100%;
          margin-top: 7px;
          padding: 6px 0;
          background: rgba(255,255,255,0.15);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          color: #ffffff;
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-align: center;
          border-radius: 0.625rem;
          border: 1px solid rgba(255,255,255,0.28);
          text-decoration: none;
          transition: background 0.22s ease, transform 0.22s cubic-bezier(0.34,1.56,0.64,1);
        }
        .sc-card:hover .sc-cta {
          background: rgba(13,148,136,0.72);
          transform: scale(1.02);
        }
      `}</style>

      {/* Header */}


      {/* Main Content */}
      <div className="p-6">
        <HomeTutorial />

        {/* Profile Completion Reminder */}
        {!isProfileTrulyComplete && <ProfileCompletionBanner />}

        {/* Active Booking Banner */}
        <ActiveBookingBanner />

        {/* Quick Actions - Large Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">

          {/* Book a Court Card */}
          <Link href="/courts" className="quick-card"
            style={{ background: [
              'radial-gradient(ellipse 90% 70% at 15% 20%, rgba(20,184,166,0.65) 0%, transparent 55%)',
              'radial-gradient(ellipse 70% 80% at 90% 95%, rgba(6,182,212,0.50) 0%, transparent 55%)',
              'radial-gradient(ellipse 50% 50% at 55% 50%, rgba(153,246,228,0.18) 0%, transparent 60%)',
              'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)'
            ].join(', ') }}
          >
            <div className="card-noise" />
            <div className="card-content" style={{display:'flex', flexDirection:'column', justifyContent:'space-between', height:'100%', gap:'2rem'}}>
              <div className="card-icon-wrap">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <span className="card-label">Book a court</span>
            </div>
          </Link>

          {/* Queue Card */}
          <Link href="/queue" className="quick-card"
            style={{ background: [
              'radial-gradient(ellipse 80% 60% at 85% 15%, rgba(6,182,212,0.60) 0%, transparent 55%)',
              'radial-gradient(ellipse 75% 75% at 10% 90%, rgba(20,184,166,0.55) 0%, transparent 55%)',
              'radial-gradient(ellipse 40% 50% at 45% 45%, rgba(204,251,241,0.18) 0%, transparent 65%)',
              'linear-gradient(145deg, #0f766e 0%, #0d9488 55%, #06b6d4 100%)'
            ].join(', ') }}
          >
            <div className="card-noise" />
            <div className="card-content" style={{display:'flex', flexDirection:'column', justifyContent:'space-between', height:'100%', gap:'2rem'}}>
              <div className="card-icon-wrap">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 10H9m6 4a7 7 0 11-14 0 7 7 0 0114 0zM9 15h6" />
                </svg>
              </div>
              <span className="card-label">Queue</span>
            </div>
          </Link>

          {/* My Bookings Card */}
          <Link href="/bookings" className="quick-card"
            style={{ background: [
              'radial-gradient(ellipse 75% 65% at 50% 5%, rgba(103,232,249,0.50) 0%, transparent 55%)',
              'radial-gradient(ellipse 80% 70% at 95% 95%, rgba(13,148,136,0.65) 0%, transparent 50%)',
              'radial-gradient(ellipse 45% 55% at 15% 60%, rgba(153,246,228,0.22) 0%, transparent 60%)',
              'linear-gradient(155deg, #06b6d4 0%, #0d9488 55%, #0f766e 100%)'
            ].join(', ') }}
          >
            <div className="card-noise" />
            <div className="card-content" style={{display:'flex', flexDirection:'column', justifyContent:'space-between', height:'100%', gap:'2rem'}}>
              <div className="card-icon-wrap">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <span className="card-label">My Bookings</span>
            </div>
          </Link>

          {/* Ask IO Card */}
          <IOChatCard />

        </div>

        {/* Suggested Courts */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Suggested Courts for you</h2>
            <Link href="/courts" className="text-sm font-medium text-primary hover:text-primary/80">
              See all
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {suggestedVenues && suggestedVenues.length > 0 ? (
              suggestedVenues.map((venue: any) => {
                const courtPrimaryImg = venue.courts
                  ?.flatMap((c: any) => c.court_images || [])
                  .find((img: any) => img.is_primary)
                const courtFallbackImg = venue.courts?.[0]?.court_images?.[0]?.url
                const imageUrl = (venue as any).image_url || courtPrimaryImg?.url || courtFallbackImg

                const rawPrices = venue.courts?.map((c: any) => c.hourly_rate) || []
                const prices = rawPrices.filter((rate: any) => typeof rate === 'number' && !isNaN(rate) && rate > 0)
                const minPrice = prices.length > 0 ? Math.min(...prices) : null
                const maxPrice = prices.length > 0 ? Math.max(...prices) : null

                return (
                  <Link key={venue.id} href={`/courts/${venue.id}`} className="sc-card">
                    {imageUrl ? (
                      <img src={imageUrl} alt={venue.name} className="sc-card-img" />
                    ) : (
                      <div className="sc-card-placeholder">
                        <svg style={{ width: 36, height: 36, color: '#0d9488', opacity: 0.4 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}

                    <div className="sc-fog-gradient" />
                    <div className="sc-fog-blur" />

                    <div className="sc-content">
                      <div className="sc-name">{venue.name}</div>
                      <div className="sc-addr">{venue.address}</div>
                      {minPrice !== null && maxPrice !== null && (
                        <div className="sc-price">
                          💰 {minPrice === maxPrice
                            ? formatCurrency(minPrice)
                            : `${formatCurrency(minPrice)} – ${formatCurrency(maxPrice)}`}
                          /hr
                        </div>
                      )}
                      <span className="sc-cta">See Court →</span>
                    </div>
                  </Link>
                )
              })
            ) : (
              <div className="col-span-full bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
                <p className="text-sm text-gray-500 mb-2">No courts available at the moment</p>
                <Link href="/courts" className="text-sm font-medium text-primary hover:text-primary/80">
                  Browse all courts
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Active Queues Nearby - Only shows if there are active queues */}
        <NearbyQueues />

        {/* Your Upcoming Bookings */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Your Upcoming Bookings</h2>
            <Link href="/bookings" className="text-sm font-medium text-primary hover:text-primary/80">
              See all
            </Link>
          </div>

          <UpcomingBookings bookings={(upcomingBookings || []) as any} />
        </section>
      </div>

      {/* IO Chatbot */}
      <IOChat />
    </div>
  )
}
