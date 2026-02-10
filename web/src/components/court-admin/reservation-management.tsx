'use client'

import { useState, useEffect } from 'react'
import { getMyVenueReservations, getVenueCourts } from '@/app/actions/court-admin-actions'
import { createClient } from '@/lib/supabase/client'
import {
  Calendar,
  Filter,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Download
} from 'lucide-react'
import { ReservationDetailModal } from './reservation-detail-modal'

interface Reservation {
  id: string
  court: {
    id: string
    name: string
    venue: {
      id: string
      name: string
    }
  }
  user: {
    id: string
    display_name?: string
    first_name?: string
    last_name?: string
    avatar_url?: string
    phone?: string
  }
  start_time: string
  end_time: string
  status: string
  total_amount: string
  amount_paid: string
  num_players: number
  notes?: string
  created_at: string
  metadata?: any
  queue_session?: Array<{
    id: string
    approval_status: 'pending' | 'approved' | 'rejected'
    status: string
    organizer_id: string
  }>
}

export function ReservationManagement() {
  const supabase = createClient()
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('all')

  // Modal
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)

  useEffect(() => {
    loadReservations()
    setupRealtimeSubscription()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [reservations, statusFilter, searchQuery, dateFilter])

  const loadReservations = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getMyVenueReservations()
      if (!result.success) {
        throw new Error(result.error)
      }
      setReservations(result.reservations || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load reservations')
    } finally {
      setIsLoading(false)
    }
  }

  // Helper to get effective status for queue session reservations
  const getEffectiveStatus = (reservation: Reservation): string => {
    // Check if this is a queue session reservation
    const isQueueSession = reservation.metadata?.is_queue_session_reservation === true
    if (isQueueSession && reservation.queue_session && reservation.queue_session.length > 0) {
      const queueSession = reservation.queue_session[0]
      // Map queue session approval status to reservation status
      if (queueSession.approval_status === 'pending') {
        return 'pending'
      }
      if (queueSession.approval_status === 'rejected') {
        return 'cancelled'
      }
      // If approved, keep the reservation status (should be 'confirmed')
    }
    return reservation.status
  }

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel('court-admin-reservations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reservations',
        },
        () => {
          loadReservations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  const applyFilters = () => {
    let filtered = [...reservations]

    // Status filter (using effective status for queue sessions)
    if (statusFilter !== 'all') {
      filtered = filtered.filter(r => getEffectiveStatus(r) === statusFilter)
    }

    // Date filter
    const now = new Date()
    if (dateFilter === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      filtered = filtered.filter(r => {
        const startTime = new Date(r.start_time)
        return startTime >= today && startTime < tomorrow
      })
    } else if (dateFilter === 'week') {
      const weekAhead = new Date(now)
      weekAhead.setDate(weekAhead.getDate() + 7)
      filtered = filtered.filter(r => {
        const startTime = new Date(r.start_time)
        return startTime >= now && startTime <= weekAhead
      })
    } else if (dateFilter === 'month') {
      const monthAhead = new Date(now)
      monthAhead.setMonth(monthAhead.getMonth() + 1)
      filtered = filtered.filter(r => {
        const startTime = new Date(r.start_time)
        return startTime >= now && startTime <= monthAhead
      })
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(r => {
        const customerName = r.user?.display_name ||
          `${r.user?.first_name || ''} ${r.user?.last_name || ''}`.trim()
        const courtName = r.court?.name || ''
        const venueName = r.court?.venue?.name || ''

        return (
          customerName.toLowerCase().includes(query) ||
          courtName.toLowerCase().includes(query) ||
          venueName.toLowerCase().includes(query)
        )
      })
    }

    setFilteredReservations(filtered)
  }

  const handleViewDetails = (reservation: Reservation) => {
    setSelectedReservation(reservation)
    setShowDetailModal(true)
  }

  const handleModalClose = () => {
    setShowDetailModal(false)
    setSelectedReservation(null)
    loadReservations()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-700 border-green-200'
      case 'ongoing': return 'bg-purple-100 text-purple-700 border-purple-200 animate-pulse'
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200'
      case 'completed': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'no_show': return 'bg-gray-100 text-gray-700 border-gray-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <CheckCircle className="w-4 h-4" />
      case 'ongoing': return <Clock className="w-4 h-4 animate-spin-slow" />
      case 'pending': return <Clock className="w-4 h-4" />
      case 'cancelled': return <XCircle className="w-4 h-4" />
      case 'completed': return <CheckCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  const statusCounts = {
    all: reservations.length,
    pending: reservations.filter(r => getEffectiveStatus(r) === 'pending').length,
    confirmed: reservations.filter(r => getEffectiveStatus(r) === 'confirmed').length,
    ongoing: reservations.filter(r => getEffectiveStatus(r) === 'ongoing').length,
    completed: reservations.filter(r => getEffectiveStatus(r) === 'completed').length,
    cancelled: reservations.filter(r => getEffectiveStatus(r) === 'cancelled').length,
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white border border-red-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">Failed to Load Reservations</h3>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadReservations}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Reservations</h1>
        <p className="text-gray-600">Manage and track all court bookings</p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by customer, court, or venue..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Date Filter */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="week">Next 7 Days</option>
            <option value="month">Next 30 Days</option>
          </select>

          {/* Export Button */}
          <button className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="bg-white border border-gray-200 rounded-xl p-2 mb-6 inline-flex gap-2 overflow-x-auto">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${statusFilter === 'all'
            ? 'bg-primary text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-100'
            }`}
        >
          All ({statusCounts.all})
        </button>
        <button
          onClick={() => setStatusFilter('pending')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${statusFilter === 'pending'
            ? 'bg-amber-500 text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-100'
            }`}
        >
          Pending ({statusCounts.pending})
        </button>
        <button
          onClick={() => setStatusFilter('confirmed')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${statusFilter === 'confirmed'
            ? 'bg-emerald-500 text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-100'
            }`}
        >
          Confirmed ({statusCounts.confirmed})
        </button>
        <button
          onClick={() => setStatusFilter('ongoing')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${statusFilter === 'ongoing'
            ? 'bg-purple-500 text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-100'
            }`}
        >
          Ongoing ({statusCounts.ongoing})
        </button>
        <button
          onClick={() => setStatusFilter('completed')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${statusFilter === 'completed'
            ? 'bg-blue-500 text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-100'
            }`}
        >
          Completed ({statusCounts.completed})
        </button>
        <button
          onClick={() => setStatusFilter('cancelled')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors whitespace-nowrap ${statusFilter === 'cancelled'
            ? 'bg-rose-500 text-white shadow-sm'
            : 'text-gray-600 hover:bg-gray-100'
            }`}
        >
          Cancelled ({statusCounts.cancelled})
        </button>
      </div>

      {/* Reservations List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {filteredReservations.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">No Reservations Found</h3>
            <p className="text-sm text-gray-500">
              {searchQuery || statusFilter !== 'all' || dateFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'Reservations will appear here once customers start booking'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Court
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReservations.map((reservation) => {
                  const customerName = reservation.user?.display_name ||
                    `${reservation.user?.first_name || ''} ${reservation.user?.last_name || ''}`.trim() ||
                    'Unknown'

                  return (
                    <tr key={reservation.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                            {customerName.charAt(0).toUpperCase()}
                          </div>
                          <div className="ml-3">
                            <div className="font-medium text-gray-900">{customerName}</div>
                            {reservation.user?.phone && (
                              <div className="text-sm text-gray-500">{reservation.user.phone}</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{reservation.court?.name}</div>
                        <div className="text-sm text-gray-500">{reservation.court?.venue?.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(reservation.start_time).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(reservation.start_time).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                          {' - '}
                          {new Date(reservation.end_time).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${getStatusColor(getEffectiveStatus(reservation))}`}>
                            {getStatusIcon(getEffectiveStatus(reservation))}
                            <span className="capitalize">{getEffectiveStatus(reservation).replace('_', ' ')}</span>
                          </span>
                          {reservation.metadata?.is_queue_session_reservation && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-50 text-purple-700">
                              Queue
                            </span>
                          )}
                          {reservation.metadata?.recurrence_total > 1 && (
                            <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700 flex items-center gap-1">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                              Recurring
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ₱{parseFloat(reservation.total_amount).toFixed(2)}
                        </div>
                        {parseFloat(reservation.amount_paid) > 0 && (
                          <div className="text-xs text-green-600">
                            Paid: ₱{parseFloat(reservation.amount_paid).toFixed(2)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => handleViewDetails(reservation)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedReservation && (
        <ReservationDetailModal
          isOpen={showDetailModal}
          onClose={handleModalClose}
          reservation={selectedReservation}
        />
      )}
    </div>
  )
}
