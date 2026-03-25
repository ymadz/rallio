'use client'

import { useState, useEffect } from 'react'
import { format, differenceInHours } from 'date-fns'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { DayPicker } from 'react-day-picker'
import 'react-day-picker/dist/style.css'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { getAvailableTimeSlotsAction } from '@/app/actions/reservations'
import { rescheduleReservationAction } from '@/app/actions/reschedule-actions'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

interface TimeSlot {
    time: string
    available: boolean
    price?: number
}

interface RescheduleModalProps {
    booking: {
        id: string
        start_time: string
        end_time: string
        courts: {
            id: string
            name: string
            hourly_rate: number
        }
    }
    isOpen: boolean
    onClose: () => void
    onSuccess: () => void
}

export function RescheduleModal({ booking, isOpen, onClose, onSuccess }: RescheduleModalProps) {
    const { toast } = useToast()
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
    const [selectedTime, setSelectedTime] = useState<string | undefined>(undefined)
    const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([])
    const [isLoadingSlots, setIsLoadingSlots] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Calculate duration from existing booking
    const startDate = new Date(booking.start_time)
    const endDate = new Date(booking.end_time)
    const duration = differenceInHours(endDate, startDate) || 1

    // Reset state when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setSelectedDate(undefined)
            setSelectedTime(undefined)
            setTimeSlots([])
            setError(null)
        }
    }, [isOpen])

    // Fetch slots when date changes
    useEffect(() => {
        if (!selectedDate) {
            setTimeSlots([])
            return
        }

        const fetchSlots = async () => {
            setIsLoadingSlots(true)
            setError(null)
            setSelectedTime(undefined)

            try {
                const slots = await getAvailableTimeSlotsAction(
                    booking.courts.id,
                    format(selectedDate, 'yyyy-MM-dd'),
                    booking.id // Exclude current booking from conflict check
                )
                setTimeSlots(slots)
            } catch (err) {
                console.error('Error fetching slots:', err)
                setError('Failed to load available time slots')
            } finally {
                setIsLoadingSlots(false)
            }
        }

        fetchSlots()
    }, [selectedDate, booking.courts.id, booking.id])

    const handleConfirm = async () => {
        if (!selectedDate || !selectedTime) return

        setIsSubmitting(true)
        setError(null)

        try {
            let result;
            if ((booking as any).type === 'queue_session' && (booking as any).queue_session_id) {
                const { rescheduleQueueSessionAction } = await import('@/app/actions/queue-actions')
                result = await rescheduleQueueSessionAction((booking as any).queue_session_id, selectedDate, selectedTime)
            } else {
                result = await rescheduleReservationAction(booking.id, selectedDate, selectedTime)
            }

            if (result.success) {
                toast({
                    title: 'Success',
                    description: 'Reschedule request submitted — pending admin approval',
                    variant: 'default',
                })
                onSuccess()
                onClose()
            } else {
                setError(result.error || 'Failed to reschedule booking')
                toast({
                    title: 'Reschedule Failed',
                    description: result.error || 'Failed to reschedule booking',
                    variant: 'destructive',
                })
            }
        } catch (err) {
            console.error('Error rescheduling:', err)
            setError('An unexpected error occurred')
            toast({
                title: 'Error',
                description: 'An unexpected error occurred',
                variant: 'destructive',
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    // --- Helpers for rendering the time slots list mimicking availability-modal ---

    const formatTimeStr = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number)
        const period = hours >= 12 ? 'PM' : 'AM'
        const displayHours = hours % 12 || 12
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`
    }

    const getNextHourStr = (time: string) => {
        const [hours, minutes] = time.split(':').map(Number)
        const nextHour = hours + 1
        return `${nextHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    }

    // Check if `duration` hours are available starting from `startTime`
    const isDurationAvailable = (startTime: string): boolean => {
        const startIndex = timeSlots.findIndex(s => s.time === startTime)
        if (startIndex === -1) return false

        // Need to check if there are enough slots ahead sequentially and all available
        for (let i = 0; i < duration; i++) {
            const slotIndex = startIndex + i
            if (slotIndex >= timeSlots.length) return false
            if (!timeSlots[slotIndex].available) return false
        }
        return true
    }

    const disabledDays = { before: new Date() }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="inset-0 translate-x-0 translate-y-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 w-screen h-[100dvh] max-w-none max-h-none p-0 overflow-hidden border-0 bg-white rounded-none shadow-2xl [&>button]:hidden flex flex-col sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%] sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:max-w-4xl sm:h-auto sm:max-h-[90vh] sm:rounded-2xl">
                <VisuallyHidden>
                    <DialogTitle>Reschedule Booking</DialogTitle>
                </VisuallyHidden>
                {/* Header matching availability modal */}
                <div className="bg-gradient-to-r from-primary to-primary/80 text-white px-6 py-4 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-xl font-bold">{booking.courts.name}</h3>
                        <p className="text-sm text-white/80 mt-1">Select time range</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors focus:outline-none"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Left Column: Calendar */}
                        <div>
                            <h4 className="font-semibold text-gray-900 mb-3">Choose Date</h4>
                            <div className="border border-gray-200 rounded-xl p-4">
                                <DayPicker
                                    mode="single"
                                    selected={selectedDate}
                                    onSelect={(date) => date && setSelectedDate(date)}
                                    disabled={disabledDays}
                                    modifiers={{
                                        current: startDate
                                    }}
                                    className="mx-auto"
                                    modifiersClassNames={{
                                        selected: 'bg-primary text-white hover:bg-primary',
                                        today: 'font-bold text-primary',
                                        current: 'ring-2 ring-primary ring-offset-2 rounded-md',
                                    }}
                                />

                                {/* Legend */}
                                <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 gap-2">
                                    <div className="flex items-center gap-2 text-[10px]">
                                        <div className="w-3.5 h-3.5 bg-white border-2 border-gray-300 rounded" />
                                        <span className="text-gray-600">Available</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px]">
                                        <div className="w-3.5 h-3.5 bg-gray-100 text-gray-400 flex items-center justify-center rounded text-[8px]">✕</div>
                                        <span className="text-gray-600">Reserved</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px]">
                                        <div className="w-3.5 h-3.5 bg-primary rounded" />
                                        <span className="text-gray-600">Selected</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px]">
                                        <div className="w-3.5 h-3.5 ring-2 ring-primary ring-offset-1 rounded-sm" />
                                        <span className="text-gray-600">Current Booking</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-4 p-4 bg-primary/5 rounded-lg text-sm border border-primary/10">
                                <p className="font-semibold text-primary mb-1 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Current Booking:
                                </p>
                                <p className="text-gray-700 font-medium">
                                    {format(startDate, 'PPPP')} <br />
                                    <span className="text-primary font-bold">{format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}</span> ({duration} {duration === 1 ? 'hr' : 'hrs'})
                                </p>
                            </div>
                        </div>

                        {/* Right Column: Time Slots */}
                        <div>
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="font-semibold text-gray-900">
                                    Select Time Range
                                </h4>
                            </div>

                            <div className="border border-gray-200 rounded-xl overflow-hidden flex flex-col h-[55dvh] sm:h-[400px]">
                                {!selectedDate ? (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                                        <p className="text-sm text-gray-400">Please select a date first</p>
                                    </div>
                                ) : isLoadingSlots ? (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-primary" />
                                        <p className="text-sm text-gray-500 mt-3">Loading time slots...</p>
                                    </div>
                                ) : timeSlots.length === 0 ? (
                                    <div className="flex-1 flex flex-col items-center justify-center p-8">
                                        <svg className="w-12 h-12 text-gray-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <p className="text-sm text-gray-500">No time slots available</p>
                                        <p className="text-xs text-gray-400 mt-1">Please select another date</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="bg-blue-50 border-b border-blue-100 px-4 py-3 shrink-0">
                                            <p className="text-xs text-blue-700">
                                                {!selectedTime ? (
                                                    `Tap a time to start your ${duration} hr booking`
                                                ) : (
                                                    `${duration} hours selected`
                                                )}
                                            </p>
                                        </div>
                                        <div className="overflow-y-auto divide-y divide-gray-100 flex-1">
                                            {timeSlots.map((slot, index) => {
                                                const contiguousAvailable = isDurationAvailable(slot.time)
                                                // If duration > 1, the slot might be available itself but not enough consecutive slots
                                                const practicallyDisabled = !contiguousAvailable

                                                const isStartSlot = selectedTime === slot.time
                                                let isSelectedOrInRange = false

                                                if (selectedTime) {
                                                    const selectedIdx = timeSlots.findIndex(s => s.time === selectedTime)
                                                    if (index >= selectedIdx && index < selectedIdx + duration && selectedIdx !== -1) {
                                                        isSelectedOrInRange = true
                                                    }
                                                }

                                                // "inRange" means it's part of the duration block but not the start slot
                                                const isSecondarySlot = isSelectedOrInRange && !isStartSlot

                                                // Check if it's the original booking date and slot
                                                const isOriginalDate = selectedDate &&
                                                    selectedDate.getDate() === startDate.getDate() &&
                                                    selectedDate.getMonth() === startDate.getMonth() &&
                                                    selectedDate.getFullYear() === startDate.getFullYear();

                                                const startTimeStr = format(startDate, 'HH:mm')
                                                const endTimeStr = format(endDate, 'HH:mm')
                                                const isOriginalSlot = isOriginalDate &&
                                                    slot.time >= startTimeStr &&
                                                    slot.time < endTimeStr

                                                return (
                                                    <button
                                                        key={`${slot.time}-${index}`}
                                                        onClick={() => {
                                                            if (!practicallyDisabled) setSelectedTime(slot.time)
                                                        }}
                                                        disabled={practicallyDisabled}
                                                        className={cn(
                                                            "w-full px-4 py-3 text-left transition-all relative overflow-hidden",
                                                            practicallyDisabled && "bg-gray-100 cursor-not-allowed opacity-60",
                                                            isStartSlot && "bg-primary text-white",
                                                            isSecondarySlot && "bg-primary/10 text-primary-900 border-l-4 border-primary",
                                                            !practicallyDisabled && !isSelectedOrInRange && "hover:bg-gray-50",
                                                            isOriginalSlot && !isStartSlot && !isSecondarySlot && "bg-orange-50/50"
                                                        )}
                                                    >
                                                        {isOriginalSlot && (
                                                            <div className="absolute top-0 right-0">
                                                                <div className="bg-orange-500 text-[8px] text-white px-1.5 py-0.5 rounded-bl-md font-bold uppercase tracking-wider">
                                                                    Current
                                                                </div>
                                                            </div>
                                                        )}
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className={cn(
                                                                    "w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                                                                    practicallyDisabled ? "border-gray-300 bg-gray-200" : isStartSlot ? "border-white bg-white" : "border-gray-300",
                                                                    isSecondarySlot && "border-primary bg-primary",
                                                                    isOriginalSlot && !isStartSlot && !isSecondarySlot && "border-orange-500"
                                                                )}>
                                                                    {isStartSlot && <div className="w-2 h-2 rounded-full bg-primary" />}
                                                                    {isSecondarySlot && <div className="w-2 h-2 rounded-full bg-white" />}
                                                                    {isOriginalSlot && !isStartSlot && !isSecondarySlot && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                                                                </div>
                                                                <div>
                                                                    <p className={cn(
                                                                        "font-medium",
                                                                        isStartSlot ? "text-white" : practicallyDisabled ? "text-gray-400" : "text-gray-900"
                                                                    )}>
                                                                        {formatTimeStr(slot.time)} - {formatTimeStr(getNextHourStr(slot.time))}
                                                                    </p>
                                                                    {isOriginalSlot && !isStartSlot && (
                                                                        <span className="text-[10px] text-orange-600 font-bold block leading-none mt-1">
                                                                            Original Slot
                                                                        </span>
                                                                    )}
                                                                    {practicallyDisabled && !slot.available && (
                                                                        <span className="text-xs text-red-500 font-medium pt-1">Reserved</span>
                                                                    )}
                                                                    {practicallyDisabled && slot.available && duration > 1 && (
                                                                        <span className="text-xs text-orange-500 font-medium pt-1">Not enough consecutive time</span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <span className={cn(
                                                                "text-sm font-semibold",
                                                                isStartSlot ? "text-white" : practicallyDisabled ? "text-gray-400" : "text-gray-700"
                                                            )}>
                                                                ₱{slot.price || booking.courts.hourly_rate}
                                                            </span>
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    {error && (
                        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 p-3 rounded-md text-sm">
                            <span className="font-semibold">Error:</span> {error}
                        </div>
                    )}
                </div>

                {/* Footer matching availability modal */}
                <div className="border-t border-gray-200 px-4 py-4 sm:px-6 bg-gray-50 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between shrink-0 sm:rounded-b-2xl">
                    <div className="text-sm">
                        {selectedDate && selectedTime ? (
                            <>
                                <p className="text-gray-600">
                                    <span className="font-medium text-gray-900">New Date:</span>{' '}
                                    {format(selectedDate, 'MMM d, yyyy')}
                                </p>
                                <p className="text-gray-600 mt-1">
                                    <span className="font-medium text-gray-900">Time:</span>{' '}
                                    {formatTimeStr(selectedTime)} ({duration} {duration === 1 ? 'hr' : 'hrs'})
                                </p>
                            </>
                        ) : (
                            <p className="text-gray-500">
                                Select a date and time to reschedule
                            </p>
                        )}
                    </div>
                    <div className="flex w-full sm:w-auto flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                        <button
                            onClick={onClose}
                            className="w-full sm:w-auto px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors focus:outline-none"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            disabled={!selectedDate || !selectedTime || isSubmitting}
                            className="w-full sm:w-auto px-6 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Spinner className="w-4 h-4 mr-2 border-white" />
                                    Processing...
                                </>
                            ) : (
                                'Confirm Reschedule'
                            )}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

