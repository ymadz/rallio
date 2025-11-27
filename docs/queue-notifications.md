# Queue Notification System

## Overview

The queue notification system provides real-time alerts to players when it's their turn to play or when their position in the queue changes significantly. The system includes in-app banners, browser notifications, and sound alerts.

## Features Implemented

### Phase 1: In-App Notifications (✅ Complete)

#### 1. **useQueueNotifications Hook** (`/web/src/hooks/use-queue-notifications.ts`)

Custom React hook that manages queue notifications with the following capabilities:

**Features:**
- Detects status changes from 'waiting' → 'playing'
- Tracks position improvements (notifies when entering top 3)
- Plays sound notifications using Web Audio API
- Persists notification state in localStorage (30-minute expiry)
- Supports browser push notifications (with permission)
- Prevents duplicate notifications
- Auto-dismisses notifications after viewing

**API:**
```typescript
const {
  notifications,           // Array of active notifications
  dismissNotification,     // Function to dismiss a notification
  clearAllNotifications,   // Clear all notifications
  hasActiveNotifications   // Boolean flag
} = useQueueNotifications(queue, userId)
```

**Notification Types:**
- `turn-now` - Player's status changed to 'playing' (urgent)
- `turn-soon` - Player moved into top 3 positions
- `position-update` - Significant position change
- `removed` - Player removed from queue (future)

#### 2. **QueueNotificationBanner Component** (`/web/src/components/queue/queue-notification-banner.tsx`)

Visual banner component that appears at the top of pages:

**Features:**
- Fixed position at top of screen (below header)
- Color-coded by urgency (green for turn-now, blue for turn-soon)
- Icon variations (AlertCircle, Clock, Bell)
- Dismissible with smooth animations
- Call-to-action button ("Go to Court" or "View Queue")
- Responsive design (mobile-friendly)
- ARIA labels for accessibility

**Props:**
```typescript
interface QueueNotificationBannerProps {
  notifications: QueueNotification[]
  onDismiss: (notificationId: string) => void
}
```

#### 3. **Toast Component** (`/web/src/components/ui/toast.tsx`)

Reusable toast notification component following shadcn/ui patterns:

**Features:**
- Multiple variants (default, success, warning, error)
- Auto-dismiss with configurable duration
- Manual dismiss button
- Smooth animations (slide-in/fade-out)
- Accessible (ARIA live regions)
- Toaster container for multiple toasts

**API:**
```typescript
const { toasts, toast, dismiss } = useToast()

// Create a toast
toast({
  title: "Success!",
  description: "Your action was completed",
  variant: "success",
  duration: 5000
})
```

#### 4. **Sound Notifications**

Audio feedback implemented using Web Audio API:

**Features:**
- Pleasant 800Hz sine wave beep
- Fade in/out envelope (0.3s duration)
- Non-intrusive volume (0.3)
- Works without external audio files
- Graceful fallback if audio fails

#### 5. **Integration Points**

The notification system is integrated into:

1. **Queue Details Page** (`/web/src/app/(main)/queue/[courtId]/queue-details-client.tsx`)
   - Shows notifications for the specific queue
   - Updates in real-time via Supabase subscriptions

2. **Queue Dashboard** (`/web/src/app/(main)/queue/queue-dashboard-client.tsx`)
   - Shows notifications for primary active queue
   - Alerts work even when browsing other queues

## Technical Architecture

### Data Flow

```
1. Database Change (queue_participants.status updated by Queue Master)
   ↓
2. Supabase Realtime → useQueue hook detects change
   ↓
3. useQueueNotifications detects status/position change
   ↓
4. Creates notification object → adds to state
   ↓
5. QueueNotificationBanner renders → plays sound → shows browser notification
   ↓
6. User dismisses → notification marked as dismissed in localStorage
```

### Real-time Updates

The system leverages existing Supabase Realtime subscriptions in `useQueue`:

```typescript
// Subscribes to queue_participants changes
supabase
  .channel(`queue-${queue.id}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'queue_participants',
    filter: `queue_session_id=eq.${queue.id}`
  }, (payload) => {
    fetchQueue() // Triggers re-render → notification check
  })
