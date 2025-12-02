'use client'

import { useState, useEffect } from 'react'
import { getMyQueueMasterSessions } from '@/app/actions/queue-actions'
import { Plus, Calendar, TrendingUp, DollarSign, Users, Clock, PlayCircle, CheckCircle, XCircle, Loader2, AlertCircle } from 'lucide-react'
import Link from 'next/link'

type SessionStatus = 'active' | 'upcoming' | 'past'

interface SessionData {
  id: string
  courtName: string
  venueName: string
  status: string
  currentPlayers: number
  maxPlayers: number
  costPerGame: number
  startTime: Date
  endTime: Date
  mode: string
  gameFormat: string
  participants: any[]
}

export function QueueMasterDashboard() {
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [filter, setFilter] = useState<SessionStatus>('active')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadSessions()
  }, [filter])

  const loadSessions = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getMyQueueMasterSessions({ status: filter })
      if (result.success && result.sessions) {
        setSessions(result.sessions)
      } else {
        setError(result.error || 'Failed to load sessions')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate stats from all sessions
  const stats = {
    totalSessions: sessions.length,
    totalRevenue: sessions.reduce((sum, s) => {
      const revenue = s.participants.reduce((pSum, p) => pSum + (p.amountOwed || 0), 0)
      return sum + revenue
    }, 0),
    averagePlayers: sessions.length > 0 
      ? Math.round(sessions.reduce((sum, s) => sum + s.currentPlayers, 0) / sessions.length) 
      : 0,
    activeSessions: sessions.filter(s => ['active', 'open'].includes(s.status)).length,
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-700 border-green-200'
      case 'open': return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'paused': return 'bg-yellow-100 text-yellow-700 border-yellow-200'
      case 'closed': return 'bg-gray-100 text-gray-700 border-gray-200'
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200'
      default: return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <PlayCircle className="w-4 h-4" />
      case 'open': return <Clock className="w-4 h-4" />
      case 'closed': return <CheckCircle className="w-4 h-4" />
      case 'cancelled': return <XCircle className="w-4 h-4" />
      default: return <Clock className="w-4 h-4" />
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Queue Master Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage your queue sessions and organize matches</p>
          </div>
          <Link
            href="/queue-master/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shadow-lg hover:shadow-xl"
          >
            <Plus className="w-5 h-5" />
            <span className="font-semibold">Create Session</span>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold">{stats.totalSessions}</span>
          </div>
          <p className="text-blue-100 text-sm font-medium">Total Sessions</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold">₱{stats.totalRevenue.toFixed(0)}</span>
          </div>
          <p className="text-green-100 text-sm font-medium">Total Revenue</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold">{stats.averagePlayers}</span>
          </div>
          <p className="text-purple-100 text-sm font-medium">Avg Players/Session</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6" />
            </div>
            <span className="text-2xl font-bold">{stats.activeSessions}</span>
          </div>
          <p className="text-orange-100 text-sm font-medium">Active Now</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border border-gray-200 rounded-xl p-2 mb-6 inline-flex gap-2">
        <button
          onClick={() => setFilter('active')}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            filter === 'active'
              ? 'bg-primary text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Active ({sessions.filter(s => ['active', 'open'].includes(s.status)).length})
        </button>
        <button
          onClick={() => setFilter('upcoming')}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            filter === 'upcoming'
              ? 'bg-primary text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Upcoming
        </button>
        <button
          onClick={() => setFilter('past')}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            filter === 'past'
              ? 'bg-primary text-white shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          Past
        </button>
      </div>

      {/* Sessions List */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          {filter === 'active' && 'Active Sessions'}
          {filter === 'upcoming' && 'Upcoming Sessions'}
          {filter === 'past' && 'Past Sessions'}
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-white border border-red-200 rounded-xl p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">Failed to Load Sessions</h3>
            <p className="text-sm text-gray-500 mb-4">{error}</p>
            <button
              onClick={loadSessions}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">No Sessions Yet</h3>
            <p className="text-sm text-gray-500 mb-6">
              Create your first queue session to get started
            </p>
            <Link
              href="/queue-master/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Create Session</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/queue-master/sessions/${session.id}`}
                className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-all duration-200 hover:border-primary/50 group"
              >
                {/* Session Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg text-gray-900 group-hover:text-primary transition-colors">
                        {session.courtName}
                      </h3>
                      <span className="text-xs font-mono text-gray-400 bg-gray-50 px-2 py-1 rounded">
                        #{session.id.slice(0, 8)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{session.venueName}</p>
                  </div>
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium ${getStatusColor(session.status)}`}>
                    {getStatusIcon(session.status)}
                    <span className="capitalize">{session.status}</span>
                  </div>
                </div>

                {/* Session Info Grid */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="w-4 h-4 text-gray-500" />
                      <span className="text-xs text-gray-600">Players</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">
                      {session.currentPlayers}/{session.maxPlayers}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <DollarSign className="w-4 h-4 text-gray-500" />
                      <span className="text-xs text-gray-600">Per Game</span>
                    </div>
                    <p className="text-lg font-bold text-gray-900">
                      ₱{session.costPerGame}
                    </p>
                  </div>
                </div>

                {/* Session Details */}
                <div className="flex items-center justify-between text-sm pt-4 border-t border-gray-100">
                  <div className="flex items-center gap-4 text-gray-600">
                    <span className="capitalize font-medium">{session.gameFormat}</span>
                    <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                    <span className="capitalize">{session.mode}</span>
                  </div>
                  <div className="text-gray-500">
                    {new Date(session.startTime).toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      hour12: true 
                    })}
                  </div>
                </div>

                {/* View Summary for closed sessions */}
                {(session.status === 'closed' || session.status === 'cancelled') && (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-center gap-2 text-primary font-medium text-sm group-hover:text-primary-dark transition-colors">
                      <CheckCircle className="w-4 h-4" />
                      <span>View Session Summary</span>
                    </div>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
