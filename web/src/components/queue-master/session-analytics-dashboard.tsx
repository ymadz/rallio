'use client'

import { useState, useEffect } from 'react'
import { getMyQueueMasterSessions } from '@/app/actions/queue-actions'
import { TrendingUp, DollarSign, Users, Calendar, BarChart3, PieChart, Activity } from 'lucide-react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { Line, Bar, Doughnut } from 'react-chartjs-2'

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

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

export function SessionAnalyticsDashboard() {
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('month')

  useEffect(() => {
    loadAllSessions()
  }, [])

  const loadAllSessions = async () => {
    setIsLoading(true)
    try {
      // Load past sessions for analytics
      const result = await getMyQueueMasterSessions({ status: 'past' })
      if (result.success && result.sessions) {
        setSessions(result.sessions)
      }
    } catch (err) {
      console.error('Failed to load sessions:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Calculate analytics
  const analytics = {
    totalSessions: sessions.length,
    totalRevenue: sessions.reduce((sum, s) => {
      const revenue = s.participants.reduce((pSum, p) => pSum + (p.amountOwed || 0), 0)
      return sum + revenue
    }, 0),
    totalPlayers: sessions.reduce((sum, s) => sum + s.participants.length, 0),
    avgPlayersPerSession: sessions.length > 0
      ? (sessions.reduce((sum, s) => sum + s.participants.length, 0) / sessions.length).toFixed(1)
      : 0,
    avgRevenuePerSession: sessions.length > 0
      ? sessions.reduce((sum, s) => {
          const revenue = s.participants.reduce((pSum, p) => pSum + (p.amountOwed || 0), 0)
          return sum + revenue
        }, 0) / sessions.length
      : 0,
  }

  // Revenue over time data
  const revenueByDate = sessions.reduce((acc, session) => {
    const date = new Date(session.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const revenue = session.participants.reduce((sum, p) => sum + (p.amountOwed || 0), 0)
    acc[date] = (acc[date] || 0) + revenue
    return acc
  }, {} as Record<string, number>)

  const revenueChartData = {
    labels: Object.keys(revenueByDate).slice(-7), // Last 7 dates
    datasets: [
      {
        label: 'Revenue (₱)',
        data: Object.values(revenueByDate).slice(-7),
        borderColor: 'rgb(34, 197, 94)',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  }

  // Players per session data
  const playersChartData = {
    labels: sessions.slice(-7).map((s, i) => `Session ${i + 1}`),
    datasets: [
      {
        label: 'Players',
        data: sessions.slice(-7).map(s => s.participants.length),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
      },
    ],
  }

  // Game format distribution
  const formatCounts = sessions.reduce((acc, session) => {
    acc[session.gameFormat] = (acc[session.gameFormat] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const formatChartData = {
    labels: Object.keys(formatCounts).map(k => k.charAt(0).toUpperCase() + k.slice(1)),
    datasets: [
      {
        data: Object.values(formatCounts),
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(251, 146, 60, 0.8)',
        ],
      },
    ],
  }

  // Mode distribution
  const modeCounts = sessions.reduce((acc, session) => {
    acc[session.mode] = (acc[session.mode] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const modeChartData = {
    labels: Object.keys(modeCounts).map(k => k.charAt(0).toUpperCase() + k.slice(1)),
    datasets: [
      {
        data: Object.values(modeCounts),
        backgroundColor: [
          'rgba(168, 85, 247, 0.8)',
          'rgba(236, 72, 153, 0.8)',
        ],
      },
    ],
  }

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-20">
          <div className="inline-block w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-20">
          <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No Data Yet</h3>
          <p className="text-gray-600">Complete some sessions to see analytics</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Session Analytics</h1>
          <p className="text-gray-600 mt-1">Performance insights and trends</p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
        >
          <option value="week">Last 7 Days</option>
          <option value="month">Last 30 Days</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Calendar className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-blue-100 text-sm font-medium mb-1">Total Sessions</p>
          <p className="text-3xl font-bold">{analytics.totalSessions}</p>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-green-100 text-sm font-medium mb-1">Total Revenue</p>
          <p className="text-3xl font-bold">₱{analytics.totalRevenue.toLocaleString()}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-purple-100 text-sm font-medium mb-1">Total Players</p>
          <p className="text-3xl font-bold">{analytics.totalPlayers}</p>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="w-8 h-8 opacity-80" />
          </div>
          <p className="text-orange-100 text-sm font-medium mb-1">Avg Players/Session</p>
          <p className="text-3xl font-bold">{analytics.avgPlayersPerSession}</p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Over Time */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h3 className="font-semibold text-gray-900">Revenue Trend</h3>
          </div>
          <div className="h-64">
            <Line
              data={revenueChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      callback: (value) => '₱' + value,
                    },
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Players Per Session */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Players Per Session</h3>
          </div>
          <div className="h-64">
            <Bar
              data={playersChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: false,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    ticks: {
                      stepSize: 2,
                    },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Game Format Distribution */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-gray-900">Game Format Distribution</h3>
          </div>
          <div className="h-64 flex items-center justify-center">
            <Doughnut
              data={formatChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                  },
                },
              }}
            />
          </div>
        </div>

        {/* Mode Distribution */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-pink-600" />
            <h3 className="font-semibold text-gray-900">Session Mode Distribution</h3>
          </div>
          <div className="h-64 flex items-center justify-center">
            <Doughnut
              data={modeChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'bottom',
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Summary Statistics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-gray-600 mb-1">Avg Revenue/Session</p>
            <p className="text-2xl font-bold text-gray-900">
              ₱{analytics.avgRevenuePerSession.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Most Popular Format</p>
            <p className="text-2xl font-bold text-gray-900 capitalize">
              {Object.keys(formatCounts)[0] || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Most Popular Mode</p>
            <p className="text-2xl font-bold text-gray-900 capitalize">
              {Object.keys(modeCounts)[0] || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-1">Total Hours Organized</p>
            <p className="text-2xl font-bold text-gray-900">
              {sessions.reduce((sum, s) => {
                const duration = (new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / (1000 * 60 * 60)
                return sum + duration
              }, 0).toFixed(0)}h
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
