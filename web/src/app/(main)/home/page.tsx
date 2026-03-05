import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ProfileCompletionBanner } from '@/components/profile-completion-banner'
import { ActiveBookingBanner } from '@/components/booking/active-booking-banner'
import { NearbyVenues } from '@/components/home/nearby-venues'
import { NearbyQueues } from '@/components/home/nearby-queues'
import { formatCurrency } from '@rallio/shared'
import { HomeTutorial } from '@/components/home/home-tutorial'

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

        /* ── Suggested Court Card: Studio-Lighting Surface ── */
        @keyframes suggested-shimmer {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }
        .suggested-card {
          position: relative;
          overflow: hidden;
          border-radius: 1.25rem;
          padding: 0;
          display: flex;
          align-items: stretch;
          text-decoration: none;
          /* Studio-lighting gradient applied per-card via inline style prop */
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.14),
            inset 0 -1px 0 rgba(0,0,0,0.08);
          transition:
            transform 0.36s cubic-bezier(0.34,1.56,0.64,1),
            box-shadow 0.36s ease;
        }
        .suggested-card:hover {
          transform: translateY(-3px) scale(1.012);
          box-shadow:
            inset 0 1px 0 rgba(255,255,255,0.18),
            inset 0 -1px 0 rgba(0,0,0,0.06),
            0 4px 16px rgba(13,148,136,0.22),
            0 20px 48px rgba(8,70,64,0.28);
        }
        /* High-frequency matte noise overlay */
        .suggested-card-noise {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 1;
          opacity: 0.055;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='sn'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23sn)' opacity='1'/%3E%3C/svg%3E");
          background-size: 150px 150px;
          mix-blend-mode: overlay;
        }
        /* Diagonal highlight sweep – the "studio light" */
        .suggested-card-highlight {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 2;
          background: linear-gradient(
            135deg,
            rgba(204,251,241,0.16) 0%,
            rgba(153,246,228,0.06) 30%,
            transparent 55%,
            rgba(0,0,0,0.04) 100%
          );
        }
        /* Subtle shimmer on hover */
        .suggested-card:hover .suggested-card-shimmer {
          animation: suggested-shimmer 2.4s ease-in-out infinite;
        }
        .suggested-card-shimmer {
          position: absolute;
          top: -20%;
          left: -30%;
          width: 80%;
          height: 140%;
          pointer-events: none;
          z-index: 3;
          background: linear-gradient(
            125deg,
            transparent 30%,
            rgba(255,255,255,0.05) 48%,
            rgba(255,255,255,0.08) 50%,
            rgba(255,255,255,0.05) 52%,
            transparent 70%
          );
          transform: rotate(-15deg);
          opacity: 0;
        }
        .suggested-card-body {
          position: relative;
          z-index: 4;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1rem 0.875rem calc(15% + 0.875rem);
          width: 100%;
        }
        /* Full-height left-edge image strip (~15% width) */
        .suggested-card-strip {
          position: absolute;
          top: 0;
          left: 0;
          width: 15%;
          height: 100%;
          overflow: hidden;
          z-index: 1;
          border-radius: 1.25rem 0 0 1.25rem;
        }
        .suggested-card-strip img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        /* Soft right-edge fade so strip dissolves into card gradient */
        .suggested-card-strip::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(to right, transparent 40%, rgba(15,118,110,0.72) 100%);
        }
        /* Placeholder strip (no image) */
        .suggested-card-strip-placeholder {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.05);
          border-right: 1px solid rgba(255,255,255,0.06);
        }
        .suggested-card-info {
          flex: 1;
          min-width: 0;
        }
        .suggested-card-name {
          color: #fff;
          font-weight: 600;
          font-size: 0.875rem;
          letter-spacing: -0.01em;
          line-height: 1.3;
          text-shadow: 0 1px 4px rgba(0,0,0,0.22);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .suggested-card-address {
          color: rgba(204,251,241,0.72);
          font-size: 0.75rem;
          line-height: 1.4;
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .suggested-card-price {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 6px;
          padding: 3px 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.10);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.12);
          color: #ccfbf1;
          font-size: 0.75rem;
          font-weight: 600;
          letter-spacing: 0.01em;
        }
        .suggested-card-arrow {
          flex-shrink: 0;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.12);
          transition: background 0.28s ease, transform 0.28s cubic-bezier(0.34,1.56,0.64,1);
        }
        .suggested-card:hover .suggested-card-arrow {
          background: rgba(255,255,255,0.16);
          transform: translateX(2px);
        }
        /* Empty state */
        .suggested-empty {
          position: relative;
          overflow: hidden;
          border-radius: 1.25rem;
          padding: 2rem;
          text-align: center;
          background:
            radial-gradient(ellipse 100% 80% at 15% 20%, rgba(153,246,228,0.22) 0%, transparent 55%),
            linear-gradient(135deg, #0f766e 0%, #084640 100%);
          border: 1px solid rgba(153,246,228,0.14);
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">

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

        </div>

        {/* Suggested Courts */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Suggested Courts for you</h2>
            <Link href="/courts" className="text-sm font-medium text-primary hover:text-primary/80">
              See all
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {suggestedVenues && suggestedVenues.length > 0 ? (
              suggestedVenues.slice(0, 2).map((venue: any, idx: number) => {
                // ── Per-card radial gradient presets ──────────────────────────
                // Each preset has a different light-source origin, ellipse sizes,
                // stop positions, and base diagonal — creating naturally varied surfaces.
                const CARD_GRADIENTS: string[][] = [
                  // 0 · Spotlight: top-left → shadow: bottom-right
                  [
                    'radial-gradient(ellipse 115% 95% at 5% 8%,   rgba(153,246,228,0.44) 0%, transparent 50%)',
                    'radial-gradient(ellipse 80%  70% at 88% 92%, rgba(5,80,60,0.58)     0%, transparent 52%)',
                    'radial-gradient(ellipse 55%  50% at 48% 52%, rgba(20,184,166,0.10)  0%, transparent 62%)',
                    'linear-gradient(135deg, #0f766e 0%, #09564e 42%, #073d37 100%)',
                  ],
                  // 1 · Spotlight: top-right → shadow: bottom-left
                  [
                    'radial-gradient(ellipse 110% 90% at 95% 6%,  rgba(153,246,228,0.40) 0%, transparent 50%)',
                    'radial-gradient(ellipse 85%  72% at 6%  90%, rgba(5,80,60,0.52)     0%, transparent 54%)',
                    'radial-gradient(ellipse 50%  55% at 52% 50%, rgba(20,184,166,0.09)  0%, transparent 65%)',
                    'linear-gradient(225deg, #0f766e 0%, #0a5a52 40%, #073d37 100%)',
                  ],
                  // 2 · Spotlight: bottom-left → shadow: top-right
                  [
                    'radial-gradient(ellipse 100% 105% at 4% 94%, rgba(153,246,228,0.38) 0%, transparent 52%)',
                    'radial-gradient(ellipse 78%  65%  at 92% 8%, rgba(4,70,52,0.60)     0%, transparent 50%)',
                    'radial-gradient(ellipse 60%  50%  at 50% 55%,rgba(20,184,166,0.11)  0%, transparent 60%)',
                    'linear-gradient(315deg, #0d9488 0%, #0a5c55 45%, #052e29 100%)',
                  ],
                  // 3 · Spotlight: bottom-right → shadow: top-left
                  [
                    'radial-gradient(ellipse 105% 95% at 96% 95%, rgba(153,246,228,0.40) 0%, transparent 50%)',
                    'radial-gradient(ellipse 80%  68% at 8%  5%,  rgba(4,70,52,0.58)     0%, transparent 52%)',
                    'radial-gradient(ellipse 52%  52% at 50% 48%, rgba(20,184,166,0.10)  0%, transparent 64%)',
                    'linear-gradient(315deg, #0f766e 0%, #084640 50%, #052e29 100%)',
                  ],
                  // 4 · Spotlight: top-center crown → dark sides
                  [
                    'radial-gradient(ellipse 90%  80% at 50% 4%,  rgba(153,246,228,0.42) 0%, transparent 50%)',
                    'radial-gradient(ellipse 68%  80% at 5%  80%, rgba(5,80,60,0.40)     0%, transparent 54%)',
                    'radial-gradient(ellipse 68%  80% at 95% 78%, rgba(4,70,52,0.36)     0%, transparent 54%)',
                    'linear-gradient(180deg, #0d9488 0%, #085e55 40%, #052e29 100%)',
                  ],
                  // 5 · Spotlight: left-edge glancing → right shadow
                  [
                    'radial-gradient(ellipse 72%  125% at 2% 50%,  rgba(153,246,228,0.40) 0%, transparent 52%)',
                    'radial-gradient(ellipse 62%  90%  at 98% 48%, rgba(4,70,52,0.58)     0%, transparent 50%)',
                    'radial-gradient(ellipse 50%  55%  at 50% 50%, rgba(20,184,166,0.10)  0%, transparent 65%)',
                    'linear-gradient(90deg, #0f766e 0%, #0a5a52 42%, #073d37 100%)',
                  ],
                ]
                const cardBg = CARD_GRADIENTS[idx % CARD_GRADIENTS.length].join(', ')

                // Prefer venue-level cover image, fall back to court image
                const courtPrimaryImg = venue.courts
                  ?.flatMap((c: any) => c.court_images || [])
                  .find((img: any) => img.is_primary)
                const courtFallbackImg = venue.courts?.[0]?.court_images?.[0]?.url
                const imageUrl = (venue as any).image_url || courtPrimaryImg?.url || courtFallbackImg

                // Calculate price range
                const rawPrices = venue.courts?.map((c: any) => c.hourly_rate) || []
                const prices = rawPrices.filter((rate: any) => typeof rate === 'number' && !isNaN(rate) && rate > 0)
                const minPrice = prices.length > 0 ? Math.min(...prices) : null
                const maxPrice = prices.length > 0 ? Math.max(...prices) : null

                return (
                  <Link
                    key={venue.id}
                    href={`/courts/${venue.id}`}
                    className="suggested-card"
                    style={{ background: cardBg }}
                  >

                    {/* Noise texture layer */}
                    <div className="suggested-card-noise" />
                    {/* Diagonal studio highlight */}
                    <div className="suggested-card-highlight" />
                    {/* Shimmer sweep on hover */}
                    <div className="suggested-card-shimmer" />

                    <div className="suggested-card-body">
                      {/* Left-edge image strip */}
                      <div className="suggested-card-strip">
                        {imageUrl ? (
                          <img src={imageUrl} alt={venue.name} />
                        ) : (
                          <div className="suggested-card-strip-placeholder">
                            <svg style={{ width: 14, height: 14, color: 'rgba(153,246,228,0.4)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>

                      {/* Venue info */}
                      <div className="suggested-card-info">
                        <div className="suggested-card-name">{venue.name}</div>
                        <div className="suggested-card-address">{venue.address}</div>
                        {minPrice !== null && maxPrice !== null && (
                          <span className="suggested-card-price">
                            <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                            </svg>
                            {minPrice === maxPrice
                              ? formatCurrency(minPrice)
                              : `${formatCurrency(minPrice)} – ${formatCurrency(maxPrice)}`}
                            /hr
                          </span>
                        )}
                      </div>

                      {/* Arrow button */}
                      <div className="suggested-card-arrow">
                        <svg style={{ width: 16, height: 16, color: 'rgba(204,251,241,0.8)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </Link>
                )
              })
            ) : (
              <div className="suggested-empty">
                <div className="suggested-card-noise" />
                <div className="suggested-card-highlight" />
                <div style={{ position: 'relative', zIndex: 4 }}>
                  <p style={{ color: 'rgba(204,251,241,0.7)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>No courts available at the moment</p>
                  <Link
                    href="/courts"
                    style={{ color: '#99f6e4', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: '3px' }}
                  >
                    Browse all courts
                  </Link>
                </div>
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
