'use client'

import { useState, useEffect } from 'react'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  Users,
  Clock,
  BarChart3,
  PieChart,
  Download,
  Filter,
  Loader2,
  AlertCircle
} from 'lucide-react'
import { getVenueAnalytics, getCourtPerformance, getPeakHours } from '@/app/actions/court-admin-analytics-actions'

interface RevenueData {
  month: string
  revenue: number
  bookings: number
}

interface CourtPerformance {
  courtName: string
  bookings: number
  revenue: number
  utilization: number
}

interface AnalyticsDashboardProps {
  venueId: string
}

export function AnalyticsDashboard({ venueId }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month')
  const [analytics, setAnalytics] = useState<any>(null)
  const [courtPerformance, setCourtPerformance] = useState<any[]>([])
  const [peakHours, setPeakHours] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAnalytics()
  }, [venueId, timeRange])

  const loadAnalytics = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [analyticsResult, courtResult, peakResult] = await Promise.all([
        getVenueAnalytics(venueId, timeRange),
        getCourtPerformance(venueId),
        getPeakHours(venueId)
      ])
      
      if (analyticsResult.success) {
        setAnalytics(analyticsResult.analytics)
      }
      if (courtResult.success) {
        setCourtPerformance(courtResult.performance || [])
      }
      if (peakResult.success) {
        setPeakHours(peakResult.peakHours || [])
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics')
    } finally {
      setIsLoading(false)
    }
  }

  const maxBookings = peakHours.length > 0 ? Math.max(...peakHours.map(h => h.booking_count || h.bookings || 0)) : 1

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Analytics Dashboard</h1>
            <p className="text-gray-600">Revenue insights and performance metrics</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="week">Last 7 Days</option>
              <option value="month">Last 30 Days</option>
              <option value="year">Last 12 Months</option>
            </select>
            <button className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900 mb-1">Error Loading Analytics</h3>
            <p className="text-sm text-red-700">{error}</p>
            <button
              onClick={loadAnalytics}
              className="mt-3 text-sm text-red-700 hover:text-red-900 font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && !analytics && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-8 text-center">
          <BarChart3 className="w-12 h-12 text-blue-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-blue-900 mb-2">No Analytics Data Yet</h3>
          <p className="text-sm text-blue-700">
            Start receiving bookings to see your analytics and performance metrics.
          </p>
        </div>
      )}

      {/* Key Metrics */}
      {!isLoading && !error && analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
              {analytics.revenue_change > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  <TrendingUp className="w-3 h-3" />
                  +{analytics.revenue_change}%
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
            <p className="text-3xl font-bold text-gray-900">₱{analytics.total_revenue?.toLocaleString() || 0}</p>
            <p className="text-xs text-gray-500 mt-1">vs last period: ₱{analytics.previous_revenue?.toLocaleString() || 0}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              {analytics.bookings_change > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  <TrendingUp className="w-3 h-3" />
                  +{analytics.bookings_change}%
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-1">Total Bookings</p>
            <p className="text-3xl font-bold text-gray-900">{analytics.total_bookings || 0}</p>
            <p className="text-xs text-gray-500 mt-1">vs last period: {analytics.previous_bookings || 0}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
              {analytics.customers_change > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                  <TrendingUp className="w-3 h-3" />
                  +{analytics.customers_change}%
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-1">Unique Customers</p>
            <p className="text-3xl font-bold text-gray-900">{analytics.unique_customers || 0}</p>
            <p className="text-xs text-gray-500 mt-1">vs last period: {analytics.previous_customers || 0}</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-orange-600" />
              </div>
              {analytics.avg_value_change < 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                  <TrendingDown className="w-3 h-3" />
                  {analytics.avg_value_change}%
                </span>
              ) : analytics.avg_value_change > 0 ? (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                  <TrendingUp className="w-3 h-3" />
                  +{analytics.avg_value_change}%
                </span>
              ) : null}
            </div>
            <p className="text-sm text-gray-600 mb-1">Avg. Booking Value</p>
            <p className="text-3xl font-bold text-gray-900">₱{analytics.avg_booking_value?.toLocaleString() || 0}</p>
            <p className="text-xs text-gray-500 mt-1">vs last period: ₱{analytics.previous_avg_value?.toLocaleString() || 0}</p>
          </div>
        </div>
      )}

      {/* Revenue Trend Chart */}
      {!isLoading && !error && analytics && analytics.revenue_trend && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Revenue Trend</h2>
              <p className="text-sm text-gray-500 mt-1">Revenue over time</p>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-gray-400" />
            </div>
          </div>

          <div className="space-y-3">
            {analytics.revenue_trend.length === 0 ? (
              <p className="text-center text-gray-500 py-8">No revenue data available yet</p>
            ) : (
              analytics.revenue_trend.map((data: any, index: number) => {
                const maxRevenue = Math.max(...analytics.revenue_trend.map((d: any) => d.revenue || d.total_revenue || 0))
                const revenue = data.revenue || data.total_revenue || 0
                const width = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0

                return (
                  <div key={index}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{data.period || data.month || 'N/A'}</span>
                      <span className="text-sm font-semibold text-gray-900">
                        ₱{revenue.toLocaleString()}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-green-500 to-green-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{data.bookings || data.total_bookings || 0} bookings</p>
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {!isLoading && !error && courtPerformance && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Court Performance */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Court Performance</h2>
                <p className="text-sm text-gray-500 mt-1">Utilization and revenue by court</p>
              </div>
              <PieChart className="w-5 h-5 text-gray-400" />
            </div>

            <div className="space-y-4">
              {courtPerformance.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No court performance data available</p>
              ) : (
                courtPerformance.map((court: any, index: number) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">{court.court_name || court.courtName}</h3>
                      <span className="text-sm font-semibold text-green-600">
                        ₱{(court.total_revenue || court.revenue || 0).toLocaleString()}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Bookings</span>
                        <span className="font-medium text-gray-900">{court.total_bookings || court.bookings || 0}</span>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-gray-600">Utilization</span>
                          <span className="font-medium text-gray-900">{court.utilization_rate || court.utilization || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                      <div
                          className={`h-full rounded-full ${
                            (court.utilization_rate || court.utilization) >= 80
                              ? 'bg-green-500'
                              : (court.utilization_rate || court.utilization) >= 60
                              ? 'bg-yellow-500'
                              : 'bg-red-500'
                          }`}
                          style={{ width: `${court.utilization_rate || court.utilization}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))
              )}
            </div>
          </div>

          {/* Peak Hours */}
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Peak Hours</h2>
                <p className="text-sm text-gray-500 mt-1">Booking distribution by hour</p>
              </div>
              <Clock className="w-5 h-5 text-gray-400" />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {peakHours.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No peak hours data available</p>
              ) : (
                peakHours.map((hour: any, index: number) => {
                  const bookingCount = hour.booking_count || hour.bookings || 0
                  const width = maxBookings > 0 ? (bookingCount / maxBookings) * 100 : 0
                  const isPeak = bookingCount > maxBookings * 0.7

                  return (
                    <div key={index} className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-600 w-16">{hour.hour_range || hour.time}</span>
                      <div className="flex-1">
                        <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                          <div
                            className={`h-full rounded-full flex items-center justify-end pr-2 ${
                              isPeak
                                ? 'bg-gradient-to-r from-red-500 to-red-600'
                                : 'bg-gradient-to-r from-blue-500 to-blue-600'
                            }`}
                            style={{ width: `${width}%` }}
                          >
                            {width > 15 && (
                              <span className="text-xs font-semibold text-white">
                                {bookingCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      {width <= 15 && (
                        <span className="text-xs font-semibold text-gray-700 w-8">
                          {bookingCount}
                        </span>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-green-900 mb-1">Revenue Growth</h3>
              <p className="text-sm text-green-700">
                Your revenue has increased by 12.5% this month. Keep up the great work!
              </p>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 mb-1">Peak Hours: 6-9 PM</h3>
              <p className="text-sm text-blue-700">
                Evening hours are your busiest. Consider implementing premium pricing during these times.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Users className="w-5 h-5 text-purple-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-purple-900 mb-1">Customer Retention</h3>
              <p className="text-sm text-purple-700">
                65% of customers are returning players. Focus on retention strategies to boost this further.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
