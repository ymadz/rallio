'use client'

import { Fragment, useState, useEffect } from 'react'
import {
  getAnalyticsSummary,
  getRecentActivity,
  getCourtAdminRevenueBreakdown
} from '@/app/actions/global-admin-analytics-actions'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Users,
  Building2,
  PhilippinePeso,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Activity,
  ChevronDown,
  ChevronRight,
  X
} from 'lucide-react'

interface Stats {
  users: {
    total: number
    active: number
    banned: number
    newThisMonth: number
    roleDistribution: {
      players: number
      court_admins: number
      queue_masters: number
      global_admins: number
    }
  }
  venues: {
    total: number
    active: number
    verified: number
    newThisMonth: number
  }
  courts: {
    total: number
    active: number
    verified: number
    pending: number
    newThisMonth: number
  }
  reservations: {
    total: number
    pending: number
    completed: number
    cancelled: number
    recentBookings: number
    totalRevenue: number
  }
}

interface CourtAdminRevenueItem {
  id: string
  display_name: string | null
  email: string
  avatar_url: string | null
  totalRevenue: number
  completedBookings: number
  venueCount: number
  courtCount: number
  venues: Array<{
    id: string
    name: string
    totalRevenue: number
    completedBookings: number
    courtCount: number
    courts: Array<{
      id: string
      name: string
    }>
  }>
}