```

### Notification Detection Logic

```typescript
// In useQueueNotifications
useEffect(() => {
  const userPlayer = queue.players.find(p => p.userId === userId)
  const playerStatus = userPlayer?.status || 'waiting'

  // Detect status change to 'playing'
  if (lastStatus !== playerStatus && playerStatus === 'playing') {
    createNotification('turn-now', "It's Your Turn!", ...)
    playSound()
  }

  // Detect position improvement to top 3
  if (lastPosition > 3 && currentPosition <= 3) {
    createNotification('turn-soon', "Almost Your Turn!", ...)
  }
}, [queue, userId])
```

### localStorage Schema

```typescript
// Key: 'rallio_queue_notifications'
// Value: Array of { id: string, timestamp: number }
[
  { id: "abc123-turn-now-1234567890", timestamp: 1699999999999 },
  { id: "def456-turn-soon-1234567891", timestamp: 1699999999998 }
]

// Auto-cleanup: Notifications older than 30 minutes are removed
```

## Phase 2: Browser Push Notifications (⚠️ Optional - Not Implemented)

### Future Enhancement

To support notifications when the tab is in the background:

1. **Request Permission**
   ```typescript
   Notification.requestPermission().then(permission => {
     if (permission === 'granted') {
       // Show browser notifications
     }
   })
   ```

2. **Create Browser Notification**
   ```typescript
   new Notification("It's Your Turn!", {
     body: "Match assigned at Court A",
     icon: "/icon.png",
     badge: "/badge.png",
     requireInteraction: true
   })
   ```

3. **Service Worker (for persistent notifications)**
   - Requires service worker setup
   - Can receive notifications even when app is closed
   - More complex implementation

**Note:** Currently implemented basic browser notifications (no service worker). Works when tab is open but not active.

## Phase 3: Mobile Push Notifications (⚠️ Future)

### Requirements

For React Native/Expo mobile app:

1. **expo-notifications** setup
2. Push notification token registration
3. Firebase Cloud Messaging (FCM) or APNs integration
4. Backend service to send push notifications
5. Deep linking to queue page when tapped

**Status:** Not implemented (mobile app doesn't have queue features yet)

## Usage Examples

### Example 1: Queue Details Page

```typescript
import { useQueueNotifications } from '@/hooks/use-queue-notifications'
import { QueueNotificationBanner } from '@/components/queue/queue-notification-banner'

function QueueDetailsClient({ courtId }) {
  const { queue } = useQueue(courtId)
  const [userId, setUserId] = useState(null)

  const { notifications, dismissNotification } = useQueueNotifications(queue, userId)

  return (
    <>
      <QueueNotificationBanner
        notifications={notifications}
        onDismiss={dismissNotification}
      />
      {/* Rest of queue details */}
    </>
  )
}
```

### Example 2: Using Toast Notifications

```typescript
import { useToast } from '@/components/ui/toast'

