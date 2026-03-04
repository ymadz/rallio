import { differenceInDays, addDays, isSameDay, startOfDay } from 'date-fns'

export interface PaymentInstallment {
  id: string
  date: string // ISO date
  amount: number
  status: 'pending' | 'paid'
  paidAt?: string
  paymentId?: string
}

export interface PaymentPlan {
  totalAmount: number
  initialPayment: number
  remainingBalance: number
  startDate: string
  bookingDate: string
  installments: PaymentInstallment[]
}

/**
 * Generates a daily payment plan for a booking.
 * Divides the remaining balance by the number of days between the initial payment and the booking.
 */
export function generatePaymentPlan(
  totalAmount: number,
  initialPayment: number,
  bookingDate: Date,
  startDate: Date = new Date()
): PaymentPlan {
  const remainingBalance = Math.max(0, totalAmount - initialPayment)
  const normalizedStart = startOfDay(startDate)
  const normalizedBooking = startOfDay(bookingDate)
  
  // Number of days between now (exclusive) and the booking (inclusive)
  // Example: Today is March 1, Booking is March 20. 
  // differenceInDays(Mar 20, Mar 1) = 19.
  // Installments for Mar 2, 3, ..., 20.
  const daysCount = differenceInDays(normalizedBooking, normalizedStart)
  
  const installments: PaymentInstallment[] = []
  
  if (daysCount > 0 && remainingBalance > 0) {
    const dailyAmount = Math.floor((remainingBalance / daysCount) * 100) / 100
    let distributedAmount = 0
    
    for (let i = 1; i <= daysCount; i++) {
      const installmentDate = addDays(normalizedStart, i)
      
      // For the last one, use the remainder to handle rounding issues
      const isLast = i === daysCount
      const amount = isLast ? Math.round((remainingBalance - distributedAmount) * 100) / 100 : dailyAmount
      
      installments.push({
        id: crypto.randomUUID(),
        date: installmentDate.toISOString(),
        amount,
        status: 'pending'
      })
      
      distributedAmount += amount
    }
  } else if (remainingBalance > 0) {
    // If it's same day or no days left, just one installment
    installments.push({
      id: crypto.randomUUID(),
      date: normalizedBooking.toISOString(),
      amount: remainingBalance,
      status: 'pending'
    })
  }

  return {
    totalAmount,
    initialPayment,
    remainingBalance,
    startDate: normalizedStart.toISOString(),
    bookingDate: normalizedBooking.toISOString(),
    installments
  }
}
