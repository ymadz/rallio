import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { mergeCartItems } from '@/lib/utils/booking-cart'

export type CheckoutStep = 'details' | 'payment' | 'policy' | 'processing'
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
    gameFormat: 'singles' | 'doubles' | 'any'
    maxPlayers: number
    costPerGame: number
    isPublic: boolean
    joinWindowHours: number | null
    minEloRating?: number
    maxEloRating?: number
  }
}

export interface BookingCartItem extends BookingData {}

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
  bookingCart: BookingCartItem[]

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

  // Promo Code Discount
  promoDiscountAmount: number
  promoCode?: string
  promoDiscountType?: string
  promoDiscountReason?: string

  // Platform fee
  platformFeePercentage: number
  platformFeeEnabled: boolean

  // Confirmation
  bookingReference?: string
  reservationId?: string
  downPaymentPercentage?: number
  customDownPaymentAmount?: number
  conflictingSlots: Array<{ courtId: string; date: string; startTime: string; endTime: string }>

  // Actions
  setBookingData: (data: BookingData) => void
  setBookingCart: (items: BookingCartItem[]) => void
  addBookingCartItem: (item: BookingCartItem) => void
  removeBookingCartItem: (index: number) => void
  clearBookingCart: () => void
  setCurrentStep: (step: CheckoutStep) => void
  setSplitPayment: (enabled: boolean) => void
  setPlayerCount: (count: number) => void
  setPaymentMethod: (method: PaymentMethod) => void
  setPolicyAccepted: (accepted: boolean) => void
  updatePlayerPayment: (playerNumber: number, updates: Partial<PlayerPaymentStatus>) => void
  setDiscount: (amount: number, code?: string) => void
  setDiscountDetails: (details: { amount: number; type?: string; reason?: string; discounts?: any[] }) => void
  setPromoDiscount: (details: { amount: number; code?: string; type?: string; reason?: string }) => void
  removePromoDiscount: () => void
  setPlatformFee: (percentage: number, enabled: boolean) => void
  setBookingReference: (reference: string, reservationId: string) => void
  setDownPaymentPercentage: (percentage: number) => void
  setCustomDownPaymentAmount: (amount: number | undefined) => void
  setConflictingSlots: (slots: Array<{ courtId: string; date: string; startTime: string; endTime: string }>) => void
  resetCheckout: () => void

  // Computed values
  getSubtotal: () => number
  getPlatformFeeAmount: () => number
  getTotalAmount: () => number
  getDownPaymentAmount: () => number
  getRemainingBalance: () => number
  getPerPlayerAmount: () => number
  getAllPlayersPaid: () => boolean
}

const initialState = {
  bookingData: null,
  bookingCart: [] as BookingCartItem[],
  currentStep: 'details' as CheckoutStep,
  isSplitPayment: false,
  playerCount: 2,
  playerPayments: [],
  paymentMethod: null,
  policyAccepted: false,
  discountAmount: 0,
  discountCode: undefined,
  promoDiscountAmount: 0,
  promoCode: undefined,
  platformFeePercentage: 5, // Default 5%
  platformFeeEnabled: true,
  bookingReference: undefined,
  reservationId: undefined,
  downPaymentPercentage: 20, // Default 20%
  conflictingSlots: [],
}


