import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { format } from 'date-fns'
import Link from 'next/link'
import { PrintButton } from '@/components/shared/print-button'

export default async function BookingReceiptPage({ params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const { id } = await params

    // Fetch booking details
    const { data: booking, error } = await supabase
        .from('reservations')
        .select(`
      *,
      courts (
        name,
        venues (
          name,
          address,
          phone,
          email
        )
      ),
      payments (
        amount,
        payment_method,
        status,
        created_at
      )
    `)
        .eq('id', id)
        .single()

    if (error || !booking) {
        notFound()
    }

    // Verify ownership
    if (booking.user_id !== user.id) {
        // Ideally use RLS, but double check here
        notFound()
    }

    const formatTime = (timeString: string) => {
        try {
            return format(new Date(timeString), 'h:mm a')
        } catch {
            return timeString
        }
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto">
                {/* Print Actions (Hidden when printing) */}
                <div className="mb-6 flex justify-between items-center print:hidden">
                    <Link
                        href="/bookings"
                        className="text-sm font-medium text-gray-600 hover:text-gray-900 flex items-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to Bookings
                    </Link>
                    <PrintButton />
                </div>

                {/* Receipt Card */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm print:border-none print:shadow-none">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-primary to-primary/80 text-white p-8 text-center print:bg-none print:text-black">
                        <h1 className="text-2xl font-bold mb-2">Booking Receipt</h1>
                        <p className="opacity-90">Thank you for your reservation</p>
                    </div>

                    <div className="p-8">
                        {/* Reference */}
                        <div className="text-center mb-8 pb-8 border-b border-gray-100">
                            <p className="text-sm text-gray-500 mb-1">Booking Reference</p>
                            <p className="text-2xl font-mono font-bold text-gray-900 uppercase">
                                {booking.id.slice(0, 8)}
                            </p>
                            <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {booking.status.toUpperCase()}
                            </div>
                        </div>

                        {/* Details */}
                        <div className="space-y-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 mb-1">Venue</h3>
                                    <p className="font-semibold text-gray-900">{booking.courts.venues.name}</p>
                                    <p className="text-sm text-gray-600">{booking.courts.venues.address}</p>
                                </div>
                                <div className="text-right">
                                    <h3 className="text-sm font-medium text-gray-500 mb-1">Court</h3>
                                    <p className="font-semibold text-gray-900">{booking.courts.name}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg print:bg-gray-50/50 print:border print:border-gray-100">
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 mb-1">Date</h3>
                                    <p className="font-semibold text-gray-900">
                                        {format(new Date(booking.start_time), 'MMM d, yyyy')}
                                    </p>
                                </div>
                                <div>
                                    <h3 className="text-sm font-medium text-gray-500 mb-1">Time</h3>
                                    <p className="font-semibold text-gray-900">
                                        {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                                    </p>
                                </div>
                            </div>

                            {/* Payment Info */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">Payment Details</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between py-2 border-b border-gray-100">
                                        <span className="text-gray-600">Rate per hour</span>
                                        <span className="font-medium">₱{booking.courts.hourly_rate.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-gray-100">
                                        <span className="text-gray-600">Duration</span>
                                        <span className="font-medium">
                                            {(new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime()) / 3600000} hours
                                        </span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-gray-100">
                                        <span className="text-gray-600">Payment Method</span>
                                        <span className="font-medium capitalize">{booking.payment_type || 'Cash'}</span>
                                    </div>
                                    <div className="flex justify-between py-2 text-lg font-bold text-gray-900 mt-2">
                                        <span>Total Amount</span>
                                        <span>₱{booking.total_amount.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="mt-8 pt-8 border-t border-gray-100 text-center text-xs text-gray-500 print:mt-16">
                            <p>Rallio Court Booking System</p>
                            <p className="mt-1">Generated on {format(new Date(), 'MMM d, yyyy h:mm a')}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #receipt-content, #receipt-content * {
            visibility: visible;
          }
          #receipt-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print\\:border-none {
            border: none !important;
          }
        }
      `}} />
            <script dangerouslySetInnerHTML={{
                __html: `
        function printReceipt() {
            window.print();
        }
      `}} />
        </div>
    )
}
