import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CheckoutStep = 'details' | 'payment' | 'policy' | 'processing' | 'confirmation';
export type PaymentMethod = 'e-wallet' | 'cash' | null;

export interface BookingData {
    courtId: string;
    courtName: string;
    venueId: string;
    venueName: string;
    date: string; // ISO string for mobile
    startTime: string;
    endTime: string;
    hourlyRate: number;
    capacity: number;
    duration: number;
    numPlayers: number;
    notes?: string;
    recurrenceWeeks?: number; // 1 = single, 4 = 4 weeks, etc.
    selectedDays?: number[]; // [0, 2, 4] for Sun, Tue, Thu
}

interface CheckoutState {
    // Booking details
    bookingData: BookingData | null;

    // Current step
    currentStep: CheckoutStep;

    // Payment
    paymentMethod: PaymentMethod;
    policyAccepted: boolean;

    // Discount (if applicable)
    discountAmount: number;
    discountType?: string;
    discountReason?: string;

    // Platform fee
    platformFeePercentage: number;
    platformFeeEnabled: boolean;

    // Confirmation
    bookingReference?: string;
    reservationId?: string;

    // Actions
    setBookingData: (data: BookingData) => void;
    setCurrentStep: (step: CheckoutStep) => void;
    setPaymentMethod: (method: PaymentMethod) => void;
    setPolicyAccepted: (accepted: boolean) => void;
    setDiscount: (amount: number, type?: string, reason?: string) => void;
    setBookingReference: (reference: string, reservationId: string) => void;
    resetCheckout: () => void;

    // Computed values
    getSubtotal: () => number;
    getPlatformFeeAmount: () => number;
    getTotalAmount: () => number;
}

const initialState = {
    bookingData: null,
    currentStep: 'details' as CheckoutStep,
    paymentMethod: null,
    policyAccepted: false,
    discountAmount: 0,
    discountType: undefined,
    discountReason: undefined,
    platformFeePercentage: 5,
    platformFeeEnabled: true,
    bookingReference: undefined,
    reservationId: undefined,
};

export const useCheckoutStore = create<CheckoutState>()(
    persist(
        (set, get) => ({
            ...initialState,

            setBookingData: (data) => {
                set({
                    ...initialState,
                    bookingData: data,
                    currentStep: 'details',
                });
            },

            setCurrentStep: (step) => set({ currentStep: step }),

            setPaymentMethod: (method) => set({ paymentMethod: method }),

            setPolicyAccepted: (accepted) => set({ policyAccepted: accepted }),

            setDiscount: (amount, type, reason) =>
                set({ discountAmount: amount, discountType: type, discountReason: reason }),

            setBookingReference: (reference, reservationId) =>
                set({ bookingReference: reference, reservationId }),

            resetCheckout: () => set(initialState),

            // Computed values
            getSubtotal: () => {
                const state = get();
                const bookingData = state.bookingData;
                if (!bookingData) return 0;

                const recurrenceWeeks = bookingData.recurrenceWeeks || 1;
                const sessionsPerWeek = bookingData.selectedDays?.length || 1;

                // Calculate base price first
                // NOTE: Using duration from bookingData directly as it's pre-calculated on mobile
                const baseRate = bookingData.hourlyRate * bookingData.duration;

                // If discountAmount is total (which seems to be the case from current logic),
                // we should multiply baseRate by recurrence THEN subtract discount.
                // Assuming discount passed is per-session still, we might need adjustments.
                // BUT per current `book.tsx`, discount is calculated once.

                const totalBase = baseRate * recurrenceWeeks * sessionsPerWeek;

                // If discount is set once, we might want to multiply it too if it's per session.
                // However, let's assume discountStore holds the TOTAL discount.
                return Math.max(0, totalBase - state.discountAmount);
            },

            getPlatformFeeAmount: () => {
                const state = get();
                if (!state.platformFeeEnabled) return 0;
                const subtotal = state.getSubtotal();
                return Math.round(subtotal * (state.platformFeePercentage / 100) * 100) / 100;
            },

            getTotalAmount: () => {
                const state = get();
                const subtotal = state.getSubtotal();
                const platformFee = state.getPlatformFeeAmount();
                return Math.round((subtotal + platformFee) * 100) / 100;
            },
        }),
        {
            name: 'rallio-checkout',
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                bookingData: state.bookingData,
            }),
        }
    )
);
