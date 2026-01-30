'use client'

import { useState, useEffect } from 'react'
import {
  getAnalyticsSummary,
  getRecentActivity,
  getUserGrowthChart
} from '@/app/actions/global-admin-analytics-actions'
import {
  Users,
  Building2,
  Calendar,
  DollarSign,
  TrendingUp,
  Shield,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Activity
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

export default function AnalyticsDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

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
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-yellow-600" />
            </div>
            <span className="text-xs text-gray-500">{stats.reservations.recentBookings} bookings</span>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">₱{stats.reservations.totalRevenue.toLocaleString()}</h3>
          <p className="text-sm text-gray-600 mt-1">Total Revenue</p>
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-green-600">{stats.reservations.completed} Completed</span>
            <span className="text-gray-300">•</span>
            <span className="text-blue-600">{stats.reservations.pending} Pending</span>
          </div>
        </div>
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
    </div>
  )
}
