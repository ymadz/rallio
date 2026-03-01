'use client'

import { useEffect, useState } from 'react'
import { getCourtRatings } from '@/lib/api/venues'
import { Star, ChevronDown, Edit } from 'lucide-react'
import { ReviewModal } from './review-modal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

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
  venueName: string
  firstCourtName?: string
}

type SortOption = 'newest' | 'highest' | 'lowest'
type FilterOption = 'all' | 5 | 4 | 3 | 2 | 1

export function ReviewsSection({ courtIds, venueName, firstCourtName }: ReviewsSectionProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [filteredReviews, setFilteredReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortOption>('newest')
  const [filterRating, setFilterRating] = useState<FilterOption>('all')
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [displayCount, setDisplayCount] = useState(5)
  const [isExpanded, setIsExpanded] = useState(true)
  const [stats, setStats] = useState({
    averageOverall: 0,
    averageQuality: 0,
    averageCleanliness: 0,
    averageFacilities: 0,
    averageValue: 0,
    totalReviews: 0,
    ratingCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
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

        setReviews(allReviews)

        // Count ratings by star level
        const ratingCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
        allReviews.forEach((review) => {
          const rounded = Math.round(review.overall_rating) as 1 | 2 | 3 | 4 | 5
          ratingCounts[rounded]++
        })

        if (totalCount > 0) {
          setStats({
            averageOverall: ratings.overall / totalCount,
            averageQuality: ratings.quality / totalCount,
            averageCleanliness: ratings.cleanliness / totalCount,
            averageFacilities: ratings.facilities / totalCount,
            averageValue: ratings.value / totalCount,
            totalReviews: totalCount,
            ratingCounts,
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

  // Apply filtering and sorting
  useEffect(() => {
    let filtered = [...reviews]

    // Filter by rating
    if (filterRating !== 'all') {
      filtered = filtered.filter((review) => Math.round(review.overall_rating) === filterRating)
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'highest':
          return b.overall_rating - a.overall_rating
        case 'lowest':
          return a.overall_rating - b.overall_rating
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

    setFilteredReviews(filtered)
    setDisplayCount(5) // Reset display count when filters change
  }, [reviews, filterRating, sortBy])

  const renderStars = (rating: number, size: 'sm' | 'md' = 'md') => {
    const stars: JSX.Element[] = []
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
                  <div className="h-3 bg-gray-200 rounded w-2/3" />
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
        <div 
          className="flex items-center justify-between mb-4 cursor-pointer select-none"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h3 className="font-semibold text-gray-900 text-lg">Reviews and ratings</h3>
          <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
        </div>

        <div className={`transition-all duration-300 origin-top overflow-hidden ${isExpanded ? 'opacity-100 max-h-[500px]' : 'opacity-0 max-h-0'}`}>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
            <div className="text-center py-8">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
              <p className="text-gray-500 text-sm font-medium">No reviews yet</p>
              <p className="text-gray-400 text-xs mt-1 mb-5">Be the first to review this venue</p>
              <button
                onClick={(e) => { e.stopPropagation(); setShowReviewModal(true); }}
                className="px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-sm active:scale-95"
              >
                Write review
              </button>
            </div>
          </div>
        </div>

        {/* Review Modal */}
        <ReviewModal
          courtId={courtIds[0] || ''}
          courtName={firstCourtName || 'Court'}
          venueName={venueName}
          isOpen={showReviewModal}
          onClose={() => setShowReviewModal(false)}
          onSuccess={() => {
            // Refresh reviews after successful submission
            const fetchReviews = async () => {
              const allReviews: Review[] = []
              for (const courtId of courtIds) {
                const courtReviews = await getCourtRatings(courtId)
                allReviews.push(...courtReviews)
              }
              setReviews(allReviews)
            }
            fetchReviews()
          }}
        />
      </div>
    )
  }

  const displayedReviews = filteredReviews.slice(0, displayCount)
  const hasMore = displayCount < filteredReviews.length

  return (
    <div className="mb-8">
      {/* Component Header */}
      <div 
        className="flex items-center justify-between mb-4 cursor-pointer select-none"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="font-semibold text-gray-900 text-lg flex items-center gap-2">
          Reviews and ratings
        </h3>
        <ChevronDown 
          className={`w-5 h-5 text-gray-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
        />
      </div>

      <div className={`transition-all duration-300 origin-top overflow-hidden ${isExpanded ? 'opacity-100 max-h-[3000px]' : 'opacity-0 max-h-0'}`}>
        {/* Main Stats Card */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6">
          {/* Main Rating Distribution Area */}
          <div className="flex flex-col md:flex-row gap-8 mb-6">
            {/* Left Column (Overall Score) */}
            <div className="flex flex-col justify-center items-center md:items-start min-w-[120px]">
              <span className="text-6xl font-bold text-gray-900 tracking-tight leading-none mb-1">
                {stats.averageOverall.toFixed(1)}
              </span>
              <span className="text-sm text-gray-500 font-medium">
                {stats.totalReviews} ratings
              </span>
            </div>

            {/* Right Column (Rating Bars) */}
            <div className="flex-1 flex flex-col justify-center space-y-3">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = stats.ratingCounts[star as keyof typeof stats.ratingCounts]
                const percentage = stats.totalReviews > 0 ? (count / stats.totalReviews) * 100 : 0
                return (
                  <div key={star} className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-600 w-2 leading-none">{star}</span>
                    <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Detailed Ratings Breakdown */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8 pt-4 border-t border-gray-100">
            <div className="flex flex-col items-center p-3 bg-gray-50 rounded-xl">
              <span className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Quality</span>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-lg font-bold text-gray-900">{stats.averageQuality.toFixed(1)}</span>
                <span className="text-xs text-gray-400">/5</span>
              </div>
              <div className="flex items-center">
                {renderStars(stats.averageQuality, 'sm')}
              </div>
            </div>
            
            <div className="flex flex-col items-center p-3 bg-gray-50 rounded-xl">
              <span className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Cleanliness</span>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-lg font-bold text-gray-900">{stats.averageCleanliness.toFixed(1)}</span>
                <span className="text-xs text-gray-400">/5</span>
              </div>
              <div className="flex items-center">
                {renderStars(stats.averageCleanliness, 'sm')}
              </div>
            </div>

            <div className="flex flex-col items-center p-3 bg-gray-50 rounded-xl">
              <span className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Facilities</span>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-lg font-bold text-gray-900">{stats.averageFacilities.toFixed(1)}</span>
                <span className="text-xs text-gray-400">/5</span>
              </div>
              <div className="flex items-center">
                {renderStars(stats.averageFacilities, 'sm')}
              </div>
            </div>

            <div className="flex flex-col items-center p-3 bg-gray-50 rounded-xl">
              <span className="text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Value</span>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-lg font-bold text-gray-900">{stats.averageValue.toFixed(1)}</span>
                <span className="text-xs text-gray-400">/5</span>
              </div>
              <div className="flex items-center">
                {renderStars(stats.averageValue, 'sm')}
              </div>
            </div>
          </div>

          {/* Bottom Action Area */}
          <div className="flex items-center justify-between pt-5 border-t border-gray-100">
            <div className="w-1/3">
              <span className="text-xs font-medium text-gray-400"></span>
            </div>
            
            <div 
              className="w-1/3 flex justify-center items-center cursor-pointer group"
              onClick={() => setShowReviewModal(true)}
              title="Click to write a review"
            >
              <div className="flex items-center gap-0.5 group-hover:scale-105 transition-transform">
                {renderStars(stats.averageOverall, 'md')}
              </div>
            </div>

            <div className="w-1/3 flex justify-end">
              <button
                onClick={() => setShowReviewModal(true)}
                className="px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors shadow-sm active:scale-95"
              >
                Write review
              </button>
            </div>
          </div>
        </div>

      {/* Filters and Sort */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterRating('all')}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
              filterRating === 'all'
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({reviews.length})
          </button>
          {[5, 4, 3, 2, 1].map((rating) => {
            const count = stats.ratingCounts[rating as keyof typeof stats.ratingCounts]
            if (count === 0) return null
            return (
              <button
                key={rating}
                onClick={() => setFilterRating(filterRating === rating ? 'all' : (rating as FilterOption))}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  filterRating === rating
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {rating}★ ({count})
              </button>
            )
          })}
        </div>

        <div className="w-[160px] mr-1">
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
            <SelectTrigger className="bg-gray-100 border-transparent text-gray-700 font-medium hover:bg-gray-200 focus:ring-primary h-9">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="highest">Highest Rated</SelectItem>
              <SelectItem value="lowest">Lowest Rated</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Individual Reviews */}
      <div className="space-y-4">
        {displayedReviews.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-xl">
            <Star className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              No reviews match your filter
            </p>
            <button
              onClick={() => setFilterRating('all')}
              className="mt-3 text-sm text-primary hover:text-primary/80 font-medium"
            >
              Clear filter
            </button>
          </div>
        ) : (
          displayedReviews.map((review) => (
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
          ))
        )}
      </div>

      {/* Load More Button */}
      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={() => setDisplayCount((prev) => prev + 5)}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Load More Reviews ({filteredReviews.length - displayCount} remaining)
          </button>
        </div>
      )}
      </div>

      {/* Review Modal */}
      <ReviewModal
        courtId={courtIds[0] || ''}
        courtName={firstCourtName || 'Court'}
        venueName={venueName}
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        onSuccess={() => {
          // Refresh reviews after successful submission
          const fetchReviews = async () => {
            const allReviews: Review[] = []
            for (const courtId of courtIds) {
              const courtReviews = await getCourtRatings(courtId)
              allReviews.push(...courtReviews)
            }
            setReviews(allReviews)
          }
          fetchReviews()
        }}
      />
    </div>
  )
}
