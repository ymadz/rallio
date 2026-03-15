import { Colors } from '@/constants/Colors';

export interface PaymentStatusData {
    label: string;
    color: string;
    bg: string;
    text: string;
    needsPayment: boolean;
}

export interface BookingStatusBadgeData {
    label: string;
    color: string;
    bg: string;
    text: string;
}

// Minimal shape needed to calculate status
export interface ReservationContext {
    status: string;
    amount_paid?: number;
    total_amount: number;
    payment_method?: string;
    payments?: any[]; // optional array of payments attached
    is_fully_paid?: boolean; // computed or given
}

/**
 * Derives a detailed payment status badge to display (e.g., "Paid", "Pay at Venue", "Remaining Balance")
 * Mirroring the exact logic used on the Web app (`getPaymentStatus`).
 */
export function getPaymentStatus(booking: ReservationContext): PaymentStatusData {
    // 1. Explicit payment_failed from any payments record or explicit status
    const hasFailedPayment = booking.payments?.some(p => p.status === 'failed') || booking.status === 'payment_failed';
    if (hasFailedPayment) {
        return {
            label: 'Payment Failed',
            color: Colors.dark.error,
            bg: Colors.dark.error + '25',
            text: Colors.dark.error,
            needsPayment: true,
        };
    }

    // 2. Refunds
    if (booking.status === 'refund_pending') {
        return {
            label: 'Refund Pending',
            color: Colors.dark.info,
            bg: Colors.dark.info + '25',
            text: Colors.dark.info,
            needsPayment: false,
        };
    }
    if (booking.status === 'refunded') {
        return {
            label: 'Refunded',
            color: Colors.dark.textSecondary,
            bg: Colors.dark.surface,
            text: Colors.dark.textSecondary,
            needsPayment: false,
        };
    }

    // Determine fully paid based strictly on numbers or server flags
    const isFullyPaid = booking.is_fully_paid || ((booking.amount_paid || 0) >= booking.total_amount && booking.total_amount > 0);

    // 3. Paid in full (either upfront online or settled later)
    if (isFullyPaid || booking.status === 'paid' || booking.status === 'completed' || (booking.status === 'confirmed' && (booking.amount_paid || 0) >= booking.total_amount)) {
        return {
            label: 'Paid',
            color: Colors.dark.success,
            bg: Colors.dark.success + '25',
            text: Colors.dark.success,
            needsPayment: false,
        };
    }

    // 4. Partially Paid (Cash down payment made, remaining due at venue)
    if (booking.status === 'partially_paid') {
        return {
            label: 'Remaining Balance',
            color: '#F59E0B', // Amber
            bg: '#F59E0B25',
            text: '#F59E0B',
            needsPayment: true, // Needs payment AT VENUE
        };
    }

    // 5. Confirmed but NOT fully paid -> usually means Cash payment (pay later) prior to the mandatory DP rules, 
    //    or a 0 DP booking (now deprecated). We surface as Pay at Venue.
    if (booking.status === 'confirmed') {
        return {
            label: 'Pay at Venue',
            color: Colors.dark.info,
            bg: Colors.dark.info + '25',
            text: Colors.dark.info,
            needsPayment: true,
        };
    }

    // 6. Pending Payment (Checkout interrupted or hasn't paid DP)
    if (booking.status === 'pending_payment') {
        // Did they explicitly choose cash but haven't paid the deposit? Or e-wallet?
        // Let's look at the primary payment method. If unknown, assume standard pending online payment.
        if (booking.payment_method === 'cash') {
            return {
                label: 'Payment Due',
                color: '#F59E0B', // Amber warning for deposit due
                bg: '#F59E0B25',
                text: '#F59E0B',
                needsPayment: true,
            };
        }

        return {
            label: 'Payment Pending',
            color: Colors.dark.warning,
            bg: Colors.dark.warning + '25',
            text: Colors.dark.warning,
            needsPayment: true,
        };
    }

    // 7. Cancelled
    if (booking.status === 'cancelled') {
        return {
            label: 'Void',
            color: Colors.dark.textSecondary,
            bg: Colors.dark.surface,
            text: Colors.dark.textSecondary,
            needsPayment: false,
        };
    }

    // Fallback
    return {
        label: 'Unknown',
        color: Colors.dark.textSecondary,
        bg: Colors.dark.surface,
        text: Colors.dark.textSecondary,
        needsPayment: false,
    };
}

/**
 * Gets the primary booking badge status, mapping specific backend states to user-friendly strings without conflicting with payment status.
 */
export function getBookingStatusBadge(booking: ReservationContext): BookingStatusBadgeData {
    const status = booking.status;

    switch (status) {
        case 'pending_payment':
            // If they chose cash but pending down payment, it's virtually exactly the same as e-wallet pending payment.
            return {
                label: 'Pending Payment',
                color: Colors.dark.warning,
                bg: Colors.dark.warning + '25',
                text: Colors.dark.warning,
            };
        case 'confirmed':
        case 'paid':
        case 'partially_paid':
            return {
                label: 'Confirmed',
                color: Colors.dark.success,
                bg: Colors.dark.success + '25',
                text: Colors.dark.success,
            };
        case 'ongoing':
            return {
                label: 'Ongoing',
                color: Colors.dark.primary,
                bg: Colors.dark.primary + '25',
                text: Colors.dark.primary,
            };
        case 'completed':
            return {
                label: 'Completed',
                color: Colors.dark.info,
                bg: Colors.dark.info + '25',
                text: Colors.dark.info,
            };
        case 'cancelled':
            return {
                label: 'Cancelled',
                color: Colors.dark.error,
                bg: Colors.dark.error + '25',
                text: Colors.dark.error,
            };
        case 'refund_pending':
            return {
                label: 'Refund Requested',
                color: '#F59E0B', // Amber
                bg: '#F59E0B25',
                text: '#F59E0B',
            };
        case 'refunded':
            return {
                label: 'Refunded',
                color: Colors.dark.textSecondary,
                bg: Colors.dark.surface,
                text: Colors.dark.textSecondary,
            };
        case 'payment_failed':
            return {
                label: 'Payment Failed',
                color: Colors.dark.error,
                bg: Colors.dark.error + '25',
                text: Colors.dark.error,
            };
        default:
            return {
                label: status,
                color: Colors.dark.textSecondary,
                bg: Colors.dark.surface,
                text: Colors.dark.textSecondary,
            };
    }
}
