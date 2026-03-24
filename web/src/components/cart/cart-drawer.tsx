'use client'

import { useEffect } from 'react'
import { useCartStore } from '@/stores/cart-store'
import { getUserCartAction, removeFromCartAction, clearCartAction } from '@/app/actions/cart-actions'
import { checkCartAvailabilityAction } from '@/app/actions/reservations'
import { useCheckoutStore } from '@/stores/checkout-store'
import { X, Trash2, ShoppingCart, AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export function CartDrawer() {
  const router = useRouter()
  const { 
    isOpen, 
    items, 
    cartId,
    setIsOpen, 
    setCartData, 
    setItemAvailability, 
    getTotalPrice,
    setLoading,
    isLoading
  } = useCartStore()

  const { setBookingCart } = useCheckoutStore()

  // Load cart on mount and when drawer opens
  useEffect(() => {
    async function loadCart() {
      if (!isOpen && items.length > 0) return // Already loaded, optionally we can force refresh
      
      setLoading(true)
      const res = await getUserCartAction()
      if (res.success && res.data) {
        setCartData(res.data.id, res.data.items || [])
        
        // Check availability
        if (res.data.items && res.data.items.length > 0) {
          const availRes = await checkCartAvailabilityAction(
            res.data.items.map((i: any) => ({
              courtId: i.court_id,
              date: new Date(i.start_time),
              startTime: new Date(i.start_time).toTimeString().substring(0,5),
              endTime: new Date(i.end_time).toTimeString().substring(0,5),
            }))
          )
          
          if (availRes && !availRes.available && availRes.conflicts) {
            // Mark items as unavailable
            res.data.items.forEach((item: any, idx: number) => {
              const hasConflict = availRes.conflicts.some((c: any) => 
                c.courtId === item.court_id 
              )
              if (hasConflict) {
                setItemAvailability(item.id, true)
              }
            })
          }
        }
      }
      setLoading(false)
    }
    
    loadCart()
  }, [isOpen])

  if (!isOpen) return null

  const handleRemove = async (itemId: string) => {
    setLoading(true)
    const res = await removeFromCartAction(itemId)
    if (res.success) {
      // Optimistically remove
      setCartData(cartId!, items.filter(i => i.id !== itemId))
    }
    setLoading(false)
  }

  const handleCheckout = async () => {
    const availableItems = items.filter(i => !i.isUnavailable)
    const venueIds = new Set(availableItems.map(i => i.court?.venue?.id).filter(Boolean))

    if (venueIds.size === 1) {
      setLoading(true)
      const mappedCart = availableItems.map(item => {
        const start = new Date(item.start_time)
        const end = new Date(item.end_time)
        const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
        
        return {
          courtId: item.court_id,
          courtName: item.court?.name || 'Court',
          venueId: item.court?.venue?.id || '',
          venueName: item.court?.venue?.name || 'Venue',
          date: start,
          startTime: start.toTimeString().substring(0,5),
          endTime: end.toTimeString().substring(0,5),
          hourlyRate: Number(item.price) / Math.max(0.5, durationHours),
          capacity: item.num_players || 4,
          recurrenceWeeks: 1,
          selectedDays: []
        }
      })
      
      setBookingCart(mappedCart)
      if (cartId) {
        await clearCartAction(cartId)
        setCartData(cartId, [])
      }
      setLoading(false)
      setIsOpen(false)
      router.push('/checkout')
    } else {
      setIsOpen(false)
      router.push('/cart/checkout')
    }
  }

  const hasUnavailable = items.some(i => i.isUnavailable)
  const availableItems = items.filter(i => !i.isUnavailable)

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 z-[100] transition-opacity"
        onClick={() => setIsOpen(false)}
      />
      
      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-[101] w-full max-w-sm bg-white shadow-xl flex flex-col transform transition-transform duration-300">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Your Cart
          </h2>
          <button 
            onClick={() => setIsOpen(false)}
            className="p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-gray-50">
          {isLoading && items.length === 0 ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-gray-500">
              <ShoppingCart className="w-12 h-12 mb-4 text-gray-300" />
              <p>Your cart is empty</p>
            </div>
          ) : (
            items.map(item => (
              <div 
                key={item.id} 
                className={`bg-white border rounded-xl p-4 shadow-sm relative ${item.isUnavailable ? 'border-red-300 bg-red-50 opacity-80' : 'border-gray-200'}`}
              >
                {item.isUnavailable && (
                  <div className="absolute -top-3 left-4 bg-red-100 text-red-700 text-xs px-2 py-1 rounded border border-red-200 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3" />
                    Slot Taken
                  </div>
                )}
                
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900 truncate pr-4">
                      {item.court?.venue?.name || 'Venue'} - {item.court?.name || 'Court'}
                    </h3>
                    <p className="text-sm text-gray-500">
                      {new Date(item.start_time).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-sm text-gray-600 font-medium">
                      {new Date(item.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
                      {new Date(item.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <button 
                    onClick={() => handleRemove(item.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                    disabled={isLoading}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="flex justify-between items-end mt-4">
                  <div className="text-xs text-gray-500">
                    {item.num_players} Player{item.num_players > 1 ? 's' : ''}
                  </div>
                  <div className="font-bold text-primary">
                    ₱{Number(item.price).toFixed(2)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t p-4 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          {hasUnavailable && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg flex items-start gap-2 border border-red-100">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p>Some slots in your cart are no longer available. Please remove them to proceed.</p>
            </div>
          )}

          <div className="flex justify-between items-center mb-4">
            <span className="font-semibold text-gray-600">Total</span>
            <span className="text-2xl font-bold text-gray-900">
              ₱{getTotalPrice().toFixed(2)}
            </span>
          </div>

          <button
            onClick={handleCheckout}
            disabled={items.length === 0 || hasUnavailable || isLoading}
            className="w-full bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
          >
            {isLoading ? (
               <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              'Proceed to Checkout'
            )}
          </button>
        </div>
      </div>
    </>
  )
}
