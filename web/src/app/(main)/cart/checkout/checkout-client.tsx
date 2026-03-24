'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useCartStore } from '@/stores/cart-store'
import { checkoutUnifiedCartAction, getUserCartAction } from '@/app/actions/cart-actions'
import { AlertCircle, ShoppingCart, ShieldCheck, CreditCard, Banknote } from 'lucide-react'

export function UnifiedCheckoutClient() {
  const router = useRouter()
  const { items, getTotalPrice, setCartData, setLoading: setCartLoading, setItemAvailability } = useCartStore()
  
  const [paymentMethod, setPaymentMethod] = useState<'gcash' | 'cash' | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Verify cart on load
  useEffect(() => {
    async function load() {
      if (items.length === 0) {
        setCartLoading(true)
        const res = await getUserCartAction()
        if (res.success && res.data) {
          setCartData(res.data.id, res.data.items || [])
        }
        setCartLoading(false)
      }
    }
    load()
  }, [])

  const availableItems = items.filter(i => !i.isUnavailable)
  const hasUnavailable = items.some(i => i.isUnavailable)
  const totalPrice = getTotalPrice()

  const handleCheckout = async () => {
    if (!paymentMethod) {
      setError('Please select a payment method')
      return
    }
    if (availableItems.length === 0) {
      setError('Your cart is empty or has unavailable items')
      return
    }

    setIsProcessing(true)
    setError(null)

    const result = await checkoutUnifiedCartAction(paymentMethod)
    
    if (result.success) {
      if (paymentMethod === 'cash' || !result.checkoutUrl) {
        // Clear local cart
        setCartData('', [])
        router.push(`/bookings/${result.bookingId}/receipt`)
      } else {
        // Redir to PayMongo
        window.location.href = result.checkoutUrl
      }
    } else {
      setIsProcessing(false)
      setError(result.error || 'Checkout failed')
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-12 p-8 bg-white rounded-2xl shadow-sm border border-gray-100 text-center">
        <ShoppingCart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 mb-6">Looks like you haven't added any courts to your cart yet.</p>
        <button
          onClick={() => router.push('/')}
          className="px-6 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
        >
          Browse Courts
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto my-8 px-4">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Secure Checkout</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Col: Order Summary */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-gray-500" /> Order Summary
            </h2>
            
            {hasUnavailable && (
               <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg flex items-start gap-2 border border-red-100">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <p>Some items in your cart are no longer available. Please remove them via the cart drawer before proceeding.</p>
               </div>
            )}

            <div className="space-y-4">
              {items.map(item => (
                <div key={item.id} className={`flex items-start justify-between py-4 border-b border-gray-100 last:border-0 ${item.isUnavailable ? 'opacity-50' : ''}`}>
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.court?.venue?.name || 'Venue'} - {item.court?.name || 'Court'}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(item.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-sm text-gray-600 font-medium font-mono mt-0.5">
                      {new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(item.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-primary">₱{Number(item.price).toFixed(2)}</span>
                    <p className="text-xs text-gray-500 mt-1">{item.num_players} Player(s)</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-semibold mb-4">Payment Method</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setPaymentMethod('gcash')}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${paymentMethod === 'gcash' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="font-semibold text-gray-900">E-Wallet</h3>
                  <p className="text-xs text-gray-500">Pay via GCash or Maya</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'gcash' ? 'border-primary' : 'border-gray-300'}`}>
                  {paymentMethod === 'gcash' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </div>
              </button>
              
              <button
                onClick={() => setPaymentMethod('cash')}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${paymentMethod === 'cash' ? 'border-primary bg-primary/5' : 'border-gray-200 hover:border-gray-300'}`}
              >
                <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center text-green-600">
                  <Banknote className="w-6 h-6" />
                </div>
                <div className="text-left flex-1">
                  <h3 className="font-semibold text-gray-900">Over-the-Counter</h3>
                  <p className="text-xs text-gray-500">Pay cash at the venue</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${paymentMethod === 'cash' ? 'border-primary' : 'border-gray-300'}`}>
                  {paymentMethod === 'cash' && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </div>
              </button>
            </div>
            
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p>{error}</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Right Col: Sticky Total */}
        <div className="lg:col-span-1">
          <div className="bg-gray-900 text-white rounded-2xl shadow-xl p-6 sticky top-24">
            <h2 className="text-xl font-bold mb-6">Payment Summary</h2>
            
            <div className="space-y-4 mb-6">
              <div className="flex justify-between items-center text-gray-300">
                <span>Subtotal ({availableItems.length} items)</span>
                <span>₱{totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-300">
                <span>Platform Fee</span>
                <span>₱0.00</span>
              </div>
            </div>
            
            <div className="border-t border-gray-700 pt-4 mb-8">
              <div className="flex justify-between items-end">
                <span className="font-medium text-gray-300">Total</span>
                <span className="text-3xl font-bold text-white">₱{totalPrice.toFixed(2)}</span>
              </div>
            </div>
            
            <button
              onClick={handleCheckout}
              disabled={isProcessing || !paymentMethod || hasUnavailable}
              className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  Processing...
                </>
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" />
                  Pay ₱{totalPrice.toFixed(2)}
                </>
              )}
            </button>
            
            <p className="text-center text-xs text-gray-400 mt-4">
              By completing this purchase, you agree to our Terms of Service and Cancellation Policy.
            </p>
          </div>
        </div>
        
      </div>
    </div>
  )
}
