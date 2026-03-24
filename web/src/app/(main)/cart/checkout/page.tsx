import { UnifiedCheckoutClient } from './checkout-client'

export const metadata = {
  title: 'Cart Checkout - Rallio',
  description: 'Complete your multi-venue court bookings securely.',
}

export default function CartCheckoutPage() {
  return <UnifiedCheckoutClient />
}
