'use client'

import { useState, useEffect } from 'react'
import { VenueManagementGlobal } from '@/components/global-admin/venue-management-global'
import { AmenityManagement } from '@/components/global-admin/amenity-management'
import { PendingVenueApprovals } from '@/components/global-admin/pending-venue-approvals'
import { PendingCourtApprovals } from '@/components/global-admin/pending-court-approvals'
import { Building2, Package, Clock } from 'lucide-react'
import { getAllVenues, getPendingCourts } from '@/app/actions/global-admin-venue-actions'

export default function VenuesPage() {
  const [activeTab, setActiveTab] = useState<'venues' | 'pending' | 'amenities'>('venues')
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    loadPendingCount()
  }, [])

  const loadPendingCount = async () => {
    const [venuesRes, courtsRes] = await Promise.all([
      getAllVenues({ statusFilter: 'unverified', pageSize: 1 }),
      getPendingCourts({ pageSize: 1 })
    ])

    let total = 0
    if (venuesRes.success && 'total' in venuesRes) {
      total += (venuesRes.total || 0)
    }
    if (courtsRes.success && 'total' in courtsRes) {
      total += (courtsRes.total || 0)
    }
    setPendingCount(total)
  }

  const handleApprovalComplete = () => {
    loadPendingCount()
  }

  return (
    <div className="p-8">
      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="flex gap-8">
          <button
            onClick={() => setActiveTab('venues')}
            className={`inline-flex items-center gap-2 px-1 pb-4 border-b-2 font-medium text-sm transition-colors ${activeTab === 'venues'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <Building2 className="w-5 h-5" />
            Venues & Courts
          </button>
          <button
            onClick={() => setActiveTab('pending')}
            className={`inline-flex items-center gap-2 px-1 pb-4 border-b-2 font-medium text-sm transition-colors ${activeTab === 'pending'
              ? 'border-yellow-600 text-yellow-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <Clock className="w-5 h-5" />
            Pending Approvals
            {pendingCount > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-bold">
                {pendingCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('amenities')}
            className={`inline-flex items-center gap-2 px-1 pb-4 border-b-2 font-medium text-sm transition-colors ${activeTab === 'amenities'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <Package className="w-5 h-5" />
            Amenities
          </button>
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'venues' && <VenueManagementGlobal />}
      {activeTab === 'pending' && (
        <div className="space-y-8">
          <PendingVenueApprovals onApprovalComplete={handleApprovalComplete} />
          <PendingCourtApprovals onApprovalComplete={handleApprovalComplete} />
        </div>
      )}
      {activeTab === 'amenities' && <AmenityManagement />}
    </div>
  )
}
