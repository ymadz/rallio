/**
 * Bookings and reservations service - mobile
 * Handles creating bookings, viewing history, cancellation
 */

import { supabase } from './supabase';

export type CreateBookingData = {
  courtId: string;
  startTime: string;
  endTime: string;
  notes?: string;
};

/**
 * Create a new booking (reservation + payment)
 */
export async function createBooking(userId: string, data: CreateBookingData) {
  const { courtId, startTime, endTime, notes } = data;

  // 1. Calculate total amount
  const court = await supabase
    .from('courts')
    .select('price_per_hour, venue:venues(id, name)')
    .eq('id', courtId)
    .single();

  if (court.error) throw court.error;
  if (!court.data) throw new Error('Court not found');

  const durationHours =
    (new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60 * 60);
  const totalAmount = court.data.price_per_hour * durationHours;

  // 2. Create reservation
  const { data: reservation, error: reservationError } = await supabase
    .from('reservations')
    .insert({
      user_id: userId,
      court_id: courtId,
      start_time: startTime,
      end_time: endTime,
      status: 'pending',
      total_amount: totalAmount,
      notes,
    })
    .select()
    .single();

  if (reservationError) throw reservationError;

  // 3. Create payment record
  const { data: payment, error: paymentError } = await supabase
    .from('payments')
    .insert({
      reservation_id: reservation.id,
      user_id: userId,
      amount: totalAmount,
      payment_method: 'gcash', // Default, can be changed later
      status: 'pending',
    })
    .select()
    .single();

  if (paymentError) throw paymentError;

  return {
    reservation,
    payment,
  };
}

/**
 * Get user's bookings (reservations)
 */
export async function getUserBookings(userId: string, status?: string) {
  let query = supabase
    .from('reservations')
    .select(`
      *,
      court:courts (
        *,
        venue:venues (
          id,
          name,
          address,
          phone_number
        )
      ),
      payments (
        id,
        amount,
        payment_method,
        status,
        paymongo_source_id,
        created_at
      )
    `)
    .eq('user_id', userId)
    .order('start_time', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Get booking by ID
 */
export async function getBookingById(reservationId: string) {
  const { data, error } = await supabase
    .from('reservations')
    .select(`
      *,
      court:courts (
        *,
        venue:venues (
          *,
          operating_hours (
            id,
            day_of_week,
            open_time,
            close_time
          )
        )
      ),
      payments (
        *
      )
    `)
    .eq('id', reservationId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Cancel booking
 * Only allowed if reservation is pending or confirmed, and payment is pending
 */
export async function cancelBooking(reservationId: string, userId: string) {
  // 1. Get reservation
  const { data: reservation, error: fetchError } = await supabase
    .from('reservations')
    .select('*, payments (*)')
    .eq('id', reservationId)
    .eq('user_id', userId)
    .single();

  if (fetchError) throw fetchError;

  // 2. Check if cancellation is allowed
  if (!['pending', 'confirmed'].includes(reservation.status)) {
    throw new Error('Cannot cancel this booking');
  }

  const payment = reservation.payments?.[0];
  if (payment?.status === 'completed') {
    throw new Error('Cannot cancel a completed payment. Please request a refund.');
  }

  // 3. Update reservation status
  const { error: updateError } = await supabase
    .from('reservations')
    .update({
      status: 'cancelled',
      updated_at: new Date().toISOString(),
    })
    .eq('id', reservationId);

  if (updateError) throw updateError;

  // 4. Update payment status
  if (payment) {
    await supabase
      .from('payments')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment.id);
  }
}

/**
 * Get upcoming bookings
 */
export async function getUpcomingBookings(userId: string) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('reservations')
    .select(`
      *,
      court:courts (
        court_number,
        venue:venues (
          name,
          address
        )
      )
    `)
    .eq('user_id', userId)
    .in('status', ['pending', 'confirmed'])
    .gte('start_time', now)
    .order('start_time', { ascending: true })
    .limit(5);

  if (error) throw error;
  return data;
}

/**
 * Get booking statistics for user
 */
export async function getBookingStats(userId: string) {
  const { data, error } = await supabase
    .from('reservations')
    .select('status, total_amount')
    .eq('user_id', userId);

  if (error) throw error;

  const stats = {
    total: data.length,
    completed: data.filter((r) => r.status === 'completed').length,
    cancelled: data.filter((r) => r.status === 'cancelled').length,
    pending: data.filter((r) => r.status === 'pending').length,
    totalSpent: data
      .filter((r) => r.status === 'completed')
      .reduce((sum, r) => sum + r.total_amount, 0),
  };

  return stats;
}
