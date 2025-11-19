'use client'

import { useEffect, useState } from 'react'
import { getCourtRatings } from '@/lib/api/venues'

interface Review {
  id: string
  overall_rating: number
  quality_rating: number
  cleanliness_rating: number
  facilities_rating: number
  value_rating: number
  review: string | null
  created_at: string
  user: {
    display_name: string
    avatar_url: string | null
  }
}

interface ReviewsSectionProps {
  courtIds: string[]
}

export function ReviewsSection({ courtIds }: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    averageOverall: 0,
    averageQuality: 0,
    averageCleanliness: 0,
    averageFacilities: 0,
    averageValue: 0,
    totalReviews: 0,
  })

  useEffect(() => {
    async function fetchReviews() {
      setLoading(true)
      try {
        const allReviews: Review[] = []
        const ratings = {
          overall: 0,
          quality: 0,
          cleanliness: 0,
          facilities: 0,
          value: 0,
        }

        for (const courtId of courtIds) {
          const courtReviews = await getCourtRatings(courtId)
          allReviews.push(...courtReviews)

          courtReviews.forEach((review) => {
            ratings.overall += review.overall_rating
            ratings.quality += review.quality_rating
            ratings.cleanliness += review.cleanliness_rating
            ratings.facilities += review.facilities_rating
            ratings.value += review.value_rating
          })
        }

        const totalCount = allReviews.length

        setReviews(allReviews.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        ))

        if (totalCount > 0) {
          setStats({
            averageOverall: ratings.overall / totalCount,
            averageQuality: ratings.quality / totalCount,
            averageCleanliness: ratings.cleanliness / totalCount,
            averageFacilities: ratings.facilities / totalCount,
            averageValue: ratings.value / totalCount,
            totalReviews: totalCount,
          })
        }
      } catch (error) {
        console.error('Error fetching reviews:', error)
      } finally {
        setLoading(false)
      }
    }

    if (courtIds.length > 0) {
      fetchReviews()
    }
  }, [courtIds])

  const renderStars = (rating: number, size: 'sm' | 'md' = 'md') => {
    const stars = []
    const fullStars = Math.floor(rating)
    const hasHalfStar = rating % 1 >= 0.5
    const sizeClass = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'

    for (let i = 0; i < fullStars; i++) {
      stars.push(
        <svg key={`full-${i}`} className={`${sizeClass} fill-yellow-400`} viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      )
    }

    if (hasHalfStar) {
      stars.push(
        <svg key="half" className={`${sizeClass} fill-yellow-400`} viewBox="0 0 20 20">
          <defs>
            <linearGradient id={`half-${rating}`}>
              <stop offset="50%" stopColor="rgb(250 204 21)" />
              <stop offset="50%" stopColor="rgb(229 231 235)" />
            </linearGradient>
          </defs>
          <path fill={`url(#half-${rating})`} d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      )
    }

    const emptyStars = 5 - Math.ceil(rating)
    for (let i = 0; i < emptyStars; i++) {
      stars.push(
        <svg key={`empty-${i}`} className={`${sizeClass} fill-gray-200`} viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      )
    }

    return stars
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`
    return date.toLocaleDateString()
  }

  if (loading) {
    return (
      <div className="mb-8">
        <h3 className="font-semibold text-gray-900 mb-4">Reviews & Ratings</h3>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <div className="mb-8">
        <h3 className="font-semibold text-gray-900 mb-4">Reviews & Ratings</h3>
        <div className="text-center py-8 bg-gray-50 rounded-xl">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
          <p className="text-gray-500 text-sm">No reviews yet</p>
          <p className="text-gray-400 text-xs mt-1">Be the first to review this venue</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-8">
      <h3 className="font-semibold text-gray-900 mb-4">Reviews & Ratings</h3>

      {/* Overall Stats */}
      <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-3xl font-bold text-gray-900">{stats.averageOverall.toFixed(1)}</span>
              <div className="flex items-center">
                {renderStars(stats.averageOverall)}
              </div>
            </div>
            <p className="text-sm text-gray-600">
              Based on {stats.totalReviews} {stats.totalReviews === 1 ? 'review' : 'reviews'}
            </p>
          </div>
        </div>

        {/* Rating Breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">Quality</span>
              <span className="text-xs font-semibold text-gray-900">{stats.averageQuality.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1">
              {renderStars(stats.averageQuality, 'sm')}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">Cleanliness</span>
              <span className="text-xs font-semibold text-gray-900">{stats.averageCleanliness.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1">
              {renderStars(stats.averageCleanliness, 'sm')}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">Facilities</span>
              <span className="text-xs font-semibold text-gray-900">{stats.averageFacilities.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1">
              {renderStars(stats.averageFacilities, 'sm')}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-600">Value</span>
              <span className="text-xs font-semibold text-gray-900">{stats.averageValue.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1">
              {renderStars(stats.averageValue, 'sm')}
            </div>
          </div>
        </div>
      </div>

      {/* Individual Reviews */}
      <div className="space-y-4">
        {reviews.map((review) => (
          <div key={review.id} className="border border-gray-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0">
                {review.user.avatar_url ? (
                  <img src={review.user.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h4 className="font-medium text-gray-900 text-sm">{review.user.display_name}</h4>
                  <span className="text-xs text-gray-400">{formatDate(review.created_at)}</span>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center">
                    {renderStars(review.overall_rating, 'sm')}
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{review.overall_rating.toFixed(1)}</span>
                </div>

                {review.review && (
                  <p className="text-sm text-gray-600 leading-relaxed mb-3">{review.review}</p>
                )}

                {/* Detailed Ratings */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 bg-gray-50 text-gray-600 rounded">
                    Quality: {review.quality_rating}/5
                  </span>
                  <span className="px-2 py-1 bg-gray-50 text-gray-600 rounded">
                    Cleanliness: {review.cleanliness_rating}/5
                  </span>
                  <span className="px-2 py-1 bg-gray-50 text-gray-600 rounded">
                    Facilities: {review.facilities_rating}/5
                  </span>
                  <span className="px-2 py-1 bg-gray-50 text-gray-600 rounded">
                    Value: {review.value_rating}/5
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
