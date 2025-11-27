'use client'

import { useEffect, useRef, useState } from 'react'
import { QueueSession } from './use-queue'

export interface QueueNotification {
  id: string
  type: 'turn-now' | 'turn-soon' | 'position-update' | 'removed'
  title: string
  message: string
  courtId: string
  courtName: string
  venueName: string
  sessionId: string
  timestamp: Date
  dismissed: boolean
}

interface NotificationState {
  lastStatus: 'waiting' | 'playing' | 'completed' | null
  lastPosition: number | null
  shownNotifications: Set<string>
}

const NOTIFICATION_STORAGE_KEY = 'rallio_queue_notifications'
const NOTIFICATION_EXPIRY_MS = 30 * 60 * 1000 // 30 minutes

/**
 * Hook for managing queue notifications
 * Detects status changes and position updates, triggers notifications
 */
export function useQueueNotifications(queue: QueueSession | null, userId: string | null) {
  const [notifications, setNotifications] = useState<QueueNotification[]>([])
  const stateRef = useRef<NotificationState>({
    lastStatus: null,
    lastPosition: null,
    shownNotifications: new Set(),
  })
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio for notifications
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Create audio context for notification sound
      audioRef.current = new Audio()
      // Using a simple beep sound (data URI for a sine wave)
      // You can replace this with a custom sound file
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)

      // Store the audio context for later use
      ;(audioRef.current as any).context = audioContext
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Load shown notifications from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY)
        if (stored) {
          const data = JSON.parse(stored) as { id: string; timestamp: number }[]
          const now = Date.now()

          // Filter out expired notifications
          const valid = data.filter(item => now - item.timestamp < NOTIFICATION_EXPIRY_MS)
          stateRef.current.shownNotifications = new Set(valid.map(item => item.id))

          // Update localStorage with valid notifications only
          localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(valid))
        }
      } catch (error) {
        console.error('[useQueueNotifications] Error loading notifications from storage:', error)
      }
    }
  }, [])

  // Play notification sound
  const playNotificationSound = () => {
    try {
      if (audioRef.current && (audioRef.current as any).context) {
        const context = (audioRef.current as any).context as AudioContext
        const oscillator = context.createOscillator()
        const gainNode = context.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(context.destination)

        // Configure sound (pleasant notification beep)
        oscillator.frequency.value = 800 // 800 Hz
        oscillator.type = 'sine'

        // Envelope (fade in/out)
        gainNode.gain.setValueAtTime(0, context.currentTime)
        gainNode.gain.linearRampToValueAtTime(0.3, context.currentTime + 0.05)
        gainNode.gain.linearRampToValueAtTime(0, context.currentTime + 0.3)

        oscillator.start(context.currentTime)
        oscillator.stop(context.currentTime + 0.3)

        console.log('🔔 [useQueueNotifications] Playing notification sound')
      }
    } catch (error) {
      console.error('[useQueueNotifications] Error playing sound:', error)
    }
  }

  // Create and store notification
  const createNotification = (
    type: QueueNotification['type'],
    title: string,
    message: string
  ) => {
    if (!queue) return

    const notificationId = `${queue.id}-${type}-${Date.now()}`

    // Check if this notification was already shown
    if (stateRef.current.shownNotifications.has(notificationId)) {
      return
    }

    const notification: QueueNotification = {
      id: notificationId,
      type,
      title,
      message,
      courtId: queue.courtId,
      courtName: queue.courtName,
      venueName: queue.venueName,
      sessionId: queue.id,
      timestamp: new Date(),
      dismissed: false,
    }

    console.log('🔔 [useQueueNotifications] Creating notification:', notification)

    // Add to notifications list
    setNotifications(prev => [...prev, notification])

    // Mark as shown
    stateRef.current.shownNotifications.add(notificationId)

    // Save to localStorage
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(NOTIFICATION_STORAGE_KEY)
        const data = stored ? JSON.parse(stored) : []
        data.push({ id: notificationId, timestamp: Date.now() })
        localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(data))
      } catch (error) {
        console.error('[useQueueNotifications] Error saving to storage:', error)
      }
    }

    // Play sound
    playNotificationSound()

    // Request browser notification permission if not already granted
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          console.log('[useQueueNotifications] Notification permission:', permission)
        })
      }

      // Show browser notification if permission granted
      if (Notification.permission === 'granted') {
        try {
          new Notification(title, {
            body: message,
            icon: '/icon.png', // Replace with your app icon
            badge: '/badge.png', // Replace with your badge icon
            tag: notificationId,
            requireInteraction: type === 'turn-now', // Keep visible for "turn now" notifications
          })
        } catch (error) {
          console.error('[useQueueNotifications] Error showing browser notification:', error)
        }
      }
    }
  }

  // Detect status changes and position updates
  useEffect(() => {
    if (!queue || !userId) {
      return
    }

    const currentStatus = queue.status
    const currentPosition = queue.userPosition

    console.log('🔍 [useQueueNotifications] Checking for changes:', {
      currentStatus,
      currentPosition,
      lastStatus: stateRef.current.lastStatus,
      lastPosition: stateRef.current.lastPosition,
    })

    // Check if user is in the queue
    const isUserInQueue = currentPosition !== null
    const userPlayer = queue.players.find(p => p.userId === userId)

    if (isUserInQueue && userPlayer) {
      const playerStatus = userPlayer.status || 'waiting' // Status from participant record

      // Detect status change to 'playing'
      if (
        stateRef.current.lastStatus &&
        stateRef.current.lastStatus !== playerStatus &&
        playerStatus === 'playing'
      ) {
        console.log('🚨 [useQueueNotifications] Status changed to PLAYING!')
        createNotification(
          'turn-now',
          "It's Your Turn to Play!",
          `Match assigned at ${queue.courtName}. Head to the court now!`
        )
      }

      // Detect significant position change (moved up)
      if (
        stateRef.current.lastPosition !== null &&
        currentPosition !== null &&
        currentPosition < stateRef.current.lastPosition &&
        currentPosition <= 3 && // Only notify if in top 3
        stateRef.current.lastPosition > 3
      ) {
        console.log('📍 [useQueueNotifications] Position improved to top 3')
        createNotification(
          'turn-soon',
          'Almost Your Turn!',
          `You're now #${currentPosition} in the queue at ${queue.courtName}`
        )
      }

      // Update state
      stateRef.current.lastStatus = playerStatus as any
      stateRef.current.lastPosition = currentPosition
    } else {
      // User left the queue or was removed
      if (stateRef.current.lastStatus !== null) {
        console.log('👋 [useQueueNotifications] User left queue')
        stateRef.current.lastStatus = null
        stateRef.current.lastPosition = null
      }
    }
  }, [queue, userId])

  // Dismiss notification
  const dismissNotification = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n =>
        n.id === notificationId ? { ...n, dismissed: true } : n
      )
    )
  }

  // Clear all notifications
  const clearAllNotifications = () => {
    setNotifications([])
  }

  // Get active (non-dismissed) notifications
  const activeNotifications = notifications.filter(n => !n.dismissed)

  return {
    notifications: activeNotifications,
    dismissNotification,
    clearAllNotifications,
    hasActiveNotifications: activeNotifications.length > 0,
  }
}
