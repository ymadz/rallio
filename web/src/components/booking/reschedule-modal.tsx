'use client'

import { useState, useEffect } from 'react'
import { format, differenceInHours } from 'date-fns'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Spinner } from '@/components/ui/spinner'
import { TimeSlotGrid, TimeSlot } from '@/components/booking/time-slot-grid'
import { getAvailableTimeSlotsAction } from '@/app/actions/reservations'
import { rescheduleReservationAction } from '@/app/actions/reschedule-actions'
import { useToast } from '@/hooks/use-toast'

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
            const result = await rescheduleReservationAction(booking.id, selectedDate, selectedTime)

            if (result.success) {
                toast({
                    title: 'Success',
                    description: 'Booking rescheduled successfully',
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

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Reschedule Booking</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
                    {/* Left Column: Calendar */}
                    <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-3">Select New Date</h3>
                        <div className="border rounded-md p-3 flex justify-center">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={setSelectedDate}
                                disabled={(date) => {
                                    const today = new Date()
                                    today.setHours(0, 0, 0, 0)
                                    return date < today
                                }}
                                className="rounded-lg border shadow-sm"
                            />
                        </div>

                        <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm">
                            <p className="font-medium text-gray-900 mb-1">Current Booking:</p>
                            <p className="text-gray-600">
                                {format(startDate, 'PPP')} <br />
                                {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')} ({duration}h)
                            </p>
                            <p className="font-medium text-gray-900 mt-2 mb-1">Court:</p>
                            <p className="text-gray-600">{booking.courts.name}</p>
                        </div>
                    </div>

                    {/* Right Column: Time Slots */}
                    <div>
                        <h3 className="text-sm font-medium text-gray-700 mb-3">
                            Select Start Time ({duration}h)
                        </h3>

                        {selectedDate ? (
                            <div className="min-h-[300px]">
                                {isLoadingSlots ? (
                                    <div className="flex flex-col items-center justify-center h-48 text-gray-500">
                                        <Spinner size="lg" className="mb-2" />
                                        <span>Loading slots...</span>
                                    </div>
                                ) : (
                                    <TimeSlotGrid
                                        slots={timeSlots}
                                        selectedTime={selectedTime}
                                        onSelectTime={setSelectedTime}
                                        duration={duration}
                                        className="max-h-[400px] overflow-y-auto pr-2"
                                    />
                                )}
                            </div>
                        ) : (
                            <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-400">
                                Please select a date first
                            </div>
                        )}
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm mb-4">
                        {error}
                    </div>
                )}

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <div className="flex-1 text-left text-sm text-gray-500 hidden sm:block">
                        {selectedDate && selectedTime && (
                            <span>
                                New time: <b>{format(selectedDate, 'MMM d')} at {selectedTime}</b>
                            </span>
                        )}
                    </div>
                    <div className="flex gap-2 justify-end w-full sm:w-auto">
                        <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={!selectedDate || !selectedTime || isSubmitting}
                        >
                            {isSubmitting && <Spinner className="w-4 h-4 mr-2" />}
                            Confirm Reschedule
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
