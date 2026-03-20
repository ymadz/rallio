'use client'

import { format } from 'date-fns'
import { Booking } from '@/app/(main)/bookings/booking-card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

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
        overlayClassName="bg-emerald-950/15 backdrop-blur-sm"
        className="max-w-2xl p-0 bg-white border-2 border-white overflow-hidden rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)]"
      >
        <VisuallyHidden>
          <DialogTitle>
            {group.type === 'grouped_recurring' ? 'Recurring Series' : 'Multi-Court Transaction'} Details
          </DialogTitle>
        </VisuallyHidden>
        <div className="relative">
          {/* Header Theme - Matching Rallio primary green */}
          <div className="h-28 bg-primary p-6 flex flex-col justify-end shadow-[inset_0_-2px_6px_rgba(0,0,0,0.05)]">
            <div className="relative z-10 flex justify-between items-end">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight leading-tight">
                  {group.type === 'grouped_recurring' ? 'Recurring Series' : 'Multi-Court Transaction'}
                </h2>
                <p className="text-white/80 text-sm font-medium">
                  {format(startDate, 'EEEE, MMMM d, yyyy')}
                </p>
              </div>
              <div className="text-right">
                <StatusBadge status={groupStatus} label={groupStatusLabel} size="md" className="mb-2 shadow-lg ring-1 ring-white/20" />
                <p className="text-xs text-white/60 mb-1">Total Transaction</p>
                <p className="text-xl font-black text-white">₱{group.totalAmount.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                Individual Slots ({group.reservations.length})
              </h3>
              <div className="h-px flex-1 bg-gray-100 mx-4" />
            </div>

            <div className="max-h-[380px] overflow-y-auto pr-4 -mr-4 custom-scrollbar">
              <div className="space-y-3 pb-4">
                {group.reservations.map((booking) => {
                  const bStart = new Date(booking.start_time)
                  const bEnd = new Date(booking.end_time)
                  
                  return (
                    <div 
                      key={booking.id}
                      className="group p-4 bg-white hover:bg-emerald-50/30 transition-all duration-300 rounded-2xl border border-gray-100 flex items-center justify-between cursor-pointer"
                      onClick={() => onSelectBooking(booking)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col items-center justify-center text-primary font-bold overflow-hidden shrink-0">
                           {(() => {
                              const name = booking.courts?.name || "Unit"
                              const parts = name.split(' ')
                              const prefixes = ['COURT', 'UNIT', 'GROUND', 'HALL', 'ROOM', 'PADEL', 'TABLE', 'VIP', 'MAIN']
                              
                              let header = ''
                              let identifier = name
                              
                              if (parts.length > 1) {
                                if (prefixes.includes(parts[0].toUpperCase())) {
                                  header = parts[0].toUpperCase()
                                  identifier = parts.slice(1).join(' ')
                                } else if (prefixes.includes(parts[parts.length - 1].toUpperCase())) {
                                  header = parts[parts.length - 1].toUpperCase()
                                  identifier = parts.slice(0, parts.length - 1).join(' ')
                                }
                              }

                              return (
                                <>
                                  {header && (
                                    <div className="w-full bg-primary/5 text-[9px] text-center py-0.5 border-b border-primary/10 tracking-widest leading-none">
                                      {header}
                                    </div>
                                  )}
                                  <span className={cn(
                                    "leading-none uppercase",
                                    !header ? "mt-0" : "mt-1",
                                    identifier.length > 3 ? "text-sm px-1 text-center" : 
                                    identifier.length > 2 ? "text-base" : "text-xl"
                                  )}>
                                    {identifier}
                                  </span>
                                </>
                              )
                           })()}
                        </div>
                        <div>
                          <div className="font-bold text-gray-800 group-hover:text-primary transition-colors flex items-center gap-2">
                            <span>{format(bStart, 'MMM d')}</span>
                            <span className="text-gray-300 font-normal">|</span>
                            <span>{format(bStart, 'h:mm a')} – {format(bEnd, 'h:mm a')}</span>
                          </div>
                          <div className="text-xs text-gray-500 font-medium">
                            {booking.courts?.name} @ {booking.courts?.venues?.name}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-right hidden sm:block">
                          <p className="text-sm font-bold text-gray-700">₱{booking.total_amount.toFixed(2)}</p>
                          <StatusBadge status={booking.status} label={booking.status.replace('_', ' ')} size="sm" />
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gray-200/50 group-hover:bg-primary/10 flex items-center justify-center text-gray-400 group-hover:text-primary transition-all">
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
            
            <div className="mt-6 pt-6 border-t border-gray-100 flex justify-between items-center text-sm">
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
