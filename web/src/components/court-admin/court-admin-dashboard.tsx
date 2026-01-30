'use client'

import { useState, useEffect } from 'react'
import { getDashboardStats, getRecentReservations } from '@/app/actions/court-admin-actions'
import {
  Calendar,
  DollarSign,
  Clock,
  TrendingUp,
  Star,
  Loader2,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowRight,
  Plus
} from 'lucide-react'
import Link from 'next/link'

interface Stats {
  todayReservations: number
  todayRevenue: number
  pendingReservations: number
  upcomingReservations: number
  totalRevenue: number
  averageRating: number
}

interface Reservation {
  id: string
  courtName: string
  venueName: string
  customerName: string
  customerAvatar?: string
  startTime: Date
  endTime: Date
  status: string
  totalAmount: number
  amountPaid: number
  createdAt: Date
}

export function CourtAdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [statsResult, reservationsResult] = await Promise.all([
        getDashboardStats(),
        getRecentReservations(5)
      ])

      if (!statsResult.success) {
        throw new Error(statsResult.error)
      }
      if (!reservationsResult.success) {
        throw new Error(reservationsResult.error)
      }

      setStats((statsResult as any).stats!)
      setReservations((reservationsResult as any).reservations!)
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-700 border-green-200'
      case 'pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200'
      case 'completed': return 'bg-blue-100 text-blue-700 border-blue-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed': return <CheckCircle className="w-3 h-3" />
      case 'pending': return <Clock className="w-3 h-3" />
      case 'cancelled': return <XCircle className="w-3 h-3" />
      case 'completed': return <CheckCircle className="w-3 h-3" />
      default: return <Clock className="w-3 h-3" />
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white border border-red-200 rounded-xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="font-semibold text-gray-900 mb-2">Failed to Load Dashboard</h3>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={loadDashboard}
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
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Court Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage your venues, courts, and reservations</p>
          </div>
          <Link
            href="/court-admin/venues"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-sm hover:shadow-md"
          >
            <Plus className="w-5 h-5" />
            <span className="font-semibold">Manage Venues</span>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-3xl font-bold text-gray-900">{stats.todayReservations}</span>
          </div>
          <p className="text-gray-700 text-sm font-medium">Today's Reservations</p>
          <p className="text-gray-500 text-xs mt-1">₱{stats.todayRevenue.toFixed(2)} revenue</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-3xl font-bold text-gray-900">{stats.pendingReservations}</span>
          </div>
          <p className="text-gray-700 text-sm font-medium">Pending Approval</p>
          <p className="text-gray-500 text-xs mt-1">Requires your action</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-indigo-600" />
            </div>
            <span className="text-3xl font-bold text-gray-900">{stats.upcomingReservations}</span>
          </div>
          <p className="text-gray-700 text-sm font-medium">Upcoming (7 days)</p>
          <p className="text-gray-500 text-xs mt-1">Confirmed bookings</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-emerald-600" />
            </div>
            <span className="text-3xl font-bold text-gray-900">₱{stats.totalRevenue.toFixed(0)}</span>
          </div>
          <p className="text-gray-700 text-sm font-medium">This Month's Revenue</p>
          <p className="text-gray-500 text-xs mt-1">Confirmed & completed</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center">
              <Star className="w-6 h-6 text-orange-500" />
            </div>
            <span className="text-3xl font-bold text-gray-900">{stats.averageRating.toFixed(1)}</span>
          </div>
          <p className="text-gray-700 text-sm font-medium">Average Rating</p>
          <p className="text-gray-500 text-xs mt-1">From customer reviews</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link
          href="/court-admin/reservations?status=pending"
          className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200 hover:border-amber-200 group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Review Pending</h3>
              <p className="text-sm text-gray-600">Approve or reject reservations</p>
            </div>
            <ArrowRight className="w-5 h-5 text-amber-600 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          href="/court-admin/reservations"
          className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200 hover:border-blue-200 group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">Today's Schedule</h3>
              <p className="text-sm text-gray-600">View all bookings for today</p>
            </div>
            <ArrowRight className="w-5 h-5 text-blue-600 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        <Link
          href="/court-admin/analytics"
          className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-all duration-200 hover:border-emerald-200 group"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 mb-1">View Analytics</h3>
              <p className="text-sm text-gray-600">Revenue trends and insights</p>
            </div>
            <ArrowRight className="w-5 h-5 text-emerald-600 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Recent Reservations */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Recent Reservations</h2>
          <Link
            href="/court-admin/reservations"
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            View All
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {reservations.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">No Reservations Yet</h3>
            <p className="text-sm text-gray-500">
              Reservations will appear here once customers start booking
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reservations.map((reservation) => (
              <Link
                key={reservation.id}
                href={`/court-admin/reservations/${reservation.id}`}
                className="block border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                      {reservation.customerName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-gray-900">{reservation.customerName}</span>
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${getStatusColor(reservation.status)}`}>
                          {getStatusIcon(reservation.status)}
                          <span className="capitalize">{reservation.status}</span>
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        {reservation.venueName} - {reservation.courtName}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(reservation.startTime).toLocaleString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-gray-900">₱{reservation.totalAmount.toFixed(2)}</div>
                    {reservation.amountPaid > 0 && (
                      <div className="text-xs text-green-600">Paid: ₱{reservation.amountPaid.toFixed(2)}</div>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
