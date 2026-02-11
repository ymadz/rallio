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
  recurrenceWeeks?: number // 1 = single booking, 4 = 4 weeks, etc.
  selectedDays?: number[] // Array of day indices (0-6) for multi-day booking
  isQueueSession?: boolean
  queueSessionData?: {
    mode: 'casual' | 'competitive'
    gameFormat: 'singles' | 'doubles' | 'mixed'
    maxPlayers: number
    costPerGame: number
    isPublic: boolean
  }
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
        const recurrenceWeeks = bookingData.recurrenceWeeks || 1
        const selectedDays = bookingData.selectedDays || []

        const baseRate = bookingData.hourlyRate * duration

        // Calculate ACTUAL future slots that will be created (matching reservations.ts logic)
        const initialStartTime = new Date(bookingData.date)
        const [startH, startM] = bookingData.startTime.split(':')
        initialStartTime.setHours(parseInt(startH), parseInt(startM || '0'), 0, 0)
        const startDayIndex = initialStartTime.getDay()

        // Deduplicate selected days
        const uniqueSelectedDays = selectedDays.length > 0
          ? Array.from(new Set(selectedDays)).sort((a, b) => a - b)
          : [startDayIndex]

        // Count only FUTURE slots (matching reservation service skip logic)
        let actualSlotCount = 0
        for (let i = 0; i < recurrenceWeeks; i++) {
          const weekBaseTime = initialStartTime.getTime() + (i * 7 * 24 * 60 * 60 * 1000)
          
          for (const dayIndex of uniqueSelectedDays) {
            const dayOffset = dayIndex - startDayIndex
            const slotStartTime = new Date(weekBaseTime + (dayOffset * 24 * 60 * 60 * 1000))
            
            // Skip past dates (matches reservation service logic)
            if (slotStartTime.getTime() < initialStartTime.getTime()) {
              continue
            }
            
            actualSlotCount++
          }
        }

        // Calculate total based on ACTUAL slots that will be created
        const totalBase = baseRate * actualSlotCount
        return Math.max(0, totalBase - state.discountAmount)
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
