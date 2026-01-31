
'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function CallbackContent() {
    const searchParams = useSearchParams()
    const status = searchParams.get('status')
    const [message, setMessage] = useState('Processing payment...')

    useEffect(() => {
        // Determine deep link based on status
        const target = status === 'success'
            ? 'rallio://checkout/success'
            : 'rallio://checkout/cancel'

        setMessage(status === 'success' ? 'Payment Successful!' : 'Payment Cancelled')

        // Attempt deep link redirect
        // Use a small timeout to allow rendering
        const timer = setTimeout(() => {
            window.location.href = target
        }, 1000)

        return () => clearTimeout(timer)
    }, [status])

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-lg">
                <h1 className="mb-2 text-xl font-bold text-gray-900">
                    {status === 'success' ? 'Payment Complete' : 'Payment Cancelled'}
                </h1>
                <p className="mb-6 text-gray-600">
                    Redirecting you back to the Rallio app...
                </p>

                <div className="flex justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
                </div>

                <button
                    onClick={() => {
                        const target = status === 'success' ? 'rallio://checkout/success' : 'rallio://checkout/cancel'
                        window.location.href = target
                    }}
                    className="mt-6 w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                >
                    Return to App
                </button>
            </div>
        </div>
    )
}

export default function MobilePaymentCallback() {
    return (
        <Suspense fallback={
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600"></div>
            </div>
        }>
            <CallbackContent />
        </Suspense>
    )
}
