'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCartStore } from '@/stores/cart-store'
import { useCheckoutStore, type BookingCartItem } from '@/stores/checkout-store'
import { getUserCartAction } from '@/app/actions/cart-actions'
import { AlertCircle, ShoppingCart } from 'lucide-react'

export function UnifiedCheckoutClient() {
  const router = useRouter()
  const { items, setCartData, setLoading: setCartLoading } = useCartStore()
  const { setBookingCart, setBookingData, resetCheckout } = useCheckoutStore()
  const [isHydrating, setIsHydrating] = useState(true)
  const [isRedirecting, setIsRedirecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const waitForCheckoutSeed = async (timeoutMs = 1500) => {
    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
      const seeded = useCheckoutStore.getState().bookingData
      if (seeded) return true
      await new Promise((resolve) => setTimeout(resolve, 30))
    }
    return false
  }

  // Hydrate /checkout state from cart so /cart/checkout uses identical flow/components.
  useEffect(() => {
    async function load() {
      setIsHydrating(true)
      setError(null)

      let sourceItems = items

      if (sourceItems.length === 0) {
        setCartLoading(true)
        const res = await getUserCartAction()
        if (!res.success || !res.data) {
          setCartLoading(false)
          setIsHydrating(false)
          setError(res.error || 'Unable to load your cart.')
          return
        }
        sourceItems = res.data.items || []
        setCartData(res.data.id, sourceItems)
        setCartLoading(false)
      }

      if (sourceItems.length === 0) {
        setIsHydrating(false)
        return
      }

      const availableItems = sourceItems.filter((item) => !item.isUnavailable)

      if (availableItems.length === 0) {
        setError('All items in your cart are currently unavailable. Please review your cart first.')
        setIsHydrating(false)
        return
      }

      const mappedCart: BookingCartItem[] = availableItems.map((item) => {
        const start = new Date(item.start_time)
        const end = new Date(item.end_time)
        const durationHours = Math.max((end.getTime() - start.getTime()) / (1000 * 60 * 60), 0.5)

        const venueData = item.court?.venue as any
        const resolvedVenue = Array.isArray(venueData) ? venueData[0] : venueData

        const startH = String(start.getHours()).padStart(2, '0')
        const startM = String(start.getMinutes()).padStart(2, '0')
        const endH = String(end.getHours()).padStart(2, '0')
        const endM = String(end.getMinutes()).padStart(2, '0')

        return {
          courtId: item.court_id,
          courtName: item.court?.name || 'Court',
          venueId: resolvedVenue?.id || '',
          venueName: resolvedVenue?.name || 'Venue',
          date: start,
          startTime: `${startH}:${startM}`,
          endTime: `${endH}:${endM}`,
          hourlyRate: Number(item.price) / durationHours,
          capacity: item.num_players || 4,
          recurrenceWeeks: 1,
          selectedDays: [],
        }
      })

      setBookingCart(mappedCart)

      // Guard against rare hydration timing where bookingData isn't visible on first render.
      const seededBookingData = useCheckoutStore.getState().bookingData
      if (!seededBookingData && mappedCart.length > 0) {
        setBookingData(mappedCart[0])
      }

      const isSeeded = await waitForCheckoutSeed()
      if (!isSeeded) {
        setError('Unable to prepare checkout from cart items.')
        setIsHydrating(false)
        setIsRedirecting(false)
        return
      }

      setIsHydrating(false)
      setIsRedirecting(true)
      router.replace('/checkout')
    }

    load()
  }, [])

  const hasUnavailable = useMemo(() => items.some((i) => i.isUnavailable), [items])

  if (isHydrating || isRedirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-primary" />
          <p className="text-sm text-gray-600">Preparing checkout...</p>
        </div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-8 bg-white rounded-2xl shadow-sm border border-gray-100 text-center">
        <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 mb-6">Looks like you haven't added any courts to your cart yet.</p>
        <button
          onClick={() => {
            resetCheckout()
            router.push('/')
          }}
          className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
        >
          Browse Courts
        </button>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-8 bg-white rounded-2xl shadow-sm border border-red-100">
        <div className="flex items-start gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold">Checkout setup failed</h2>
            <p className="text-sm mt-1">{error}</p>
            <button
              onClick={() => {
                resetCheckout()
                router.push('/')
              }}
              className="mt-4 px-5 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Back to Courts
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (hasUnavailable) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-8 bg-white rounded-2xl shadow-sm border border-amber-100">
        <div className="flex items-start gap-3 text-amber-800">
          <AlertCircle className="w-5 h-5 mt-0.5" />
          <div>
            <h2 className="text-lg font-semibold">Cart needs review</h2>
            <p className="text-sm mt-1">Some cart slots are unavailable. Remove those slots in the cart drawer, then continue checkout.</p>
            <button
              onClick={() => {
                resetCheckout()
                router.push('/')
              }}
              className="mt-4 px-5 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Back to Courts
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Handoff route should always redirect to /checkout on success.
  return null
}