export const useCheckoutStore = create<CheckoutState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setBookingData: (data) => {
        const state = get()
        set({
          ...initialState,
          bookingData: data,
          bookingCart: [data],
          currentStep: 'details',
          playerCount: Math.min(2, data.capacity), // Default to 2 players or capacity
          downPaymentPercentage: state.downPaymentPercentage, // Preserve existing percentage (e.g. from venue metadata)
        })
      },

      setBookingCart: (items) => {
        const state = get()
        const mergedItems = mergeCartItems(items)
        const firstItem = mergedItems[0] ?? null
        set({
          ...initialState,
          bookingData: firstItem,
          bookingCart: mergedItems,
          currentStep: 'details',
          playerCount: firstItem ? Math.min(2, firstItem.capacity) : 2,
          downPaymentPercentage: state.downPaymentPercentage, // Preserve existing percentage
        })
      },

      addBookingCartItem: (item) => {
        set((state) => {
          const newCart = [...state.bookingCart, item]
          const mergedCart = mergeCartItems(newCart)
          const firstItem = mergedCart[0] ?? null
          return {
            bookingCart: mergedCart,
            bookingData: firstItem,
          }
        })
      },

      removeBookingCartItem: (index) => {
        set((state) => {
          const newCart = state.bookingCart.filter((_, currentIndex) => currentIndex !== index)
          const mergedCart = mergeCartItems(newCart)
          const firstItem = mergedCart[0] ?? null
          return {
            bookingCart: mergedCart,
            bookingData: firstItem,
          }
        })
      },

      clearBookingCart: () => {
        set((state) => ({
          bookingCart: [],
          bookingData: null,
          discountAmount: 0,
          promoDiscountAmount: 0,
          promoCode: undefined,
          applicableDiscounts: undefined,
          discountType: undefined,
          discountReason: undefined,
        }))
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

      setPromoDiscount: (details) => set({
        promoDiscountAmount: details.amount,
        promoCode: details.code,
        promoDiscountType: details.type,
        promoDiscountReason: details.reason
      }),

      removePromoDiscount: () => set({
        promoDiscountAmount: 0,
        promoCode: undefined,
        promoDiscountType: undefined,
        promoDiscountReason: undefined
      }),

      setPlatformFee: (percentage, enabled) => set({
        platformFeePercentage: percentage,
        platformFeeEnabled: enabled
      }),

      setBookingReference: (reference, reservationId) =>
        set({ bookingReference: reference, reservationId }),

      setDownPaymentPercentage: (percentage) => set({ downPaymentPercentage: percentage }),

      setCustomDownPaymentAmount: (amount) => set({ customDownPaymentAmount: amount }),

      setConflictingSlots: (slots) => set({ conflictingSlots: slots }),

      resetCheckout: () => set(initialState),

      // Computed values
      getSubtotal: () => {
        const state = get()
        const effectiveCart = state.bookingCart.length > 0
          ? state.bookingCart
          : (state.bookingData ? [state.bookingData] : [])

        if (effectiveCart.length === 0) return 0

        const totalBase = effectiveCart.reduce((cartTotal, bookingData) => {
          const [startH, startM] = bookingData.startTime.split(':').map(Number)
          const [endH, endM] = bookingData.endTime.split(':').map(Number)
          
          let duration = (endH + (endM || 0) / 60) - (startH + (startM || 0) / 60)
          if (duration <= 0) duration += 24 // Handle overnight bookings

          const recurrenceWeeks = bookingData.recurrenceWeeks || 1
          const selectedDays = bookingData.selectedDays || []

          const baseRate = bookingData.hourlyRate * duration

          const initialStartTime = new Date(bookingData.date)
          initialStartTime.setHours(startH, startM || 0, 0, 0)
          const startDayIndex = initialStartTime.getDay()

          const uniqueSelectedDays = selectedDays.length > 0
            ? Array.from(new Set(selectedDays)).sort((a, b) => a - b)
            : [startDayIndex]

          let actualSlotCount = 0
          for (let i = 0; i < recurrenceWeeks; i++) {
            for (const dayIndex of uniqueSelectedDays) {
              const dayOffset = (dayIndex - startDayIndex + 7) % 7

              const slotStartTime = new Date(initialStartTime.getTime())
              slotStartTime.setDate(slotStartTime.getDate() + (i * 7) + dayOffset)

              // Check if this specific slot is in the conflict list
              const dateStr = slotStartTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
              const isConflicted = state.conflictingSlots.some(c => 
                c.courtId === bookingData.courtId && 
                c.date === dateStr && 
                c.startTime === bookingData.startTime
              )

              if (!isConflicted) {
                actualSlotCount++
              }
            }
          }

          return cartTotal + (baseRate * actualSlotCount)
        }, 0)

        return Math.max(0, totalBase - state.discountAmount - state.promoDiscountAmount)
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

      getDownPaymentAmount: () => {
        const state = get()
        if (state.paymentMethod !== 'cash') return 0
        
        const total = state.getTotalAmount()
        const dpPercent = (state.downPaymentPercentage && state.downPaymentPercentage > 0)
          ? state.downPaymentPercentage
          : 20
        const minimumDownPayment = Math.round((total * (dpPercent / 100)) * 100) / 100
        // If user set a custom amount, use it (clamped between minimum and total)
        if (state.customDownPaymentAmount !== undefined && state.customDownPaymentAmount > 0) {
          const clamped = Math.min(Math.max(state.customDownPaymentAmount, minimumDownPayment), total)
          return Math.round(clamped * 100) / 100
        }
        return minimumDownPayment
      },

      getRemainingBalance: () => {
        const state = get()
        const total = state.getTotalAmount()
        const downPayment = state.getDownPaymentAmount()
        return Math.round((total - downPayment) * 100) / 100
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
        bookingCart: state.bookingCart,
        isSplitPayment: state.isSplitPayment,
        playerCount: state.playerCount,
        customDownPaymentAmount: state.customDownPaymentAmount,
        downPaymentPercentage: state.downPaymentPercentage,
        conflictingSlots: state.conflictingSlots,
        // DO NOT persist paymentMethod - user must select it fresh each time
        // paymentMethod: state.paymentMethod,
      }),
    }
  )
)
