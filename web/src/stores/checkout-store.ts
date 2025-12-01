import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type CheckoutStep = 'details' | 'payment' | 'policy' | 'processing' | 'confirmation'
export type PaymentMethod = 'e-wallet' | 'cash' | null

export interface BookingData {
  courtId: string
  courtName: string
  venueId: string
  venueName: string
  date: Date
  startTime: string
  endTime: string
  hourlyRate: number
  capacity: number
}

export interface PlayerPaymentStatus {
  playerNumber: number
  email?: string
  amountDue: number
  status: 'pending' | 'paid' | 'failed'
  paymentReference?: string
  qrCodeUrl?: string
  paidAt?: Date
}

interface CheckoutState {
  // Booking details
  bookingData: BookingData | null

  // Current step
  currentStep: CheckoutStep

  // Split payment
  isSplitPayment: boolean
  playerCount: number
  playerPayments: PlayerPaymentStatus[]

  // Payment
  paymentMethod: PaymentMethod
  policyAccepted: boolean

  // Discount (if applicable)
  discountAmount: number
  discountCode?: string
  discountType?: string
  discountReason?: string
  applicableDiscounts?: Array<{
    type: string
    name: string
    description: string
    amount: number
    isIncrease: boolean
  }>

  // Platform fee
  platformFeePercentage: number
  platformFeeEnabled: boolean

  // Confirmation
  bookingReference?: string
  reservationId?: string

  // Actions
  setBookingData: (data: BookingData) => void
  setCurrentStep: (step: CheckoutStep) => void
  setSplitPayment: (enabled: boolean) => void
  setPlayerCount: (count: number) => void
  setPaymentMethod: (method: PaymentMethod) => void
  setPolicyAccepted: (accepted: boolean) => void
  updatePlayerPayment: (playerNumber: number, updates: Partial<PlayerPaymentStatus>) => void
  setDiscount: (amount: number, code?: string) => void
  setDiscountDetails: (details: { amount: number; type?: string; reason?: string; discounts?: any[] }) => void
  setPlatformFee: (percentage: number, enabled: boolean) => void
  setBookingReference: (reference: string, reservationId: string) => void
  resetCheckout: () => void

  // Computed values
  getSubtotal: () => number
  getPlatformFeeAmount: () => number
  getTotalAmount: () => number
  getPerPlayerAmount: () => number
  getAllPlayersPaid: () => boolean
}

const initialState = {
  bookingData: null,
  currentStep: 'details' as CheckoutStep,
  isSplitPayment: false,
  playerCount: 2,
  playerPayments: [],
  paymentMethod: null,
  policyAccepted: false,
  discountAmount: 0,
  discountCode: undefined,
  platformFeePercentage: 5, // Default 5%
  platformFeeEnabled: true,
  bookingReference: undefined,
  reservationId: undefined,
}

export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setBookingData: (data) => {
        set({
          ...initialState,
          bookingData: data,
          currentStep: 'details',
          playerCount: Math.min(2, data.capacity), // Default to 2 players or capacity
        })
      },

      setCurrentStep: (step) => set({ currentStep: step }),

      setSplitPayment: (enabled) => {
        const state = get()
        if (enabled) {
          // Initialize player payments when split payment is enabled
          const perPlayerAmount = state.getPerPlayerAmount()
          const players: PlayerPaymentStatus[] = Array.from(
            { length: state.playerCount },
            (_, i) => ({
              playerNumber: i + 1,
              amountDue: perPlayerAmount,
              status: 'pending' as const,
            })
          )
          set({
            isSplitPayment: true,
            playerPayments: players
          })
        } else {
          set({
            isSplitPayment: false,
            playerPayments: []
          })
        }
      },

      setPlayerCount: (count) => {
        const state = get()
        const capacity = state.bookingData?.capacity || 4
        const validCount = Math.max(2, Math.min(count, capacity))

        if (state.isSplitPayment) {
          // Update player payments array
          const perPlayerAmount = state.getTotalAmount() / validCount
          const players: PlayerPaymentStatus[] = Array.from(
            { length: validCount },
            (_, i) => ({
              ...(state.playerPayments[i] || {}), // Preserve existing data if available
              playerNumber: i + 1,
              amountDue: perPlayerAmount,
              status: state.playerPayments[i]?.status || ('pending' as const),
            })
          )
          set({ playerCount: validCount, playerPayments: players })
        } else {
          set({ playerCount: validCount })
        }
      },

      setPaymentMethod: (method) => set({ paymentMethod: method }),

      setPolicyAccepted: (accepted) => set({ policyAccepted: accepted }),

      updatePlayerPayment: (playerNumber, updates) => {
        set((state) => ({
          playerPayments: state.playerPayments.map((payment) =>
            payment.playerNumber === playerNumber
              ? { ...payment, ...updates }
              : payment
          ),
        }))
      },

      setDiscount: (amount, code) => set({ discountAmount: amount, discountCode: code }),

      setDiscountDetails: (details) => set({
        discountAmount: details.amount,
        discountType: details.type,
        discountReason: details.reason,
        applicableDiscounts: details.discounts
      }),

      setPlatformFee: (percentage, enabled) => set({
        platformFeePercentage: percentage,
        platformFeeEnabled: enabled
      }),

      setBookingReference: (reference, reservationId) =>
        set({ bookingReference: reference, reservationId }),

      resetCheckout: () => set(initialState),

      // Computed values
      getSubtotal: () => {
        const state = get()
        const bookingData = state.bookingData
        if (!bookingData) return 0
        
        // Calculate duration in hours from startTime and endTime
        const startHour = parseInt(bookingData.startTime.split(':')[0])
        const endHour = parseInt(bookingData.endTime.split(':')[0])
        const duration = endHour - startHour
        
        const baseRate = bookingData.hourlyRate * duration
        // Apply discount to subtotal
        return Math.max(0, baseRate - state.discountAmount)
      },

      getPlatformFeeAmount: () => {
        const state = get()
        if (!state.platformFeeEnabled) return 0
        const subtotal = state.getSubtotal()
        return Math.round((subtotal * (state.platformFeePercentage / 100)) * 100) / 100
      },

      getTotalAmount: () => {
        const state = get()
        const subtotal = state.getSubtotal()
        const platformFee = state.getPlatformFeeAmount()
        return Math.round((subtotal + platformFee) * 100) / 100
      },

      getPerPlayerAmount: () => {
        const state = get()
        if (!state.isSplitPayment) return state.getTotalAmount()
        return Math.round((state.getTotalAmount() / state.playerCount) * 100) / 100
      },

      getAllPlayersPaid: () => {
        const state = get()
        if (!state.isSplitPayment) return true
        return state.playerPayments.every((p) => p.status === 'paid')
      },
    }),
    {
      name: 'checkout-storage',
      partialize: (state) => ({
        bookingData: state.bookingData,
        isSplitPayment: state.isSplitPayment,
        playerCount: state.playerCount,
        // DO NOT persist paymentMethod - user must select it fresh each time
        // paymentMethod: state.paymentMethod,
      }),
    }
  )
)
