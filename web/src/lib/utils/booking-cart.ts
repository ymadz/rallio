import { BookingCartItem } from '@/stores/checkout-store'

/**
 * Merges consecutive time slots for the same court and date into a single continuous booking.
 */
export function mergeCartItems(items: BookingCartItem[]): BookingCartItem[] {
  if (items.length <= 1) return items

  // Sort by courtId, date, then startTime
  const sorted = [...items].sort((a, b) => {
    if (a.courtId !== b.courtId) return a.courtId.localeCompare(b.courtId)
    const dateA = new Date(a.date).getTime()
    const dateB = new Date(b.date).getTime()
    if (dateA !== dateB) return dateA - dateB
    return a.startTime.localeCompare(b.startTime)
  })

  const merged: BookingCartItem[] = []
  let current = { ...sorted[0] }

  for (let i = 1; i < sorted.length; i++) {
    const next = sorted[i]
    
    // Check if they are the same court, same day, same recurrence, and consecutive
    const sameCourt = current.courtId === next.courtId
    const sameDay = new Date(current.date).toDateString() === new Date(next.date).toDateString()
    const sameRecurrence = current.recurrenceWeeks === next.recurrenceWeeks && 
                          JSON.stringify(current.selectedDays) === JSON.stringify(next.selectedDays)
    const consecutive = current.endTime === next.startTime

    if (sameCourt && sameDay && sameRecurrence && consecutive) {
      // Merge: Update the end time of the current block
      current.endTime = next.endTime
    } else {
      // Not consecutive: Push current and start new block
      merged.push(current)
      current = { ...next }
    }
  }
  
  merged.push(current)
  return merged
}
