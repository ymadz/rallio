'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { searchNearby, formatDistance, isVenueOpen } from '@/lib/api/venues';
import type { VenueWithDetails } from '@/lib/api/venues';
import { Spinner } from '@/components/ui/spinner';

export function NearbyVenues() {
  const [venues, setVenues] = useState<VenueWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locationDenied, setLocationDenied] = useState(false);

  useEffect(() => {
    const fetchNearbyVenues = async () => {
      try {
        if (!navigator.geolocation) {
          setError('Geolocation is not supported by your browser');
          setIsLoading(false);
          return;
        }

        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            try {
              const nearbyVenues = await searchNearby(latitude, longitude, 10, 4);
              setVenues(nearbyVenues);
            } catch (err) {
              console.error('Error fetching nearby venues:', err);
              setError('Failed to load nearby venues');
            } finally {
              setIsLoading(false);
            }
          },
          (error) => {
            setLocationDenied(true);
            setIsLoading(false);
            if (process.env.NODE_ENV !== 'production') {
              console.error('Geolocation error:', error);
            }
          },
          {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 300000,
          }
        );
      } catch (err) {
        console.error('Error in fetchNearbyVenues:', err);
        setError('Failed to load nearby venues');
        setIsLoading(false);
      }
    };

    fetchNearbyVenues();
  }, []);

  if (isLoading) {
    return (
      <>
        <style>{`
          @keyframes nv-pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.45; }
          }
          .nv-skeleton { animation: nv-pulse 1.6s ease-in-out infinite; }
        `}</style>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="nv-skeleton rounded-2xl overflow-hidden" style={{ background: '#f1f5f4', height: 230 }}>
              <div style={{ height: '100%', background: 'linear-gradient(135deg, #dde4e2, #ccfbf1)' }} />
            </div>
          ))}
        </div>
      </>
    );
  }

  if (locationDenied) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <svg className="w-12 h-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <h3 className="font-medium text-gray-900 mb-1">Make sure your location is enabled</h3>
        <p className="text-sm text-gray-500 mb-3">Enable location permission in your browser or device settings to see courts near you.</p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => { setLocationDenied(false); window.location.reload(); }}
            className="inline-block px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
          >
            Allow Location
          </button>
          <Link href="/courts" className="inline-block px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
            Browse All Courts
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (venues.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-sm text-gray-500">No courts found near you</p>
        <Link href="/courts" className="inline-block mt-2 text-sm font-medium text-primary hover:text-primary/80">
          Browse All Courts
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* ── Nearby Venue Card Styles ── */}
      <style>{`
        .nv-card {
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
        .nv-card:hover {
          transform: translateY(-4px) scale(1.015);
          box-shadow:
            0 2px 6px rgba(0,0,0,0.08),
            0 8px 28px rgba(13,148,136,0.16),
            0 16px 48px rgba(0,0,0,0.10);
        }

        /* Full-bleed image */
        .nv-card-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transition: transform 0.40s cubic-bezier(0.34,1.56,0.64,1);
        }
        .nv-card:hover .nv-card-img {
          transform: scale(1.06);
        }

        /* Placeholder (no image) */
        .nv-card-placeholder {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #ccfbf1 0%, #a7f3d0 100%);
        }

        /* Fog layer 1: dark colour gradient for text legibility */
        .nv-fog-gradient {
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
        /* Fog layer 2: backdrop blur, masked so it fades in smoothly from top */
        .nv-fog-blur {
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

        /* Pill badges */
        .nv-badge {
          position: absolute;
          z-index: 6;
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 4px 9px;
          border-radius: 999px;
          font-size: 0.66rem;
          font-weight: 700;
          letter-spacing: 0.04em;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          border: 1px solid rgba(255,255,255,0.25);
          text-transform: uppercase;
          line-height: 1;
        }
        .nv-badge-open   { top: 10px; right: 10px; background: rgba(13,148,136,0.82); color: #fff; }
        .nv-badge-closed { top: 10px; right: 10px; background: rgba(55,65,81,0.75);   color: rgba(255,255,255,0.90); }
        .nv-badge-promo  { background: rgba(22,163,74,0.80);   color: #fff; }
        .nv-badge-surcharge { background: rgba(234,88,12,0.80); color: #fff; }

        /* Content floating above the fog */
        .nv-content {
          position: absolute;
          left: 0; right: 0;
          bottom: 0;
          z-index: 5;
          padding: 0.875rem 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }
        .nv-name {
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
        .nv-addr {
          font-size: 0.6875rem;
          color: rgba(204,251,241,0.85);
          line-height: 1.35;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .nv-dist {
          font-size: 0.6875rem;
          font-weight: 600;
          color: #99f6e4;
          line-height: 1.3;
        }
        .nv-cta {
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
        .nv-card:hover .nv-cta {
          background: rgba(13,148,136,0.72);
          transform: scale(1.02);
        }
      `}</style>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {venues.slice(0, 4).map((venue) => {
          const isOpen = isVenueOpen(venue.opening_hours);
          const primaryImage = venue.courts?.[0]?.images?.find((img) => img.is_primary);
          const courtImageUrl = primaryImage?.url || venue.courts?.[0]?.images?.[0]?.url;
          const imageUrl = (venue as any).image_url || courtImageUrl;

          return (
            <Link key={venue.id} href={`/courts/${venue.id}`} className="nv-card">
              {/* Full-bleed image */}
              {imageUrl ? (
                <img src={imageUrl} alt={venue.name} className="nv-card-img" />
              ) : (
                <div className="nv-card-placeholder">
                  <svg style={{ width: 36, height: 36, color: '#0d9488', opacity: 0.4 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              )}

              {/* Fog layers */}
              <div className="nv-fog-gradient" />
              <div className="nv-fog-blur" />

              {/* Open/Closed badge */}
              {isOpen !== null && (
                <span className={`nv-badge ${isOpen ? 'nv-badge-open' : 'nv-badge-closed'}`}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: isOpen ? '#86efac' : 'rgba(255,255,255,0.5)', display: 'inline-block', flexShrink: 0 }} />
                  {isOpen ? 'Open' : 'Closed'}
                </span>
              )}

              {/* Promo / surcharge badges */}
              {venue.hasActiveDiscounts && venue.activeDiscountLabels && venue.activeDiscountLabels.map((discount, i) => (
                <span
                  key={i}
                  title={discount.description || discount.name}
                  className={`nv-badge ${discount.isSurcharge ? 'nv-badge-surcharge' : 'nv-badge-promo'}`}
                  style={{ top: isOpen !== null ? 34 : 10, left: 10 }}
                >
                  <svg style={{ width: 9, height: 9 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {discount.isSurcharge
                      ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    }
                  </svg>
                  {discount.label}
                </span>
              ))}

              {/* Content over fog */}
              <div className="nv-content">
                <div className="nv-name">{venue.name}</div>
                <div className="nv-addr">{venue.address}</div>
                {venue.distance !== undefined && (
                  <div className="nv-dist">📍 {formatDistance(venue.distance)} away</div>
                )}
                <span className="nv-cta">See Court →</span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
