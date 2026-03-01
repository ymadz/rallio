'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Building2,
  PhilippinePeso,
  Clock,
  BarChart3,
  Star,
  ArrowLeft,
  MapPin,
  Phone,
  Mail,
  CheckCircle,
  Edit,
  Loader2,
  AlertCircle,
  Settings,
  ClipboardCheck
} from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getVenueById } from '@/app/actions/court-admin-actions'
import { VenueCourts } from './venue-courts'
import { PricingManagement } from './pricing-management'
import { AvailabilityManagement } from './availability-management'
import { AnalyticsDashboard } from './analytics-dashboard'
import { ReviewsManagement } from './reviews-management'
import DiscountManagement from './discount-management'
import { QueueApprovalsManagement } from './queue-approvals-management'
import { VenueEditModal } from './venue-edit-modal'

interface VenueDetailProps {
  venueId: string
}

export function VenueDetail({ venueId }: VenueDetailProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'courts'
  const supabase = createClient()

  const [venue, setVenue] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  useEffect(() => {
    loadVenue()
  }, [venueId])

  const loadVenue = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getVenueById(venueId)
      if (!result.success) {
        throw new Error(result.error)
      }
      setVenue(result.venue)
    } catch (err: any) {
      setError(err.message || 'Failed to load venue')
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  if (error || !venue) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900 mb-1">Error Loading Venue</h3>
            <p className="text-sm text-red-700">{error || 'Venue not found'}</p>
            <Link
              href="/court-admin/venues"
              className="inline-flex items-center gap-2 mt-4 text-sm text-red-700 hover:text-red-900 font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to My Venues
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'courts', label: 'Courts', icon: Building2 },
    { id: 'pricing', label: 'Pricing', icon: PhilippinePeso },
    { id: 'discounts', label: 'Discounts', icon: PhilippinePeso },
    { id: 'availability', label: 'Availability', icon: Clock },
    { id: 'approvals', label: 'Queue Approvals', icon: ClipboardCheck },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'reviews', label: 'Reviews', icon: Star },
  ]

  const handleTabChange = (tabId: string) => {
    router.push(`/court-admin/venues/${venueId}?tab=${tabId}`)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <Link
        href="/court-admin/venues"
        className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to My Venues</span>
      </Link>

      {/* Venue Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <h1 className="text-3xl font-bold text-gray-900">{venue.name}</h1>
              {venue.is_verified && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                  <CheckCircle className="w-4 h-4" />
                  Verified
                </span>
              )}
            </div>
            {venue.description && (
              <p className="text-gray-600 mb-4">{venue.description}</p>
            )}

            {/* Venue Info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {venue.address && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  <span>{venue.address}</span>
                </div>
              )}
              {venue.phone && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <span>{venue.phone}</span>
                </div>
              )}
              {venue.email && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <span>{venue.email}</span>
                </div>
              )}
            </div>
          </div>

          <button 
            onClick={() => setShowEditModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Edit className="w-4 h-4" />
            <span>Edit Venue</span>
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-gray-200">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{venue.courtsCount ?? 0}</p>
            <p className="text-sm text-gray-500 mt-1">Courts</p>
          </div>
          <div className="text-center">
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2">
                {venue.is_active ? (
                  <>
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="text-lg font-semibold text-green-600">Active</p>
                  </>
                ) : (
                  <p className="text-lg font-semibold text-gray-400">Inactive</p>
                )}
              </div>
              <div className="flex items-center justify-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  venue.is_verified
                    ? 'bg-blue-100 text-blue-700 border border-blue-200'
                    : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                }`}>
                  {venue.is_verified ? 'Verified' : 'Pending Verification'}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-1">Status</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border border-gray-200 rounded-xl p-2 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id

            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Queue Settings Section */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Queue Session Settings
        </h3>
        
        <div className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
          <div className="flex-1">
            <label htmlFor="requires-approval" className="block text-sm font-medium text-gray-900 mb-1">
              Require Approval for Queue Sessions
            </label>
            <p className="text-sm text-gray-600">
              When enabled, Queue Masters must wait for your approval before their sessions go live.
              This gives you control over who uses your courts and when.
            </p>
          </div>
          <div className="ml-4 flex-shrink-0">
            <input
              type="checkbox"
              id="requires-approval"
              checked={venue?.requires_queue_approval ?? true}
              onChange={async (e) => {
                try {
                  const { error } = await supabase
                    .from('venues')
                    .update({ requires_queue_approval: e.target.checked })
                    .eq('id', venueId)
                  
                  if (error) throw error
                  
                  await loadVenue()
                  
                  alert(e.target.checked 
                    ? '✅ Queue sessions now require your approval' 
                    : '✅ Queue sessions no longer require approval - they will go live immediately')
                } catch (error) {
                  console.error('Failed to update setting:', error)
                  alert('❌ Failed to update setting. Please try again.')
                }
              }}
              className="h-5 w-5 text-primary border-gray-300 rounded focus:ring-2 focus:ring-primary cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'courts' && <VenueCourts venueId={venueId} onCourtChange={loadVenue} />}
        {activeTab === 'pricing' && <PricingManagement venueId={venueId} />}
        {activeTab === 'discounts' && <DiscountManagement venueId={venueId} />}
        {activeTab === 'availability' && <AvailabilityManagement venueId={venueId} />}
        {activeTab === 'approvals' && <QueueApprovalsManagement />}
        {activeTab === 'analytics' && <AnalyticsDashboard venueId={venueId} />}
        {activeTab === 'reviews' && <ReviewsManagement venueId={venueId} />}
      </div>

      {/* Edit Venue Modal */}
      {venue && (
        <VenueEditModal
          venue={venue}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSuccess={loadVenue}
        />
      )}
    </div>
  )
}
