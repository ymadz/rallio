export interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  action_url: string | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

export type NotificationType =
  | 'reservation_approved'
  | 'reservation_rejected'
  | 'reservation_cancelled'
  | 'queue_approval_request'
  | 'queue_approval_approved'
  | 'queue_approval_rejected'
  | 'payment_received'
  | 'match_scheduled'
  | 'rating_received'
  | 'general'
