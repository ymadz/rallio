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
  Clock
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

      setStats((statsResult as any).stats!)
      setActivity((activityResult as any).activity)
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
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
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
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
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
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Total Users */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex items-center gap-1 text-sm font-medium text-gray-600">
              {stats.userGrowthPercent >= 0 ? (
                <>
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-green-600">+{stats.userGrowthPercent}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  <span className="text-red-600">{stats.userGrowthPercent}%</span>
                </>
              )}
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.totalUsers.toLocaleString()}</p>
          <p className="text-gray-700 text-sm font-medium">Total Users</p>
          <p className="text-gray-500 text-xs mt-1">+{stats.newUsers30Days} in last 30 days</p>
        </div>

        {/* Total Venues */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-emerald-50 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-emerald-600" />
            </div>
            {stats.pendingVenues > 0 && (
              <Link
                href="/admin/venues"
                className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium hover:bg-amber-200"
              >
                {stats.pendingVenues} pending
              </Link>
            )}
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.totalVenues}</p>
          <p className="text-gray-700 text-sm font-medium">Total Venues</p>
          <p className="text-gray-500 text-xs mt-1">{stats.activeVenues} active</p>
        </div>

        {/* Monthly Revenue */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">₱{stats.monthlyRevenue.toLocaleString()}</p>
          <p className="text-gray-700 text-sm font-medium">Monthly Revenue</p>
          <p className="text-gray-500 text-xs mt-1">Last 30 days</p>
        </div>

        {/* Active Queue Sessions */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-orange-50 rounded-lg flex items-center justify-center">
              <Activity className="w-6 h-6 text-orange-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.activeQueueSessions}</p>
          <p className="text-gray-700 text-sm font-medium">Active Queue Sessions</p>
          <p className="text-gray-500 text-xs mt-1">Currently running</p>
        </div>

        {/* Platform Rating */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-50 rounded-lg flex items-center justify-center">
              <Star className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.platformRating.toFixed(1)}</p>
          <p className="text-gray-700 text-sm font-medium">Platform Rating</p>
          <p className="text-gray-500 text-xs mt-1">Average across all venues</p>
        </div>

        {/* Pending Approvals */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-pink-50 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-pink-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{stats.pendingVenues}</p>
          <p className="text-gray-700 text-sm font-medium">Pending Approvals</p>
          <p className="text-xs mt-1">
            <Link
              href="/admin/venues"
              className="text-pink-600 hover:text-pink-700 font-medium"
            >
              Review now →
            </Link>
          </p>
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
