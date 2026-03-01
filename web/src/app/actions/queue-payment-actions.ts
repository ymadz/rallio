'use server'

import { initiatePaymentAction, type InitiatePaymentResult } from './payments'
import { createClient } from '@/lib/supabase/server'

/**
 * Create a PayMongo payment intent for a queue session
 * This is a wrapper around the standard reservation payment flow
 */
export async function createQueuePaymentIntent(
    sessionId: string,
    paymentMethod: 'gcash' | 'paymaya'
): Promise<InitiatePaymentResult> {
    try {
        const supabase = await createClient()

        // Get session to find reservation ID
        const { data: session, error } = await supabase
            .from('queue_sessions')
            .select('metadata, status')
            .eq('id', sessionId)
            .single()

        if (error || !session) {
            return { success: false, error: 'Queue session not found' }
        }

        // Check if session is already paid or active?
        // If status is 'active' or 'open', maybe it's already paid?
        // But we might be retrying.

        const reservationId = session.metadata?.reservation_id

        if (!reservationId) {
            return { success: false, error: 'No booking reservation found for this session' }
        }

        // Initiate payment using the shared payments action
        return await initiatePaymentAction(reservationId, paymentMethod)

    } catch (error: any) {
        console.error('[createQueuePaymentIntent] Error:', error)
        return { success: false, error: error.message || 'Failed to initiate payment' }
    }
}
