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

  // Fetch booking details
  const { data: booking, error } = await supabase
    .from('reservations')
    .select(
      `
      *,
      courts (
        name,
        hourly_rate,
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
    .eq('id', id)
    .single();

  if (error || !booking) {
    notFound();
  }

  // Verify ownership
  if (booking.user_id !== user.id) {
    // Ideally use RLS, but double check here
    notFound();
  }

  const formatTime = (timeString: string) => {
    try {
      return format(new Date(timeString), 'h:mm a');
    } catch {
      return timeString;
    }
  };

  const isQueueSession = booking.metadata?.is_queue_session_reservation === true;
  const durationHours =
    (new Date(booking.end_time).getTime() - new Date(booking.start_time).getTime()) / 3600000;

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

              {/* Queue Session Info */}
              {isQueueSession && (
                <div className="p-4 bg-indigo-50/50 rounded-lg border border-indigo-100/50 space-y-2">
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Mode</span>
                    <span className="font-medium capitalize text-gray-900">
                      {booking.notes?.match(/Queue Session \((.*?)\)/)?.[1] || 'Casual'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-500">Max Players</span>
                    <span className="font-medium text-gray-900">
                      {booking.num_players} players
                    </span>
                  </div>
                </div>
              )}

              {/* Order Summary */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
                  Order Summary
                </h3>
                <div className="text-sm">
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">
                      Court Rental ({durationHours}h × ₱{booking.courts.hourly_rate.toFixed(2)}/hr)
                    </span>
                    <span className="text-gray-900">₱{(booking.courts.hourly_rate * durationHours).toFixed(2)}</span>
                  </div>

                  {booking.metadata?.platform_fee > 0 && (
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">
                        Service Fee ({booking.metadata.platform_fee_percentage || 5}%)
                      </span>
                      <span className="text-gray-900">₱{parseFloat(booking.metadata.platform_fee).toFixed(2)}</span>
                    </div>
                  )}

                  {booking.discount_applied > 0 && (
                    <div className="flex justify-between py-2">
                      <span className="text-green-600">
                        {booking.discount_type || 'Discount'}
                      </span>
                      <span className="text-green-600">-₱{booking.discount_applied.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between py-3 mt-1 border-t-2 border-gray-900">
                    <span className="text-base font-bold text-gray-900">Total</span>
                    <span className="text-base font-bold text-gray-900">₱{booking.total_amount.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">
                  Payment Info
                </h3>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between py-1">
                    <span className="text-gray-600">Method</span>
                    <span className="font-medium text-gray-900">
                      {booking.payments?.[0]?.payment_method === 'gcash'
                        ? 'GCash'
                        : booking.payments?.[0]?.payment_method === 'paymaya'
                          ? 'Maya'
                          : booking.payment_type === 'cash'
                            ? 'Cash'
                            : booking.payments?.[0]?.payment_method || booking.payment_type || 'Cash'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-600">Promo</span>
                    <span className="font-medium">
                      {booking.discount_applied && booking.discount_applied > 0 ? (
                        <span className="text-green-600">{booking.discount_type || 'Applied'}</span>
                      ) : (
                        <span className="text-gray-400">None</span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-gray-600">Amount Paid</span>
                    <span className="font-medium text-gray-900">₱{booking.amount_paid.toFixed(2)}</span>
                  </div>
                </div>

                {/* Down Payment / Partially Paid Info */}
                {booking.metadata?.down_payment_amount && (
                  <div className="mt-3 p-4 bg-amber-50 rounded-lg border border-amber-200 space-y-2">
                    <div className="flex justify-between py-1">
                      <span className="text-amber-800 font-medium">
                        Down Payment ({booking.metadata.down_payment_percentage || 20}%)
                      </span>
                      <span className="font-bold text-amber-900">
                        ₱{parseFloat(booking.metadata.down_payment_amount).toFixed(2)}
                      </span>
                    </div>

                    {booking.status === 'partially_paid' ? (
                      <>
                        <div className="flex justify-between py-1">
                          <span className="text-amber-800 font-medium">
                            Remaining ({booking.payment_type === 'cash' ? 'Pay at Venue' : 'Pending'})
                          </span>
                          <span className="font-bold text-amber-900">
                            ₱{(booking.total_amount - booking.amount_paid).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-xs text-amber-700 mt-1">
                          Please pay the remaining balance in cash at the venue before your session.
                        </p>
                      </>
                    ) : booking.status === 'confirmed' &&
                      booking.amount_paid >= booking.total_amount ? (
                      <>
                        <div className="flex justify-between py-1">
                          <span className="text-green-800 font-medium">
                            Remaining (Paid)
                          </span>
                          <span className="font-bold text-green-900">
                            ₱{(booking.total_amount - parseFloat(booking.metadata.down_payment_amount)).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-xs text-green-700 mt-1">
                          ✅ Full payment received.
                          {booking.metadata?.cash_balance_paid_at &&
                            ` Balance paid at venue on ${format(new Date(booking.metadata.cash_balance_paid_at), 'MMM d, yyyy h:mm a')}.`}
                        </p>
                      </>
                    ) : (
                      <div className="flex justify-between py-1">
                        <span className="text-amber-800 font-medium">Remaining Balance</span>
                        <span className="font-bold text-amber-900">
                          ₱{(booking.total_amount - booking.amount_paid).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
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
