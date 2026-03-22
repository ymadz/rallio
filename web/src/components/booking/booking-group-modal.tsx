'use client'

import { format } from 'date-fns'
import { Booking } from '@/app/(main)/bookings/booking-card'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'

interface BookingGroupModalProps {
  group: {
    id: string
    type: 'grouped_multi_court' | 'grouped_recurring'
    reservations: Booking[]
    totalAmount: number
    amountPaid: number
  } | null
  isOpen: boolean
  onClose: () => void
  onSelectBooking: (booking: Booking) => void
  serverDate: Date | null
}

export function BookingGroupModal({ group, isOpen, onClose, onSelectBooking, serverDate }: BookingGroupModalProps) {
  if (!group) return null

  const firstBooking = group.reservations[0]
  const startDate = new Date(firstBooking.start_time)

  // Status aggregation
  const isFullyPaid = group.amountPaid >= group.totalAmount
  const anyPartiallyPaid = group.reservations.some(b => b.status === 'partially_paid')
  const anyPendingPayment = group.reservations.some(b => b.status === 'pending_payment')

  let groupStatus = 'confirmed'
  let groupStatusLabel = 'Confirmed'

  if (anyPendingPayment) {
    groupStatus = 'pending_payment'
    groupStatusLabel = 'Awaiting Payment'
  } else if (anyPartiallyPaid || (group.amountPaid > 0 && !isFullyPaid)) {
    groupStatus = 'partially_paid'
    groupStatusLabel = 'Partially Paid'
  } else if (isFullyPaid) {
    groupStatus = 'confirmed'
    groupStatusLabel = 'Fully Paid'
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        overlayClassName="bg-black/20"
        className="inset-0 translate-x-0 translate-y-0 data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0 w-screen h-[100dvh] max-w-none max-h-none p-0 bg-white border-0 overflow-hidden rounded-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%] sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%] sm:h-[90vh] sm:max-h-[90vh] sm:max-w-2xl sm:flex sm:flex-col sm:border sm:border-gray-200 sm:rounded-2xl"
      >
        <VisuallyHidden>
          <DialogTitle>
            {group.type === 'grouped_recurring' ? 'Recurring Series' : 'Multi-Court Transaction'} Details
          </DialogTitle>
        </VisuallyHidden>
        <div className="relative h-full min-h-0 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
          {/* Header Theme - Matching Rallio primary green */}
          <div className="h-24 shrink-0 bg-primary p-5 flex flex-col justify-end border-b border-primary/20">
            <div className="relative z-10 flex justify-between items-end">
              <div>
                <h2 className="text-xl font-semibold text-white tracking-tight leading-tight">
                  {group.type === 'grouped_recurring' ? 'Recurring Series' : 'Multi-Court Transaction'}
                </h2>
                <p className="text-white/80 text-sm">
                  {format(startDate, 'EEEE, MMMM d, yyyy')}
                </p>
                <p className="text-white/85 text-xs mt-1">
                  Status: {groupStatusLabel}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/60 mb-1">Total Transaction</p>
                <p className="text-lg font-semibold text-white">₱{group.totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="flex-1 min-h-0 p-4 sm:p-6 flex flex-col">
            <div className="flex items-center justify-between mb-3 sm:mb-4 shrink-0">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                Individual Slots ({group.reservations.length})
              </h3>
              <div className="h-px flex-1 bg-gray-100 mx-4" />
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto pr-2 sm:pr-4 sm:-mr-4 custom-scrollbar">
              <div className="space-y-3 pb-4 sm:pb-2">
                {group.reservations.map((booking, index) => {
                  const bStart = new Date(booking.start_time)
                  const bEnd = new Date(booking.end_time)
                  const courtImages = booking.courts?.court_images || []
                  const primaryImage = courtImages.find((img) => img.is_primary)
                  const imageUrl = primaryImage?.url || courtImages[0]?.url || booking.courts?.venues?.image_url
                  
                  return (
                    <div 
                      key={booking.id}
                      className="group p-4 bg-white hover:bg-gray-50 transition-colors rounded-xl border border-gray-200 flex items-center justify-between cursor-pointer"
                      onClick={() => onSelectBooking(booking)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-[10%] min-w-[54px] max-w-[64px] h-14 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 shrink-0">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={booking.courts?.name || 'Court'}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-800 flex items-center gap-2">
                            <span>{format(bStart, 'MMM d')}</span>
                            <span className="text-gray-300 font-normal">|</span>
                            <span>{format(bStart, 'h:mm a')} – {format(bEnd, 'h:mm a')}</span>
                          </div>
                          <div className="text-xs text-gray-500 truncate max-w-[220px] sm:max-w-[320px]">
                            {booking.courts?.name} @ {booking.courts?.venues?.name}
                          </div>
                          <div className="text-[10px] text-gray-400 mt-1">Slot {index + 1}</div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-semibold text-gray-700">₱{booking.total_amount.toFixed(2)}</p>
                          <StatusBadge status={booking.status} label={booking.status.replace('_', ' ')} size="sm" />
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 group-hover:text-primary transition-colors">
                          <svg className="w-4 h-4 translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            
            <div className="mt-3 sm:mt-6 pt-4 sm:pt-6 border-t border-gray-100 flex justify-between items-center text-sm shrink-0 bg-white">
               <div className="flex gap-4">
                  <div>
                    <p className="text-gray-400 text-xs uppercase font-bold tracking-tighter">Amount Paid</p>
                    <p className="font-bold text-teal-600">₱{group.amountPaid.toFixed(2)}</p>
                  </div>
                  {!isFullyPaid && (
                    <div>
                      <p className="text-gray-400 text-xs uppercase font-bold tracking-tighter">Balance</p>
                      <p className="font-bold text-amber-600">₱{Math.max(0, group.totalAmount - group.amountPaid).toFixed(2)}</p>
                    </div>
                  )}
               </div>
               <Button variant="ghost" className="text-gray-400 hover:text-gray-600 rounded-xl" onClick={onClose}>
                 Close Details
               </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
