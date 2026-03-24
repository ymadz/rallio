'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { Capacitor } from '@capacitor/core'

/**
 * DeepLinkHandler
 * Listen for app open events via custom URL schemes (e.g., rallio://)
 * and perform necessary actions like closing the in-app browser or navigating.
 */
export function DeepLinkHandler() {
  const router = useRouter()

  useEffect(() => {
    // Only run on native platforms
    if (!Capacitor.isNativePlatform()) return

    console.log('[DeepLinkHandler] 📱 Initializing deep link listener')

    const setupListener = async () => {
      const handler = await App.addListener('appUrlOpen', (data: { url: string }) => {
        console.log('[DeepLinkHandler] 🔗 App opened with URL:', data.url)
        
        try {
          // Robust parsing for custom schemes
          let url: URL;
          try {
            url = new URL(data.url)
          } catch (e) {
            console.warn('[DeepLinkHandler] ⚠️ URL constructor failed, using fallback parsing:', data.url)
            // Fallback for cases where URL-constructor fails on custom schemes
            const mockUrl = data.url.replace('rallio://', 'https://rallio.internal/')
            url = new URL(mockUrl)
          }
          
          const isCheckoutCallback = 
            (url.host === 'checkout' && url.pathname === '/callback') || // rallio://checkout/callback
            (url.host === '' && url.pathname.startsWith('/checkout/callback')) || // rallio:///checkout/callback
            (data.url.includes('checkout/callback')) // Broad fallback
            
          if (isCheckoutCallback) {
            const status = url.searchParams.get('status')
            const reservationId = url.searchParams.get('reservation')
            const bookingId = url.searchParams.get('booking')
            
            console.log('[DeepLinkHandler] ✅ Payment callback detected:', { 
              status, 
              reservationId, 
              bookingId,
              originalUrl: data.url 
            })
            
            // 1. Close the in-app browser if it was opened via Browser.open()
            Browser.close().catch(err => {
              console.warn('[DeepLinkHandler] ⚠️ Failed to close browser (might already be closed):', err)
            })
            
            // 2. Navigate the main webview to the result page
            if (status === 'success' && reservationId) {
              const target = `/checkout/success?reservation=${reservationId}${bookingId ? `&booking=${bookingId}` : ''}`
              console.log('[DeepLinkHandler] 🚀 Navigating to success:', target)
              router.push(target)
            } else if (status === 'failed' && reservationId) {
              console.log('[DeepLinkHandler] 🚀 Navigating to failure:', `/checkout/failed?reservation=${reservationId}`)
              router.push(`/checkout/failed?reservation=${reservationId}`)
            } else {
              console.warn('[DeepLinkHandler] ⚠️ Incomplete callback data:', { status, reservationId })
              // Fallback to bookings list if we have no reservation ID
              router.push('/bookings')
            }
          }
        } catch (err) {
          console.error('[DeepLinkHandler] ❌ Error handling deep link event:', err)
        }
      })

      return handler
    }

    const handlerPromise = setupListener()

    return () => {
      handlerPromise.then(handler => handler.remove())
    }
  }, [router])

  return null
}
