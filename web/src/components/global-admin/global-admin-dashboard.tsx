'use client'

import { useState, useEffect } from 'react'
import { getDashboardStats, getRecentActivity } from '@/app/actions/global-admin-actions'
import {
  Users,
  Building2,
  DollarSign,
  Activity,
  Star,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Loader2,
  Clock,
  CheckCircle
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface DashboardStats {
  totalUsers: number
  newUsers30Days: number
  userGrowthPercent: number
  totalVenues: number
  activeVenues: number
  pendingVenues: number
  monthlyRevenue: number
  activeQueueSessions: number
  platformRating: number
}

export default function GlobalAdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activity, setActivity] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadDashboard()
    setupRealTimeUpdates()
  }, [])

  const loadDashboard = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [statsResult, activityResult] = await Promise.all([
        getDashboardStats(),
        getRecentActivity()
      ])

      if (!statsResult.success) {
        throw new Error(statsResult.error)
      }

      if (!activityResult.success) {
        throw new Error(activityResult.error)
      }

      setStats(statsResult.stats!)
      setActivity(activityResult.activity)
    } catch (err: any) {
      setError(err.message || 'Failed to load dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const setupRealTimeUpdates = () => {
    const supabase = createClient()

    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'profiles' },
        () => loadDashboard()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'venues' },
        () => loadDashboard()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'queue_sessions' },
        () => loadDashboard()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    )
  }

  if (error || !stats) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-red-900 mb-1">Error Loading Dashboard</h3>
            <p className="text-sm text-red-700">{error || 'Failed to load data'}</p>
            <button
              onClick={loadDashboard}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard Overview</h1>
        <p className="text-gray-600">Platform-wide statistics and recent activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Users */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1 text-sm font-medium">
              {stats.userGrowthPercent >= 0 ? (
                <>
                  <TrendingUp className="w-4 h-4" />
                  <span>+{stats.userGrowthPercent}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-4 h-4" />
                  <span>{stats.userGrowthPercent}%</span>
                </>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-bold">{stats.totalUsers.toLocaleString()}</p>
            <p className="text-blue-100 text-sm">Total Users</p>
            <p className="text-xs text-blue-200">+{stats.newUsers30Days} in last 30 days</p>
          </div>
        </div>

        {/* Total Venues */}
        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6" />
            </div>
            {stats.pendingVenues > 0 && (
              <Link
                href="/admin/venues"
                className="text-xs bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full font-medium hover:bg-yellow-300"
              >
                {stats.pendingVenues} pending
              </Link>
            )}
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-bold">{stats.totalVenues}</p>
            <p className="text-green-100 text-sm">Total Venues</p>
            <p className="text-xs text-green-200">{stats.activeVenues} active</p>
          </div>
        </div>

        {/* Monthly Revenue */}
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-bold">₱{stats.monthlyRevenue.toLocaleString()}</p>
            <p className="text-purple-100 text-sm">Monthly Revenue</p>
            <p className="text-xs text-purple-200">Last 30 days</p>
          </div>
        </div>

        {/* Active Queue Sessions */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-bold">{stats.activeQueueSessions}</p>
            <p className="text-orange-100 text-sm">Active Queue Sessions</p>
            <p className="text-xs text-orange-200">Currently running</p>
          </div>
        </div>

        {/* Platform Rating */}
        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Star className="w-6 h-6" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-bold">{stats.platformRating.toFixed(1)}</p>
            <p className="text-yellow-100 text-sm">Platform Rating</p>
            <p className="text-xs text-yellow-200">Average across all venues</p>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-gradient-to-br from-pink-500 to-pink-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-bold">{stats.pendingVenues}</p>
            <p className="text-pink-100 text-sm">Pending Approvals</p>
            <Link
              href="/admin/venues"
              className="text-xs text-pink-200 hover:text-white underline"
            >
              Review now →
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {activity && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Users */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-600" />
              Recent User Signups
            </h3>
            <div className="space-y-3">
              {activity.recentUsers?.slice(0, 5).map((user: any) => (
                <div key={user.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-gray-900">{user.display_name || 'No name'}</p>
                    <p className="text-sm text-gray-600">{user.email}</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    {new Date(user.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
              {activity.recentUsers?.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No recent signups</p>
              )}
            </div>
          </div>

          {/* Recent Venues */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-600" />
              Recent Venue Submissions
            </h3>
            <div className="space-y-3">
              {activity.recentVenues?.slice(0, 5).map((venue: any) => (
                <div key={venue.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{venue.name}</p>
                    <p className="text-xs">
                      {!venue.is_verified ? (
                        <span className="text-yellow-600">⏳ Pending approval</span>
                      ) : (
                        <span className="text-green-600">✓ Approved</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-gray-500">
                      {new Date(venue.created_at).toLocaleDateString()}
                    </p>
                    {!venue.is_verified ? (
                      <Link
                        href="/admin/venues?tab=pending"
                        className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded hover:bg-yellow-200 transition-colors"
                      >
                        Review
                      </Link>
                    ) : (
                      <Link
                        href={`/admin/venues`}
                        className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                      >
                        View
                      </Link>
                    )}
                  </div>
                </div>
              ))}
              {activity.recentVenues?.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-4">No recent venues</p>
              )}
            </div>
            {activity.recentVenues?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <Link
                  href="/admin/venues"
                  className="text-sm text-primary hover:text-primary-dark font-medium"
                >
                  View all venues →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
