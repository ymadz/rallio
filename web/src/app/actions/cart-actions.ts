'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { createMultiCourtReservationsAction, checkCartAvailabilityAction } from './reservations'
import { initiatePaymentAction } from './payments'

// Fetch the user's active cart and its items
export async function getUserCartAction() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'User not authenticated', data: null }
    }

    // Attempt to get active cart
    let { data: cart, error: cartError } = await supabase
      .from('carts')
      .select(`
        id,
        items:cart_items (
          id,
          cart_id,
          court_id,
          start_time,
          end_time,
          price,
          num_players,
          court:courts (
            id,
            name,
            venue:venues (
              id,
              name
            )
          )
        )
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    // If no active cart exists, create one
    if (cartError && cartError.code === 'PGRST116') {
      const { data: newCart, error: newCartError } = await supabase
        .from('carts')
        .insert({ user_id: user.id, status: 'active' })
        .select()
        .single()

      if (newCartError) {
        return { success: false, error: newCartError.message }
      }
      return { success: true, data: { ...newCart, items: [] } }
    } else if (cartError) {
      return { success: false, error: cartError.message }
    }

    return { success: true, data: cart }
  } catch (error) {
    console.error('Error fetching cart:', error)
    return { success: false, error: 'An unexpected error occurred while fetching the cart' }
  }
}

// Add an item to the cart
export async function addToCartAction({
  courtId,
  startTime,
  endTime,
  price,
  numPlayers = 1
}: {
  courtId: string
  startTime: string
  endTime: string
  price: number
  numPlayers?: number
}) {
  try {
    const supabase = await createClient()

    // 1. Get or create active cart
    const cartResult = await getUserCartAction()
    if (!cartResult.success || !cartResult.data) {
      return { success: false, error: cartResult.error }
    }
    const cartId = cartResult.data.id

    // 2. Insert the item
    const { data: newItem, error: insertItemError } = await supabase
      .from('cart_items')
      .insert({
        cart_id: cartId,
        court_id: courtId,
        start_time: startTime,
        end_time: endTime,
        price,
        num_players: numPlayers
      })
      .select(`
        id,
        cart_id,
        court_id,
        start_time,
        end_time,
        price,
        num_players,
        court:courts (
          id,
          name,
          venue:venues (
            id,
            name
          )
        )
      `)
      .single()

    if (insertItemError) {
      // Check for unique constraint violation (item already in cart)
      if (insertItemError.code === '23505') {
        return { success: false, error: 'This time slot is already in your cart.' }
      }
      return { success: false, error: insertItemError.message }
    }

    // Force revalidation of any checkout or cart pages
    revalidatePath('/', 'layout')

    return { success: true, data: newItem }
  } catch (error) {
    console.error('Error adding to cart:', error)
    return { success: false, error: 'Failed to add item to cart' }
  }
}

// Remove an item from the cart
export async function removeFromCartAction(cartItemId: string) {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('id', cartItemId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    console.error('Error removing from cart:', error)
    return { success: false, error: 'Failed to remove item from cart' }
  }
}

// Clear the cart
export async function clearCartAction(cartId: string) {
  try {
    const supabase = await createClient()
    const { error } = await supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', cartId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    console.error('Error clearing cart:', error)
    return { success: false, error: 'Failed to clear cart' }
  }
}

export async function clearActiveCartAfterPaymentAction() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return { success: false, error: 'User not authenticated' }
    }

    const { data: activeCart, error: cartError } = await supabase
      .from('carts')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    // No active cart means there is nothing to clear. Keep this idempotent.
    if (cartError && cartError.code === 'PGRST116') {
      return { success: true }
    }

    if (cartError || !activeCart) {
      return { success: false, error: cartError?.message || 'Active cart not found' }
    }

    const { error: clearError } = await supabase
      .from('cart_items')
      .delete()
      .eq('cart_id', activeCart.id)

    if (clearError) {
      return { success: false, error: clearError.message }
    }

    revalidatePath('/', 'layout')
    return { success: true }
  } catch (error) {
    console.error('Error clearing active cart after payment:', error)
    return { success: false, error: 'Failed to clear active cart after payment' }
  }
}

export async function checkoutUnifiedCartAction(paymentMethod: 'gcash' | 'cash') {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'Not authenticated' }

    // 1. Get active cart
    const { data: cart } = await supabase
      .from('carts')
      .select('id, items:cart_items(*)')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single()

    if (!cart || !cart.items || cart.items.length === 0) {
      return { success: false, error: 'Your cart is empty' }
    }

    // 2. Final availability re-check (same safeguard pattern as /checkout flow)
    const availabilityResult = await checkCartAvailabilityAction(
      cart.items.map((item: any) => {
        const start = new Date(item.start_time)
        const end = new Date(item.end_time)
        const startH = String(start.getHours()).padStart(2, '0')
        const startM = String(start.getMinutes()).padStart(2, '0')
        const endH = String(end.getHours()).padStart(2, '0')
        const endM = String(end.getMinutes()).padStart(2, '0')

        return {
          courtId: item.court_id,
          date: start,
          startTime: `${startH}:${startM}`,
          endTime: `${endH}:${endM}`,
        }
      })
    )

    if (!availabilityResult.available) {
      return {
        success: false,
        error: 'Some selected slots are no longer available. Please review your cart and try again.'
      }
    }

    // 3. Map items to reservation action format
    const multiItems = cart.items.map((item: any) => ({
      courtId: item.court_id,
      startTimeISO: item.start_time,
      endTimeISO: item.end_time,
      totalAmount: Number(item.price),
      paymentType: 'full' as const,
      paymentMethod: (paymentMethod === 'gcash' ? 'e-wallet' : 'cash') as 'e-wallet' | 'cash',
      numPlayers: item.num_players,
    }))

    // 4. Create global Multi-Court Reservation
    const multiResult = await createMultiCourtReservationsAction({
      userId: user.id,
      items: multiItems,
    })

    if (!multiResult.success || !multiResult.reservationId) {
      return { success: false, error: multiResult.error || 'Conflict: Failed to book courts. Please review your cart.' }
    }

     // 5. Initiate Payment Mode
    if (paymentMethod === 'cash') {
       return { success: true, bookingId: multiResult.bookingId || multiResult.reservationId }
    }

    const paymentResult = await initiatePaymentAction(multiResult.reservationId, 'gcash')
    if (!paymentResult.success || !paymentResult.checkoutUrl) {
      return { success: false, error: paymentResult.error || 'Failed to initiate payment gateway' }
    }

    return { success: true, bookingId: multiResult.bookingId || multiResult.reservationId, checkoutUrl: paymentResult.checkoutUrl }
  } catch (error: any) {
    console.error('Unified checkout error', error)
    return { success: false, error: error.message || 'An error occurred during checkout' }
  }
}
