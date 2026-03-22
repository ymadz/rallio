'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Booking, BookingCard } from '@/app/(main)/bookings/booking-card'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { VisuallyHidden } from '@radix-ui/react-visually-hidden'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { ChevronRight, ChevronLeft, X, LayoutGrid } from 'lucide-react'
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
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null)

  if (!group) return null

  const firstBooking = group.reservations[0]
  const startDate = new Date(firstBooking.start_time)

  // Status aggregation
  const isFullyPaid = group.amountPaid >= group.totalAmount
  const anyPartiallyPaid = group.reservations.some(b => b.status === 'partially_paid')
  const anyPendingPayment = group.reservations.some(b => b.status === 'pending_payment')
  const isQueueSession = group.reservations.some(b => b.type === 'queue_session')

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

  const handleClose = () => {
    setSelectedBooking(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent 
        overlayClassName="bg-black/40 backdrop-blur-sm"
        className={cn(
          "inset-0 translate-x-0 translate-y-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 w-screen h-[100dvh] max-w-none max-h-none p-0 bg-white border-0 overflow-hidden rounded-none sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:h-[85vh] sm:max-h-[800px] sm:flex sm:flex-col sm:border sm:border-gray-200 sm:rounded-3xl sm:shadow-2xl transition-all duration-700 ease-in-out",
          selectedBooking ? "sm:max-w-5xl" : "sm:max-w-lg"
        )}
      >
        <VisuallyHidden>
          <DialogTitle>
            {group.type === 'grouped_recurring' ? 'Recurring Series' : 'Multi-Court Transaction'} Details
          </DialogTitle>
        </VisuallyHidden>

        <div className="flex h-full w-full relative overflow-hidden bg-gray-50/30">
          <div className={cn(
            "flex flex-col h-full shrink-0 bg-white border-r border-gray-100 transition-all duration-700 ease-in-out py-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
            selectedBooking ? "hidden sm:flex sm:w-[460px]" : "flex w-full"
          )}>
            {/* Header Theme */}
            <div className="h-44 shrink-0 bg-primary p-6 flex flex-col justify-end relative overflow-hidden">
               {/* Decorative background glass circles */}
               <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-white/10 -translate-y-1/2 translate-x-1/3 blur-3xl pointer-events-none" />
               <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-black/10 translate-y-1/2 -translate-x-1/3 blur-2xl pointer-events-none" />

               <div className="relative z-10">
                 <div className="flex justify-between items-start mb-4">
                    <button 
                      onClick={onClose}
                      className="p-2 -ml-2 rounded-xl hover:bg-white/10 text-white transition-all active:scale-95 sm:hidden"
                    >
                      <ChevronLeft className="w-6 h-6" />
                    </button>
                 </div>
                 <div className="flex justify-between items-end">
                    <div className="max-w-[70%]">
                        <div className="flex items-center gap-2 mb-1">
                            <h2 className="text-xl font-bold text-white tracking-tight leading-tight">
                                {isQueueSession ? 'Queue Session' : (group.type === 'grouped_recurring' ? 'Recurring Series' : 'Multi-Court Transaction')}
                            </h2>
                        </div>
                        <div className="flex items-center gap-2">
                            <p className="text-white/80 text-xs font-semibold">
                                {format(startDate, 'EEEE, MMM d, yyyy')}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[9px] uppercase font-bold tracking-[0.1em] text-white/50 mb-0.5">Total Amount</p>
                        <p className="text-2xl font-black text-white">₱{group.totalAmount.toFixed(0)}</p>
                    </div>
                 </div>
               </div>
            </div>

            <div className="flex-1 min-h-0 flex flex-col p-5">
                <div className="flex items-center justify-between mb-4 shrink-0 px-1">
                    <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] py-1">
                            Reservations ({group.reservations.length})
                        </h3>
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto pr-1 custom-scrollbar space-y-3 pb-4">
                    {group.reservations.map((booking, index) => {
                        const bStart = new Date(booking.start_time)
                        const bEnd = new Date(booking.end_time)
                        const active = selectedBooking?.id === booking.id

                        return (
                            <button 
                            key={booking.id}
                            className={cn(
                                "w-full text-left group p-4 transition-all duration-300 rounded-[1.25rem] border flex items-center justify-between relative overflow-hidden",
                                active 
                                    ? "bg-primary border-primary shadow-xl shadow-primary/30 z-10" 
                                    : "bg-white hover:bg-gray-50/80 border-gray-100 hover:border-gray-200"
                            )}
                            onClick={() => setSelectedBooking(booking)}
                            >
                                {active && (
                                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-emerald-500 opacity-10 pointer-events-none" />
                                )}
                                <div className="flex items-center gap-4 relative z-10 w-full">
                                    <div className={cn(
                                        "w-[3.25rem] h-[3.25rem] rounded-2xl flex flex-col items-center justify-center shrink-0 transition-all duration-300",
                                        active ? "bg-white/15 scale-110" : "bg-gray-50 text-gray-400"
                                    )}>
                                        <span className={cn("text-[8px] font-black uppercase tracking-tighter leading-none mb-0.5", active ? "text-white/60" : "text-gray-400")}>{format(bStart, 'MMM')}</span>
                                        <span className={cn("text-xl font-black leading-none", active ? "text-white" : "text-gray-800")}>{format(bStart, 'd')}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className={cn("font-bold text-sm transition-colors", active ? "text-white" : "text-gray-900")}>
                                                {format(bStart, 'h:mm a')} – {format(bEnd, 'h:mm a')}
                                            </div>
                                            <StatusBadge 
                                                status={booking.status} 
                                                size="sm" 
                                                className={cn(active && "bg-white/20 border-white/20 text-white")}
                                            />
                                        </div>
                                        <div className={cn("text-[11px] transition-colors truncate max-w-[180px] font-medium", active ? "text-white/70" : "text-gray-500")}>
                                            {booking.courts?.name}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center shrink-0 bg-white">
                    <div className="flex gap-4">
                        <div className="bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                            <p className="text-gray-400 text-[8px] uppercase font-bold tracking-wider mb-0.5">Paid</p>
                            <p className="font-black text-teal-600 text-sm leading-none">₱{group.amountPaid.toFixed(0)}</p>
                        </div>
                        {!isFullyPaid && (
                            <div className="bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-100">
                                <p className="text-amber-400 text-[8px] uppercase font-bold tracking-wider mb-0.5">Balance</p>
                                <p className="font-black text-amber-600 text-sm leading-none">₱{(group.totalAmount - group.amountPaid).toFixed(0)}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
          </div>

          <div className={cn(
            "h-full bg-white relative transition-all duration-700 ease-in-out z-20",
            selectedBooking ? "flex-1 opacity-100 visible" : "w-0 opacity-0 invisible pointer-events-none"
          )}>
            {selectedBooking ? (
              <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-16 duration-700 ease-out">
                {/* Mobile back header overlay - very elegant and minimal */}
                <div className="sm:hidden absolute top-6 left-6 z-[60]">
                  <button 
                    onClick={() => setSelectedBooking(null)}
                    className="w-12 h-12 rounded-2xl bg-black/30 backdrop-blur-xl text-white shadow-2xl flex items-center justify-center active:scale-90 transition-all"
                  >
                    <ChevronLeft className="w-6 h-6 -translate-x-0.5" />
                  </button>
                </div>

                <div className="flex-1 overflow-hidden relative">
                    <style>{`
                        .card-inner-scroll::-webkit-scrollbar { width: 0px; }
                        .card-inner-scroll { scrollbar-width: none; }
                    `}</style>
                    <div className="h-full overflow-y-auto card-inner-scroll">
                        <BookingCard
                            booking={selectedBooking}
                            serverDate={serverDate}
                            setBookings={() => {}} 
                            onReschedule={(b) => { setSelectedBooking(null); onSelectBooking(b); }}
                            onCancelBooking={(b) => { setSelectedBooking(null); handleClose(); onSelectBooking(b); }}
                            onRefundBooking={(b) => { setSelectedBooking(null); handleClose(); onSelectBooking(b); }}
                            onResumePayment={(b) => { setSelectedBooking(null); handleClose(); onSelectBooking(b); }}
                            resumingPaymentId={null}
                            cancellingId={null}
                        />
                    </div>
                </div>
              </div>
            ) : (
                <div className="hidden sm:flex h-full w-full items-center justify-center p-12 text-center flex-col bg-gray-50/50">
                    <div className="w-24 h-24 rounded-[2rem] bg-white border border-gray-100 shadow-xl shadow-gray-200/50 flex items-center justify-center mb-6 text-gray-200 animate-bounce duration-[3000ms]">
                        <LayoutGrid className="w-10 h-10 text-primary/20" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Reservation Details</h3>
                    <p className="text-sm text-gray-500 max-w-[280px] leading-relaxed">
                        Select any slot from the list to view detailed information, receipts, or manage the booking.
                    </p>
                </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