interface RevenueBreakdownState {
  admins: CourtAdminRevenueItem[]
  totals: {
    admins: number
    venues: number
    courts: number
    completedBookings: number
    totalRevenue: number
  }
}

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showRevenueBreakdown, setShowRevenueBreakdown] = useState(false)
  const [revenueBreakdown, setRevenueBreakdown] = useState<RevenueBreakdownState | null>(null)
  const [revenueBreakdownLoading, setRevenueBreakdownLoading] = useState(false)
  const [expandedAdmins, setExpandedAdmins] = useState<string[]>([])

  useEffect(() => {
    loadAnalytics()
  }, [])

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      const [summaryResult, activityResult] = await Promise.all([
        getAnalyticsSummary(),
        getRecentActivity()
      ])

      if (summaryResult.success && 'stats' in summaryResult) {
        setStats((summaryResult as any).stats)
      }

      if (activityResult.success && 'activities' in activityResult) {
        setActivities((activityResult as any).activities)
      }
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCourtAdminRevenueBreakdown = async () => {
    setRevenueBreakdownLoading(true)

    try {
      const result = await getCourtAdminRevenueBreakdown() as any

      if (!result.success || !result.admins || !result.totals) {
        throw new Error(result.error || 'Failed to load revenue breakdown')
      }

      setRevenueBreakdown({
        admins: result.admins,
        totals: result.totals,
      })
    } catch (error) {
      console.error('Failed to load court admin revenue breakdown:', error)
    } finally {
      setRevenueBreakdownLoading(false)
    }
  }

  const handleOpenRevenueBreakdown = async () => {
    setShowRevenueBreakdown(true)

    if (!revenueBreakdown && !revenueBreakdownLoading) {
      await loadCourtAdminRevenueBreakdown()
    }
  }

  const toggleAdminExpansion = (adminId: string) => {
    setExpandedAdmins((current) =>
      current.includes(adminId)
        ? current.filter((id) => id !== adminId)
        : [...current, adminId]
    )
  }

  const formatCurrency = (amount: number) => `₱${amount.toLocaleString()}`

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <p className="text-gray-500">Failed to load analytics</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Platform Analytics</h1>
        <p className="text-gray-600 mt-2">Overview of your platform metrics and activity</p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Users */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-xs text-gray-500">+{stats.users.newThisMonth} this month</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.users.total}</h3>
          <p className="text-sm text-gray-600 mt-1">Total Users</p>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-green-600">{stats.users.active} Active</span>
            <span className="text-gray-300">•</span>
            <span className="text-red-600">{stats.users.banned} Banned</span>
          </div>
        </div>

        {/* Total Venues */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Building2 className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-xs text-gray-500">+{stats.venues.newThisMonth} this month</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.venues.total}</h3>
          <p className="text-sm text-gray-600 mt-1">Total Venues</p>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-green-600">{stats.venues.verified} Verified</span>
            <span className="text-gray-300">•</span>
            <span className="text-blue-600">{stats.venues.active} Active</span>
          </div>
        </div>

        {/* Total Courts */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-xs text-gray-500">+{stats.courts.newThisMonth} this month</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.courts.total}</h3>
          <p className="text-sm text-gray-600 mt-1">Total Courts</p>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-green-600">{stats.courts.verified} Verified</span>
            <span className="text-gray-300">•</span>
            <span className="text-yellow-600">{stats.courts.pending} Pending</span>
          </div>
        </div>

        {/* Total Revenue */}
        <button
          type="button"
          onClick={handleOpenRevenueBreakdown}
          className="bg-white rounded-xl border border-gray-200 p-6 text-left transition-all hover:border-yellow-300 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <PhilippinePeso className="w-6 h-6 text-yellow-600" />
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>{stats.reservations.recentBookings} bookings</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">₱{stats.reservations.totalRevenue.toLocaleString()}</h3>
          <p className="text-sm text-gray-600 mt-1">Total Revenue</p>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-green-600">{stats.reservations.completed} Completed</span>
            <span className="text-gray-300">•</span>
            <span className="text-blue-600">{stats.reservations.pending} Pending</span>
          </div>
          <p className="mt-4 text-xs font-medium text-yellow-700">View revenue by court admin</p>
        </button>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Role Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Distribution by Role</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-sm text-gray-700">Players</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{stats.users.roleDistribution.players}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span className="text-sm text-gray-700">Court Admins</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{stats.users.roleDistribution.court_admins}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span className="text-sm text-gray-700">Queue Masters</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{stats.users.roleDistribution.queue_masters}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-sm text-gray-700">Global Admins</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{stats.users.roleDistribution.global_admins}</span>
            </div>
          </div>
        </div>

        {/* Reservation Breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Reservation Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-700">Completed</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{stats.reservations.completed}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-700">Pending</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{stats.reservations.pending}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="text-sm text-gray-700">Cancelled</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{stats.reservations.cancelled}</span>
            </div>
            <div className="pt-3 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-900">Total</span>
                <span className="text-sm font-bold text-gray-900">{stats.reservations.total}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900">Recent Admin Activity</h3>
        </div>
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.slice(0, 10).map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                <div className="w-2 h-2 rounded-full bg-purple-500 mt-2"></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {activity.admin?.display_name || activity.admin?.email || 'Admin'}
                    </span>
                    <span className="text-xs text-gray-500">
                      {activity.action_type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">{activity.target_type}</span>
                    <span className="text-xs text-gray-400">
                      {new Date(activity.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showRevenueBreakdown && (
        <div className="fixed inset-0 z-50 bg-black/50 p-4">
          <div className="flex min-h-full items-center justify-center">
            <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-hidden border border-gray-200 shadow-xl">
              <div className="sticky top-0 z-10 flex items-start justify-between border-b border-gray-200 bg-white px-6 py-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">Court Admin Revenue Breakdown</h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Revenue from completed reservations grouped by venue owner.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowRevenueBreakdown(false)}
                  className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="max-h-[calc(90vh-81px)] overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-medium text-gray-600">Court Admins</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900">{revenueBreakdown?.totals.admins ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-medium text-gray-600">Managed Venues</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900">{revenueBreakdown?.totals.venues ?? 0}</p>
                  </div>
                  <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4">
                    <p className="text-sm font-medium text-yellow-800">Completed Reservation Revenue</p>
                    <p className="mt-2 text-2xl font-bold text-yellow-900">
                      {formatCurrency(revenueBreakdown?.totals.totalRevenue ?? 0)}
                    </p>
                  </div>
                </div>

                {revenueBreakdownLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : !revenueBreakdown || revenueBreakdown.admins.length === 0 ? (
                  <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
                    <p className="text-base font-medium text-gray-900">No court admin revenue yet</p>
                    <p className="mt-2 text-sm text-gray-500">
                      Revenue will appear here once court admins receive completed reservations.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1100px]">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="w-16 px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">View</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Court Admin</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Portfolio</th>
                            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Completed Bookings</th>
                            <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {revenueBreakdown.admins.map((admin) => {
                            const isExpanded = expandedAdmins.includes(admin.id)
                            const initials = (admin.display_name || admin.email || 'A').charAt(0).toUpperCase()
                            const topVenue = admin.venues[0]

                            return (
                              <Fragment key={admin.id}>
                                <tr className="transition-colors hover:bg-gray-50">
                                  <td className="px-6 py-4 align-top">
                                    <button
                                      type="button"
                                      onClick={() => toggleAdminExpansion(admin.id)}
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 transition-colors hover:bg-gray-100"
                                      aria-label={isExpanded ? 'Collapse admin revenue details' : 'Expand admin revenue details'}
                                    >
                                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </button>
                                  </td>
                                  <td className="px-6 py-4 align-top">
                                    <div className="flex items-center gap-3">
                                      <Avatar className="h-10 w-10 border border-gray-200">
                                        <AvatarImage src={admin.avatar_url || ''} alt={admin.display_name || admin.email} />
                                        <AvatarFallback className="bg-yellow-100 text-yellow-800 font-semibold">
                                          {initials}
                                        </AvatarFallback>
                                      </Avatar>
                                      <div>
                                        <p className="font-medium text-gray-900">{admin.display_name || 'Unnamed Court Admin'}</p>
                                        <p className="text-sm text-gray-500">{admin.email}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 align-top">
                                    <div className="space-y-2">
                                      <div className="flex flex-wrap gap-2 text-xs">
                                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">
                                          {admin.venueCount} venues
                                        </span>
                                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 font-medium text-gray-700">
                                          {admin.courtCount} courts
                                        </span>
                                      </div>
                                      {topVenue ? (
                                        <p className="text-sm text-gray-600">
                                          Top venue: <span className="font-medium text-gray-900">{topVenue.name}</span>
                                        </p>
                                      ) : (
                                        <p className="text-sm text-gray-500">No venues assigned</p>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 align-top text-sm text-gray-700">{admin.completedBookings}</td>
                                  <td className="px-6 py-4 align-top text-right">
                                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(admin.totalRevenue)}</p>
                                    <p className="mt-1 text-xs text-gray-500">
                                      {admin.completedBookings > 0
                                        ? `${formatCurrency(admin.totalRevenue / admin.completedBookings)} avg per booking`
                                        : 'No completed bookings'}
                                    </p>
                                  </td>
                                </tr>
                                {isExpanded && (
                                  <tr className="bg-gray-50/60">
                                    <td colSpan={5} className="px-6 py-5">
                                      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                                        <div className="border-b border-gray-200 px-5 py-4">
                                          <div className="flex items-center justify-between gap-4">
                                            <div>
                                              <h3 className="text-sm font-semibold text-gray-900">Venue Breakdown</h3>
                                              <p className="mt-1 text-xs text-gray-500">
                                                Each venue keeps its own court list, booking count, and revenue totals.
                                              </p>
                                            </div>
                                            <div className="flex flex-wrap justify-end gap-2 text-xs">
                                              <span className="inline-flex items-center rounded-full bg-yellow-50 px-2.5 py-1 font-medium text-yellow-800">
                                                {formatCurrency(admin.totalRevenue)} total revenue
                                              </span>
                                              <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 font-medium text-blue-800">
                                                {admin.completedBookings} completed bookings
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                        <div className="overflow-x-auto">
                                          <table className="w-full min-w-[920px]">
                                            <thead className="bg-gray-50 border-b border-gray-200">
                                              <tr>
                                                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Venue</th>
                                                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Courts</th>
                                                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Court List</th>
                                                <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Completed Bookings</th>
                                                <th className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Revenue</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200">
                                              {admin.venues.map((venue) => (
                                                <tr key={venue.id} className="align-top">
                                                  <td className="px-5 py-4">
                                                    <p className="text-sm font-medium text-gray-900">{venue.name}</p>
                                                  </td>
                                                  <td className="px-5 py-4 text-sm text-gray-700">{venue.courtCount}</td>
                                                  <td className="px-5 py-4">
                                                    {venue.courts.length > 0 ? (
                                                      <div className="max-h-28 overflow-y-auto pr-2">
                                                        <div className="flex flex-wrap gap-2">
                                                          {venue.courts.map((court) => (
                                                            <span
                                                              key={court.id}
                                                              className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
                                                            >
                                                              {court.name}
                                                            </span>
                                                          ))}
                                                        </div>
                                                      </div>
                                                    ) : (
                                                      <p className="text-sm text-gray-500">No courts listed</p>
                                                    )}
                                                  </td>
                                                  <td className="px-5 py-4 text-sm text-gray-700">{venue.completedBookings}</td>
                                                  <td className="px-5 py-4 text-right">
                                                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(venue.totalRevenue)}</p>
                                                    <p className="mt-1 text-xs text-gray-500">
                                                      {venue.completedBookings > 0
                                                        ? `${formatCurrency(venue.totalRevenue / venue.completedBookings)} avg per booking`
                                                        : 'No completed bookings'}
                                                    </p>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