function MyComponent() {
  const { toast } = useToast()

  const handleSuccess = () => {
    toast({
      title: "Joined Queue!",
      description: "You're now #5 in the queue",
      variant: "success"
    })
  }

  return <button onClick={handleSuccess}>Join Queue</button>
}
```

## Configuration

### Sound Settings

Modify sound parameters in `useQueueNotifications.ts`:

```typescript
oscillator.frequency.value = 800  // Hz (pitch)
gainNode.gain.linearRampToValueAtTime(0.3, ...)  // Volume (0-1)
oscillator.stop(context.currentTime + 0.3)  // Duration (seconds)
```

### Notification Expiry

Change expiry duration:

```typescript
const NOTIFICATION_EXPIRY_MS = 30 * 60 * 1000 // 30 minutes
```

### Auto-dismiss Duration

Toast component:

```typescript
<Toast duration={5000} /> // 5 seconds
```

## Testing Guide

### Manual Testing Steps

1. **Join a Queue**
   - Navigate to `/queue/[courtId]`
   - Click "Join Queue"
   - Verify you appear in the player list

2. **Simulate Status Change** (requires Queue Master role)
   - Use Queue Master UI to assign match
   - Update player status to 'playing'
   - OR manually update database:
     ```sql
     UPDATE queue_participants
     SET status = 'playing'
     WHERE user_id = '{your-user-id}'
     AND queue_session_id = '{queue-id}'
     ```

3. **Verify Notification**
   - Notification banner should appear at top
   - Sound should play (beep)
   - Browser notification should appear (if permission granted)
   - Notification should persist in localStorage

4. **Test Dismissal**
   - Click X button on notification
   - Notification should disappear
   - Refresh page - notification should not reappear

5. **Test Position Updates**
   - Have Queue Master assign match to players ahead of you
   - When you move into top 3, notification should trigger

### Automated Testing (Future)

```typescript
// Example test with Jest + React Testing Library
it('should show notification when status changes to playing', async () => {
  const { rerender } = render(<QueueDetails courtId="test" />)

  // Initial state: waiting
  expect(screen.queryByText("It's Your Turn!")).not.toBeInTheDocument()

  // Update queue with status 'playing'
  updateQueue({ status: 'playing' })
  rerender(<QueueDetails courtId="test" />)

  // Should show notification
  await waitFor(() => {
    expect(screen.getByText("It's Your Turn!")).toBeInTheDocument()
  })
})
```

## Troubleshooting

### Notifications Not Appearing

1. **Check Browser Permissions**
   - Open browser console
   - Check `Notification.permission` value
   - Should be "granted" or "default"

2. **Check localStorage**
   - Open DevTools → Application → Local Storage
   - Look for `rallio_queue_notifications`
   - Clear if needed: `localStorage.removeItem('rallio_queue_notifications')`

3. **Check Real-time Subscriptions**
   - Look for console logs: `[useQueue] 🔔 Queue participants changed`
   - Verify Supabase Realtime is enabled
   - Check network tab for websocket connection

4. **Check Status Field**
   - Verify `queue_participants.status` is being updated in database
   - Check `useQueue` is mapping status correctly
   - Look for console logs: `[useQueueNotifications] Checking for changes`

### Sound Not Playing

1. **Browser Autoplay Policy**
   - Some browsers block audio without user interaction
   - User must interact with page first (click, tap)

2. **Audio Context State**
   - Check console for audio errors
   - Web Audio API requires HTTPS in production

### Performance Issues

1. **Too Many Notifications**
   - Increase `NOTIFICATION_EXPIRY_MS` to clean up faster
   - Implement notification grouping/batching

2. **Memory Leaks**
   - Ensure audio elements are properly disposed
   - Check for unmounted component subscriptions

## Future Enhancements

### Priority: High
- [ ] Queue Master removed player notification
- [ ] Session closed/cancelled notification
- [ ] Payment reminder notifications

### Priority: Medium
- [ ] Browser push notifications with service worker
- [ ] Notification preferences UI (enable/disable sounds)
- [ ] Custom notification sounds (upload MP3/WAV)
- [ ] Notification history page

### Priority: Low
- [ ] Email notifications
- [ ] SMS notifications (Twilio/Semaphore)
- [ ] Mobile push notifications (Expo)
- [ ] In-app notification center with badge count

## Performance Considerations

- **localStorage**: Limited to ~5-10MB, cleanup old entries regularly
- **Sound Generation**: Web Audio API is efficient, no external files needed
- **Re-renders**: useQueueNotifications uses refs to minimize re-renders
- **Subscriptions**: Properly cleaned up in useEffect cleanup functions

## Security Considerations

- **XSS Prevention**: All notification content is sanitized (React escapes by default)
- **Permission Abuse**: Browser notifications require explicit user permission
- **Data Privacy**: No sensitive data in browser notifications (only court names)

## Related Files

- `/web/src/hooks/use-queue-notifications.ts` - Main notification logic
- `/web/src/components/queue/queue-notification-banner.tsx` - Banner UI
- `/web/src/components/ui/toast.tsx` - Toast component
- `/web/src/hooks/use-queue.ts` - Queue data with real-time updates
- `/web/src/app/(main)/queue/[courtId]/queue-details-client.tsx` - Integration
- `/web/src/app/(main)/queue/queue-dashboard-client.tsx` - Integration

## Changelog

### 2025-11-27
- ✅ Implemented useQueueNotifications hook
- ✅ Created QueueNotificationBanner component
- ✅ Added Toast UI component
- ✅ Integrated sound notifications
- ✅ Added localStorage persistence
- ✅ Integrated into queue details and dashboard pages
- ✅ Added browser notification support (basic)

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review console logs (prefix: `[useQueueNotifications]`)
3. Verify database schema includes `queue_participants.status` field
4. Ensure Supabase Realtime is enabled for queue_participants table
