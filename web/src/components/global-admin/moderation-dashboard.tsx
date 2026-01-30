'use client'

import { useState, useEffect } from 'react'
import {
  getFlaggedReviews,
  getModerationStats,
  resolveFlaggedReview,
  getBannedUsers,
  unbanUser,
  getRecentModerationActivity,
  batchDeleteReviews
} from '@/app/actions/global-admin-moderation-actions'
import {
  Flag,
  Shield,
  Trash2,
  CheckCircle,
  XCircle,
  Ban,
  UserX,
  Eye,
  Calendar,
  Star,
  Loader2,
  AlertTriangle,
  TrendingUp,
  Clock,
  Activity,
  MessageSquare,
  Building2
} from 'lucide-react'

interface FlaggedReview {
  id: string
  overall_rating: number
  review: string
  created_at: string
  metadata: any
  user: {
    id: string
    display_name: string
    email: string
    avatar_url?: string
  }
  court: {
    id: string
    name: string
    venue: {
      id: string
      name: string
      owner_id: string
    }
  }
}

interface BannedUser {
  id: string
  email: string
  display_name: string
  avatar_url?: string
  metadata: any
  created_at: string
}

export default function ModerationDashboard() {
  const [activeTab, setActiveTab] = useState<'flagged' | 'banned' | 'activity'>('flagged')
  const [flaggedReviews, setFlaggedReviews] = useState<FlaggedReview[]>([])
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [stats, setStats] = useState({
    pendingFlags: 0,
    totalFlagged: 0,
    resolvedFlags: 0,
    bannedUsers: 0,
    recentActions: 0
  })
  const [loading, setLoading] = useState(true)
  const [selectedReview, setSelectedReview] = useState<FlaggedReview | null>(null)
  const [actionNotes, setActionNotes] = useState('')
  const [processing, setProcessing] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'pending' | 'resolved' | 'dismissed' | 'all'>('pending')
  const [selectedReviews, setSelectedReviews] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadModerationData()
  }, [statusFilter])

  const loadModerationData = async () => {
    setLoading(true)
    try {
      const [statsResult, reviewsResult, usersResult, activityResult] = await Promise.all([
        getModerationStats(),
        getFlaggedReviews({ status: statusFilter === 'all' ? undefined : statusFilter }),
        getBannedUsers(),
        getRecentModerationActivity(15)
      ])

      if (statsResult.success && 'stats' in statsResult) {
        setStats((statsResult as any).stats)
      }

      if (reviewsResult.success && 'reviews' in reviewsResult) {
        setFlaggedReviews((reviewsResult as any).reviews || [])
      }

      if (usersResult.success && 'users' in usersResult) {
        setBannedUsers((usersResult as any).users || [])
      }

      if (activityResult.success && 'activities' in activityResult) {
        setActivities((activityResult as any).activities || [])
      }
    } catch (error) {
      console.error('Failed to load moderation data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleResolveReview = async (reviewId: string, action: 'dismiss' | 'delete' | 'ban_user') => {
    if (!actionNotes.trim() && action !== 'dismiss') {
      alert('Please provide notes for this action')
      return
    }

    setProcessing(true)
    try {
      const result = await resolveFlaggedReview(reviewId, action, actionNotes)
      if (result.success) {
        setSelectedReview(null)
        setActionNotes('')
        await loadModerationData()
      } else {
        alert(result.error || 'Failed to complete action')
      }
    } catch (error: any) {
      alert(error.message || 'Failed to complete action')
    } finally {
      setProcessing(false)
    }
  }

  const handleUnbanUser = async (userId: string) => {
    const notes = prompt('Reason for unbanning (optional):')
    if (notes === null) return // User cancelled

    setProcessing(true)
    try {
      const result = await unbanUser(userId, notes || undefined)
      if (result.success) {
        await loadModerationData()
      } else {
        alert(result.error || 'Failed to unban user')
      }
    } catch (error: any) {
      alert(error.message || 'Failed to unban user')
    } finally {
      setProcessing(false)
    }
  }

  const handleBatchDelete = async () => {
    if (selectedReviews.size === 0) {
      alert('No reviews selected')
      return
    }

    const reason = prompt(`Delete ${selectedReviews.size} reviews? Enter reason:`)
    if (!reason) return

    setProcessing(true)
    try {
      const result = await batchDeleteReviews(Array.from(selectedReviews), reason)
      if (result.success) {
        setSelectedReviews(new Set())
        await loadModerationData()
      } else {
        alert(result.error || 'Failed to delete reviews')
      }
    } catch (error: any) {
      alert(error.message || 'Failed to delete reviews')
    } finally {
      setProcessing(false)
    }
  }

  const toggleReviewSelection = (reviewId: string) => {
    const newSelection = new Set(selectedReviews)
    if (newSelection.has(reviewId)) {
      newSelection.delete(reviewId)
    } else {
      newSelection.add(reviewId)
    }
    setSelectedReviews(newSelection)
  }

  const toggleSelectAll = () => {
    if (selectedReviews.size === flaggedReviews.length) {
      setSelectedReviews(new Set())
    } else {
      setSelectedReviews(new Set(flaggedReviews.map(r => r.id)))
    }
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`}
      />
    ))
  }

  const getFlagReason = (metadata: any) => {
    const flags = metadata?.flags || []
    if (flags.length === 0) return 'No reason provided'
    return flags[flags.length - 1].reason || 'No reason provided'
  }

  const getFlaggedDate = (metadata: any) => {
    const flags = metadata?.flags || []
    if (flags.length === 0) return null
    return flags[flags.length - 1].flaggedAt
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Content Moderation</h1>
        <p className="text-gray-600 mt-2">Review and moderate flagged content and user reports</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Flag className="w-5 h-5 text-red-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.pendingFlags}</h3>
          <p className="text-sm text-gray-600 mt-1">Pending Flags</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.resolvedFlags}</h3>
          <p className="text-sm text-gray-600 mt-1">Resolved</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.totalFlagged}</h3>
          <p className="text-sm text-gray-600 mt-1">Total Flagged</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Ban className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.bannedUsers}</h3>
          <p className="text-sm text-gray-600 mt-1">Banned Users</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900">{stats.recentActions}</h3>
          <p className="text-sm text-gray-600 mt-1">Actions (30d)</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('flagged')}
            className={`pb-3 border-b-2 transition-colors ${activeTab === 'flagged'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            <div className="flex items-center gap-2">
              <Flag className="w-4 h-4" />
              <span className="font-medium">Flagged Reviews</span>
              {stats.pendingFlags > 0 && (
                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {stats.pendingFlags}
                </span>
              )}
            </div>
          </button>

          <button
            onClick={() => setActiveTab('banned')}
            className={`pb-3 border-b-2 transition-colors ${activeTab === 'banned'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            <div className="flex items-center gap-2">
              <UserX className="w-4 h-4" />
              <span className="font-medium">Banned Users</span>
              {stats.bannedUsers > 0 && (
                <span className="bg-purple-500 text-white text-xs px-2 py-0.5 rounded-full">
                  {stats.bannedUsers}
                </span>
              )}
            </div>
          </button>

          <button
            onClick={() => setActiveTab('activity')}
            className={`pb-3 border-b-2 transition-colors ${activeTab === 'activity'
              ? 'border-purple-600 text-purple-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="font-medium">Recent Activity</span>
            </div>
          </button>
        </div>
      </div>

      {/* Flagged Reviews Tab */}
      {activeTab === 'flagged' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value="pending">Pending</option>
                <option value="resolved">Resolved</option>
                <option value="dismissed">Dismissed</option>
                <option value="all">All</option>
              </select>

              {selectedReviews.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600">{selectedReviews.size} selected</span>
                  <button
                    onClick={handleBatchDelete}
                    disabled={processing}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Selected
                  </button>
                </div>
              )}
            </div>

            {flaggedReviews.length > 0 && (
              <button
                onClick={toggleSelectAll}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                {selectedReviews.size === flaggedReviews.length ? 'Deselect All' : 'Select All'}
              </button>
            )}
          </div>

          {/* Reviews List */}
          {flaggedReviews.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No flagged reviews found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {flaggedReviews.map((review) => (
                <div
                  key={review.id}
                  className="bg-white border border-red-200 rounded-xl p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedReviews.has(review.id)}
                      onChange={() => toggleReviewSelection(review.id)}
                      className="mt-1 w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                    />

                    {/* User Avatar */}
                    <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold flex-shrink-0">
                      {review.user.avatar_url ? (
                        <img src={review.user.avatar_url} alt="" className="w-12 h-12 rounded-full" />
                      ) : (
                        review.user.display_name?.charAt(0) || 'U'
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-semibold text-gray-900">{review.user.display_name}</h3>
                          <p className="text-sm text-gray-500">{review.user.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {renderStars(review.overall_rating)}
                        </div>
                      </div>

                      {/* Venue Info */}
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                        <Building2 className="w-4 h-4" />
                        <span>{review.court.venue.name} - {review.court.name}</span>
                      </div>

                      {/* Review Text */}
                      <p className="text-gray-700 mb-3 bg-gray-50 p-3 rounded-lg">{review.review}</p>

                      {/* Flag Info */}
                      <div className="flex items-start gap-2 mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <Flag className="w-4 h-4 text-red-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-red-900">Flag Reason:</p>
                          <p className="text-sm text-red-700">{getFlagReason(review.metadata)}</p>
                          {getFlaggedDate(review.metadata) && (
                            <p className="text-xs text-red-600 mt-1">
                              Flagged {new Date(getFlaggedDate(review.metadata)).toLocaleString()}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedReview(review)}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2 text-sm"
                        >
                          <Eye className="w-4 h-4" />
                          Review
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Banned Users Tab */}
      {activeTab === 'banned' && (
        <div className="space-y-4">
          {bannedUsers.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <UserX className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No banned users</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bannedUsers.map((user) => (
                <div key={user.id} className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 font-bold">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt="" className="w-12 h-12 rounded-full" />
                      ) : (
                        user.display_name?.charAt(0) || 'U'
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{user.display_name}</h3>
                      <p className="text-sm text-gray-500">{user.email}</p>
                      {user.metadata?.ban_reason && (
                        <p className="text-sm text-red-600 mt-2">Reason: {user.metadata.ban_reason}</p>
                      )}
                      {user.metadata?.banned_at && (
                        <p className="text-xs text-gray-400 mt-1">
                          Banned {new Date(user.metadata.banned_at).toLocaleDateString()}
                        </p>
                      )}
                      <button
                        onClick={() => handleUnbanUser(user.id)}
                        disabled={processing}
                        className="mt-3 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
                      >
                        Unban User
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Recent Activity Tab */}
      {activeTab === 'activity' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Moderation Actions</h3>
          {activities.length === 0 ? (
            <div className="text-center py-8">
              <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => (
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
                    {activity.metadata?.reason && (
                      <p className="text-xs text-gray-600 mt-1">Reason: {activity.metadata.reason}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Review Action Modal */}
      {selectedReview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900">Review Flagged Content</h2>
            </div>

            <div className="p-6 space-y-4">
              {/* User Info */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center text-gray-600 font-bold">
                  {selectedReview.user.display_name?.charAt(0) || 'U'}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{selectedReview.user.display_name}</h3>
                  <p className="text-sm text-gray-500">{selectedReview.user.email}</p>
                </div>
              </div>

              {/* Review */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Review Content</label>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    {renderStars(selectedReview.overall_rating)}
                  </div>
                  <p className="text-gray-700">{selectedReview.review}</p>
                </div>
              </div>

              {/* Flag Reason */}
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-900 mb-1">Flag Reason:</p>
                <p className="text-sm text-red-700">{getFlagReason(selectedReview.metadata)}</p>
              </div>

              {/* Action Notes */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Action Notes (optional)
                </label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows={3}
                  placeholder="Add notes about your moderation decision..."
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleResolveReview(selectedReview.id, 'dismiss')}
                  disabled={processing}
                  className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Dismiss Flag
                </button>

                <button
                  onClick={() => handleResolveReview(selectedReview.id, 'delete')}
                  disabled={processing}
                  className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5" />
                  Delete Review
                </button>

                <button
                  onClick={() => handleResolveReview(selectedReview.id, 'ban_user')}
                  disabled={processing}
                  className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Ban className="w-5 h-5" />
                  Ban User
                </button>
              </div>

              <button
                onClick={() => {
                  setSelectedReview(null)
                  setActionNotes('')
                }}
                className="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
