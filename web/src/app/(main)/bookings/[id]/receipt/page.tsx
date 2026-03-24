import { createClient } from '@/lib/supabase/server';
import { notFound, redirect } from 'next/navigation';
import { format } from 'date-fns';
import Link from 'next/link';
import { DownloadReceiptButton } from '@/components/shared/download-receipt-button';

export default async function BookingReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { id } = await params;

  // Fetch booking details. Match either the reservation ID or the master booking_id
  const { data: bookings, error } = await supabase
    .from('reservations')
    .select(
      `
      *,
      courts (
        name,
        hourly_rate,
        venue_id,
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
    `
    )
    .or(`id.eq.${id},booking_id.eq.${id}`)
    .order('start_time', { ascending: true });

  if (error || !bookings || bookings.length === 0) {
    notFound();
  }

  // Verify ownership
  if (bookings.some((b) => b.user_id !== user.id)) {
    notFound();
  }

  const formatTime = (timeString: string) => {
    try {
      return new Date(timeString).toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Manila'
      });
    } catch {
      return timeString;
    }
  };

  const formatDate = (timeString: string) => {
    try {
      return new Date(timeString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Manila'
      });
    } catch {
      return timeString;
    }
  };

  const isQueueSession = bookings[0].metadata?.is_queue_session_reservation === true;
  
  // Aggregate totals
  const totalAmount = bookings.reduce((sum, b) => sum + Number(b.total_amount), 0);
  const amountPaid = bookings.reduce((sum, b) => sum + Number(b.amount_paid), 0);
  const allConfirmed = bookings.every(b => b.status === 'confirmed');
  const sharedStatus = allConfirmed ? 'CONFIRMED' : bookings[0].status.toUpperCase();
  const paymentMethod = bookings[0].payments?.[0]?.payment_method || bookings[0].payment_type || 'Cash';

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="print:hidden">{/* Header actions removed to standardize receipt */}</div>

        {/* Receipt Card */}
        <div
          id="receipt-content"
          className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm print:border-none print:shadow-none"
        >
          {/* Header */}
          <div
            className={`bg-gradient-to-r ${isQueueSession ? 'from-indigo-500 to-indigo-600' : 'from-primary to-primary/80'} text-white p-8 text-center print:bg-none print:text-black`}
          >
            <h1 className="text-2xl font-bold mb-2">
              {isQueueSession ? 'Queue Session Receipt' : 'Booking Receipt'}
            </h1>
            <p className="opacity-90">Thank you for your reservation</p>
          </div>

          <div className="p-8">
            {/* Reference */}
            <div className="text-center mb-8 pb-8 border-b border-gray-100">
              <p className="text-sm text-gray-500 mb-1">Booking Reference</p>
              <p className="text-2xl font-mono font-bold text-gray-900 uppercase">
                {id.slice(0, 8)}
              </p>
              <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                {sharedStatus}
              </div>
            </div>

            {/* Details */}
            <div className="space-y-6">
              
              {/* Order Summary Line Items */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
                  Reserved Courts
                </h3>
                <div className="space-y-3">
                  {bookings.map((booking, idx) => {
                    const durationHours = (new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime()) / 3600000;
                    const basePrice = booking.courts.hourly_rate * durationHours;
                    return (
                      <div key={idx} className="flex flex-col py-3 border-b border-gray-100 last:border-0 relative">
                         <div className="flex justify-between items-start">
                            <div>
                               <p className="font-semibold text-gray-900">{booking.courts.venues.name} - {booking.courts.name}</p>
                               <p className="text-sm text-gray-500 mt-1">
                                {formatDate(booking.start_time)} • {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                               </p>
                            </div>
                            <div className="text-right">
                               <p className="font-semibold text-gray-900">₱{basePrice.toFixed(2)}</p>
                               {(booking.discount_applied > 0) && (
                                  <p className="text-sm text-green-600">-₱{Number(booking.discount_applied).toFixed(2)}</p>
                               )}
                               <p className="text-xs text-gray-500 mt-0.5 font-medium">Net: ₱{Number(booking.total_amount).toFixed(2)}</p>
                            </div>
                         </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Aggregated Totals */}
              <div className="pt-4 mt-4 border-t-2 border-gray-900">
                <div className="flex justify-between py-1">
                  <span className="text-base font-bold text-gray-900">Grand Total</span>
                  <span className="text-base font-bold text-gray-900">₱{totalAmount.toFixed(2)}</span>
                </div>
              </div>

              {/* Payment Info */}
              <div className="pt-6">
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
                  Payment Info
                </h3>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between py-1">
                    <span className="text-gray-600">Method</span>
                    <span className="font-medium text-gray-900 capitalize">
                      {paymentMethod}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-600">Total Amount Paid</span>
                    <span className="font-medium text-gray-900">₱{amountPaid.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-600">Remaining Balance</span>
                    <span className="font-bold text-amber-900">₱{Math.max(0, totalAmount - amountPaid).toFixed(2)}</span>
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

          {/* Action Buttons */}
          <div
            data-html2canvas-ignore
            className="border-t border-gray-200 p-6 bg-gray-50 grid grid-cols-2 gap-3 print:hidden"
          >
            <DownloadReceiptButton />
            <Link
              href="/bookings"
              className="w-full text-center px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Done
            </Link>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style
        dangerouslySetInnerHTML={{
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
      `,
        }}
      />
      <script
        dangerouslySetInnerHTML={{
          __html: `
        function printReceipt() {
            window.print();
        }
      `,
        }}
      />
    </div>
  );
}
