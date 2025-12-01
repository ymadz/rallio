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

    // Calculate date range
    const endDate = new Date()
    const startDate = new Date()
    switch (timeRange) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7)
        break
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1)
        break
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3)
        break
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1)
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
        }
      }
    }

    // Get reservations for the time period
    const { data: reservations } = await supabase
      .from('reservations')
      .select('id, status, total_amount, amount_paid, start_time, end_time, created_at')
      .in('court_id', courtIds)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())

    // Calculate metrics
    const totalBookings = reservations?.length || 0
    const confirmedBookings = reservations?.filter(r => r.status === 'confirmed' || r.status === 'completed').length || 0
    const cancelledBookings = reservations?.filter(r => r.status === 'cancelled').length || 0
    const totalRevenue = reservations
      ?.filter(r => r.status === 'confirmed' || r.status === 'completed')
      .reduce((sum, r) => sum + parseFloat(r.amount_paid || '0'), 0) || 0

    const averageBookingValue = confirmedBookings > 0 ? totalRevenue / confirmedBookings : 0

    // Calculate utilization rate (hours booked / total available hours)
    const totalHoursInPeriod = (courts?.length || 0) * 24 * Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    const bookedHours = reservations
      ?.filter(r => r.status === 'confirmed' || r.status === 'completed')
      .reduce((sum, r) => {
        const start = new Date(r.start_time)
        const end = new Date(r.end_time)
        return sum + (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      }, 0) || 0

    const utilizationRate = totalHoursInPeriod > 0 ? (bookedHours / totalHoursInPeriod) * 100 : 0

    // Revenue by day (for charts)
    const revenueByDay: Record<string, number> = {}
    reservations
      ?.filter(r => r.status === 'confirmed' || r.status === 'completed')
      .forEach(r => {
        const day = new Date(r.created_at).toISOString().split('T')[0]
        revenueByDay[day] = (revenueByDay[day] || 0) + parseFloat(r.amount_paid || '0')
      })

    // Bookings by status
    const bookingsByStatus: Record<string, number> = {}
    reservations?.forEach(r => {
      bookingsByStatus[r.status] = (bookingsByStatus[r.status] || 0) + 1
    })

    return {
      success: true,
      analytics: {
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalBookings,
        confirmedBookings,
        cancelledBookings,
        utilizationRate: Math.round(utilizationRate * 10) / 10,
        averageBookingValue: Math.round(averageBookingValue * 100) / 100,
        revenueByDay: Object.entries(revenueByDay).map(([date, revenue]) => ({
          date,
          revenue: Math.round(revenue * 100) / 100
        })),
        bookingsByStatus,
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
      const utilizationRate = (bookedHours / totalAvailableHours) * 100

      return {
        courtId: court.id,
        courtName: court.name,
        hourlyRate: court.hourly_rate,
        isActive: court.is_active,
        bookings: courtReservations.length,
        confirmedBookings: confirmedReservations.length,
        revenue: Math.round(revenue * 100) / 100,
        bookedHours: Math.round(bookedHours * 10) / 10,
        utilizationRate: Math.round(utilizationRate * 10) / 10,
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
