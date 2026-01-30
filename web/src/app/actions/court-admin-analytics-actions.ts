'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Get comprehensive analytics for a venue
 */
export async function getVenueAnalytics(
  venueId: string,
  timeRange: 'week' | 'month' | 'quarter' | 'year' = 'month'
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Verify ownership
    const { data: venue } = await supabase
      .from('venues')
      .select('owner_id, name')
      .eq('id', venueId)
      .single()

    if (!venue || venue.owner_id !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this venue' }
    }

    // Calculate date ranges
    const endDate = new Date()
    const startDate = new Date()
    const previousStartDate = new Date()
    const previousEndDate = new Date()

    switch (timeRange) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7)
        previousEndDate.setDate(previousEndDate.getDate() - 7)
        previousStartDate.setDate(previousStartDate.getDate() - 14)
        break
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1)
        previousEndDate.setMonth(previousEndDate.getMonth() - 1)
        previousStartDate.setMonth(previousStartDate.getMonth() - 2)
        break
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3)
        previousEndDate.setMonth(previousEndDate.getMonth() - 3)
        previousStartDate.setMonth(previousStartDate.getMonth() - 6)
        break
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1)
        previousEndDate.setFullYear(previousEndDate.getFullYear() - 1)
        previousStartDate.setFullYear(previousStartDate.getFullYear() - 2)
        break
    }

    // Get all courts for this venue
    const { data: courts } = await supabase
      .from('courts')
      .select('id')
      .eq('venue_id', venueId)

    const courtIds = courts?.map(c => c.id) || []

    if (courtIds.length === 0) {
      return {
        success: true,
        analytics: {
          totalRevenue: 0,
          totalBookings: 0,
          confirmedBookings: 0,
          cancelledBookings: 0,
          utilizationRate: 0,
          averageBookingValue: 0,
          revenueByDay: [],
          bookingsByStatus: {},
          // Changes
          revenue_change: 0,
          bookings_change: 0,
          customers_change: 0,
          avg_value_change: 0,
          previous_revenue: 0,
          previous_bookings: 0,
          previous_customers: 0,
          previous_avg_value: 0,
          unique_customers: 0,
          total_bookings: 0,
          total_revenue: 0,
          revenue_trend: []
        }
      }
    }

    // Get reservations for the current period
    const { data: currentReservations } = await supabase
      .from('reservations')
      .select('id, user_id, status, total_amount, amount_paid, start_time, end_time, created_at')
      .in('court_id', courtIds)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    // Get reservations for the previous period
    const { data: previousReservations } = await supabase
      .from('reservations')
      .select('id, user_id, status, total_amount, amount_paid')
      .in('court_id', courtIds)
      .gte('created_at', previousStartDate.toISOString())
      .lte('created_at', previousEndDate.toISOString())

    // METRICS - CURRENT PERIOD
    const calculateMetrics = (reservations: any[]) => {
      const allBookings = reservations.length
      const confirmed = reservations.filter(r => r.status === 'confirmed' || r.status === 'completed')
      const revenue = confirmed.reduce((sum, r) => sum + parseFloat(r.amount_paid || '0'), 0)
      const uniqueCustomers = new Set(confirmed.map(r => r.user_id)).size
      const avgValue = confirmed.length > 0 ? revenue / confirmed.length : 0

      return { allBookings, confirmed, revenue, uniqueCustomers, avgValue }
    }

    const current = calculateMetrics(currentReservations || [])
    const previous = calculateMetrics(previousReservations || [])

    // Calculate changes
    const calculateChange = (curr: number, prev: number) => {
      if (prev === 0) return curr > 0 ? 100 : 0
      return Math.round(((curr - prev) / prev) * 100)
    }

    const revenue_change = calculateChange(current.revenue, previous.revenue)
    const bookings_change = calculateChange(current.allBookings, previous.allBookings)
    const customers_change = calculateChange(current.uniqueCustomers, previous.uniqueCustomers)
    const avg_value_change = calculateChange(current.avgValue, previous.avgValue)

    // Calculate utilization rate (based on current period)
    const totalHoursInPeriod = (courts?.length || 0) * 24 * Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const bookedHours = current.confirmed
      .reduce((sum: number, r: any) => {
        const start = new Date(r.start_time)
        const end = new Date(r.end_time)
        return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      }, 0)

    const utilizationRate = totalHoursInPeriod > 0 ? (bookedHours / totalHoursInPeriod) * 100 : 0

    // Revenue by day (for charts)
    const revenueByDay: Record<string, number> = {}
    current.confirmed.forEach((r: any) => {
      const day = new Date(r.created_at).toISOString().split('T')[0]
      revenueByDay[day] = (revenueByDay[day] || 0) + parseFloat(r.amount_paid || '0')
    })

    // Bookings by status
    const bookingsByStatus: Record<string, number> = {}
    currentReservations?.forEach(r => {
      bookingsByStatus[r.status] = (bookingsByStatus[r.status] || 0) + 1
    })

    // Revenue Trend (Grouped data for the charts)
    const revenue_trend = []

    if (timeRange === 'year') {
      // Group by Month (Last 12 months)
      const monthData: Record<string, { revenue: number, bookings: number, label: string }> = {}

      // Initialize last 12 months
      for (let i = 0; i < 12; i++) {
        const d = new Date()
        d.setMonth(d.getMonth() - i)
        const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`
        const label = d.toLocaleString('default', { month: 'short', year: '2-digit' })
        monthData[key] = { revenue: 0, bookings: 0, label }
      }

      current.confirmed.forEach((r: any) => {
        const date = new Date(r.created_at)
        const key = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`
        if (monthData[key]) {
          monthData[key].revenue += parseFloat(r.amount_paid || '0')
          monthData[key].bookings += 1
        }
      })

      Object.keys(monthData).sort().forEach(key => {
        revenue_trend.push({
          period: monthData[key].label,
          revenue: Math.round(monthData[key].revenue * 100) / 100,
          bookings: monthData[key].bookings
        })
      })
    } else if (timeRange === 'month' || timeRange === 'quarter') {
      // Group by Week
      const weekData: Record<string, { revenue: number, bookings: number, label: string }> = {}

      const numDays = (timeRange === 'month' ? 30 : 90)
      const segments = (timeRange === 'month' ? 4 : 12) // roughly weekly
      const daysPerSegment = Math.ceil(numDays / segments)

      for (let i = 0; i < segments; i++) {
        const segEnd = new Date()
        segEnd.setDate(segEnd.getDate() - (i * daysPerSegment))
        const segStart = new Date(segEnd)
        segStart.setDate(segStart.getDate() - daysPerSegment + 1)

        const key = `seg-${i}`
        const label = `${segStart.toLocaleString('default', { month: 'short', day: 'numeric' })} - ${segEnd.toLocaleString('default', { month: 'short', day: 'numeric' })}`
        weekData[key] = { revenue: 0, bookings: 0, label }

        current.confirmed.forEach((r: any) => {
          const rDate = new Date(r.created_at)
          if (rDate >= segStart && rDate <= segEnd) {
            weekData[key].revenue += parseFloat(r.amount_paid || '0')
            weekData[key].bookings += 1
          }
        })
      }

      Object.keys(weekData).sort((a, b) => parseInt(b.split('-')[1]) - parseInt(a.split('-')[1])).forEach(key => {
        revenue_trend.push({
          period: weekData[key].label,
          revenue: Math.round(weekData[key].revenue * 100) / 100,
          bookings: weekData[key].bookings
        })
      })
    } else {
      // Daily for week
      const dayIterator = new Date(startDate)
      while (dayIterator <= endDate) {
        const dayStr = dayIterator.toISOString().split('T')[0]
        const revenue = revenueByDay[dayStr] || 0
        const dailyBookings = current.confirmed.filter((r: any) =>
          new Date(r.created_at).toISOString().split('T')[0] === dayStr
        ).length

        revenue_trend.push({
          period: dayIterator.toLocaleString('default', { weekday: 'short', month: 'short', day: 'numeric' }),
          revenue: Math.round(revenue * 100) / 100,
          bookings: dailyBookings
        })
        dayIterator.setDate(dayIterator.getDate() + 1)
      }
    }

    return {
      success: true,
      analytics: {
        totalRevenue: Math.round(current.revenue * 100) / 100,
        total_revenue: Math.round(current.revenue * 100) / 100, // Frontend alias
        totalBookings: current.allBookings,
        total_bookings: current.allBookings, // Frontend alias
        confirmedBookings: current.confirmed.length,
        cancelledBookings: (currentReservations?.length || 0) - current.confirmed.length, // Approx
        utilizationRate: Math.round(utilizationRate * 10) / 10,
        averageBookingValue: Math.round(current.avgValue * 100) / 100,
        avg_booking_value: Math.round(current.avgValue * 100) / 100, // Frontend alias
        revenueByDay: Object.entries(revenueByDay).map(([date, revenue]) => ({
          date,
          revenue: Math.round(revenue * 100) / 100
        })),
        bookingsByStatus,
        revenue_trend,

        // Historical / Comparisons
        previous_revenue: Math.round(previous.revenue * 100) / 100,
        revenue_change,

        previous_bookings: previous.allBookings,
        bookings_change,

        unique_customers: current.uniqueCustomers,
        previous_customers: previous.uniqueCustomers,
        customers_change,

        previous_avg_value: Math.round(previous.avgValue * 100) / 100,
        avg_value_change
      }
    }
  } catch (error: any) {
    console.error('Error fetching venue analytics:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get per-court performance metrics
 */
export async function getCourtPerformance(venueId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Verify ownership
    const { data: venue } = await supabase
      .from('venues')
      .select('owner_id')
      .eq('id', venueId)
      .single()

    if (!venue || venue.owner_id !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this venue' }
    }

    // Get courts with reservation counts and revenue
    const { data: courts } = await supabase
      .from('courts')
      .select(`
        id,
        name,
        hourly_rate,
        is_active
      `)
      .eq('venue_id', venueId)

    if (!courts || courts.length === 0) {
      return { success: true, performance: [] }
    }

    // Get last 30 days of reservations for each court
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: reservations } = await supabase
      .from('reservations')
      .select('court_id, status, amount_paid, start_time, end_time')
      .in('court_id', courts.map(c => c.id))
      .gte('created_at', thirtyDaysAgo.toISOString())

    // Calculate per-court metrics
    const performance = courts.map(court => {
      const courtReservations = reservations?.filter(r => r.court_id === court.id) || []
      const confirmedReservations = courtReservations.filter(
        r => r.status === 'confirmed' || r.status === 'completed'
      )

      const revenue = confirmedReservations.reduce(
        (sum, r) => sum + parseFloat(r.amount_paid || '0'),
        0
      )

      const bookedHours = confirmedReservations.reduce((sum, r) => {
        const start = new Date(r.start_time)
        const end = new Date(r.end_time)
        return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      }, 0)

      // Utilization: hours booked / (30 days * 12 operating hours per day)
      const totalAvailableHours = 30 * 12 // Assuming 12 hours/day operation
      const utilizationRate = totalAvailableHours > 0 ? (bookedHours / totalAvailableHours) * 100 : 0

      return {
        courtId: court.id,
        courtName: court.name,
        hourlyRate: court.hourly_rate,
        isActive: court.is_active,
        bookings: courtReservations.length,
        total_bookings: courtReservations.length,
        confirmedBookings: confirmedReservations.length,
        revenue: Math.round(revenue * 100) / 100,
        total_revenue: Math.round(revenue * 100) / 100,
        bookedHours: Math.round(bookedHours * 10) / 10,
        utilizationRate: Math.round(utilizationRate * 10) / 10,
        utilization: Math.round(utilizationRate * 10) / 10
      }
    })

    // Sort by revenue descending
    performance.sort((a, b) => b.revenue - a.revenue)

    return { success: true, performance }
  } catch (error: any) {
    console.error('Error fetching court performance:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get peak hours analysis (hourly booking distribution)
 */
export async function getPeakHours(venueId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Verify ownership
    const { data: venue } = await supabase
      .from('venues')
      .select('owner_id')
      .eq('id', venueId)
      .single()

    if (!venue || venue.owner_id !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this venue' }
    }

    // Get courts for this venue
    const { data: courts } = await supabase
      .from('courts')
      .select('id')
      .eq('venue_id', venueId)

    const courtIds = courts?.map(c => c.id) || []

    if (courtIds.length === 0) {
      return { success: true, peakHours: [] }
    }

    // Get last 30 days of confirmed reservations
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: reservations } = await supabase
      .from('reservations')
      .select('start_time, end_time')
      .in('court_id', courtIds)
      .in('status', ['confirmed', 'completed'])
      .gte('created_at', thirtyDaysAgo.toISOString())

    // Count bookings by hour (0-23)
    const hourlyDistribution: Record<number, number> = {}
    for (let i = 0; i < 24; i++) {
      hourlyDistribution[i] = 0
    }

    reservations?.forEach(r => {
      const startHour = new Date(r.start_time).getHours()
      const endHour = new Date(r.end_time).getHours()

      // Increment count for each hour the reservation spans
      for (let hour = startHour; hour < endHour; hour++) {
        hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1
      }
    })

    // Convert to array format for charts
    const peakHours = Object.entries(hourlyDistribution).map(([hour, count]) => ({
      hour: parseInt(hour),
      hourLabel: `${hour.padStart(2, '0')}:00`,
      time: `${hour.padStart(2, '0')}:00`,
      bookings: count
    }))

    return { success: true, peakHours }
  } catch (error: any) {
    console.error('Error fetching peak hours:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get revenue comparison (month-over-month)
 */
export async function getRevenueComparison(venueId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  try {
    // Verify ownership
    const { data: venue } = await supabase
      .from('venues')
      .select('owner_id')
      .eq('id', venueId)
      .single()

    if (!venue || venue.owner_id !== user.id) {
      return { success: false, error: 'Unauthorized - You do not own this venue' }
    }

    // Get courts
    const { data: courts } = await supabase
      .from('courts')
      .select('id')
      .eq('venue_id', venueId)

    const courtIds = courts?.map(c => c.id) || []

    // This month
    const now = new Date()
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    // Last month
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)

    // Get this month's revenue
    const { data: thisMonthReservations } = await supabase
      .from('reservations')
      .select('amount_paid')
      .in('court_id', courtIds)
      .in('status', ['confirmed', 'completed'])
      .gte('created_at', thisMonthStart.toISOString())
      .lte('created_at', thisMonthEnd.toISOString())

    // Get last month's revenue
    const { data: lastMonthReservations } = await supabase
      .from('reservations')
      .select('amount_paid')
      .in('court_id', courtIds)
      .in('status', ['confirmed', 'completed'])
      .gte('created_at', lastMonthStart.toISOString())
      .lte('created_at', lastMonthEnd.toISOString())

    const thisMonthRevenue = thisMonthReservations?.reduce(
      (sum, r) => sum + parseFloat(r.amount_paid || '0'),
      0
    ) || 0

    const lastMonthRevenue = lastMonthReservations?.reduce(
      (sum, r) => sum + parseFloat(r.amount_paid || '0'),
      0
    ) || 0

    const percentageChange = lastMonthRevenue > 0
      ? ((thisMonthRevenue - lastMonthRevenue) / lastMonthRevenue) * 100
      : 0

    return {
      success: true,
      comparison: {
        thisMonth: Math.round(thisMonthRevenue * 100) / 100,
        lastMonth: Math.round(lastMonthRevenue * 100) / 100,
        percentageChange: Math.round(percentageChange * 10) / 10,
        trend: percentageChange > 0 ? 'up' : percentageChange < 0 ? 'down' : 'stable'
      }
    }
  } catch (error: any) {
    console.error('Error fetching revenue comparison:', error)
    return { success: false, error: error.message }
  }
}
