/**
 * PayMongo API Types
 * Based on PayMongo API v1 documentation
 * https://developers.paymongo.com/reference
 */

export type PaymentStatus =
  | 'awaiting_payment_method'
  | 'awaiting_next_action'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export type SourceType = 'gcash' | 'grab_pay' | 'paymaya'

export type PaymentMethodType = 'card' | 'gcash' | 'paymaya' | 'grab_pay'

export interface PayMongoAmount {
  amount: number // In centavos (100 = ₱1.00)
  currency: string // 'PHP'
}

export interface PayMongoSource {
  id: string
  type: 'source'
  attributes: {
    type: SourceType
    amount: number
    currency: string
    redirect: {
      checkout_url: string
      failed: string
      success: string
    }
    status: 'pending' | 'chargeable' | 'cancelled' | 'expired' | 'paid'
    billing?: {
      name?: string
      email?: string
      phone?: string
    }
    created_at: number
    updated_at: number
  }
}

export interface PayMongoPaymentIntent {
  id: string
  type: 'payment_intent'
  attributes: {
    amount: number
    currency: string
    description?: string
    statement_descriptor?: string
    status: PaymentStatus
    client_key: string
    payments: any[]
    next_action?: {
      type: string
      redirect?: {
        url: string
        return_url: string
      }
    }
    payment_method_allowed: PaymentMethodType[]
    payment_method_options?: {
      card?: {
        request_three_d_secure?: 'any' | 'automatic'
      }
    }
    metadata?: Record<string, any>
    created_at: number
    updated_at: number
  }
}

export interface PayMongoPayment {
  id: string
  type: 'payment'
  attributes: {
    amount: number
    currency: string
    description?: string
    statement_descriptor?: string
    status: 'pending' | 'paid' | 'failed'
    fee: number
    net_amount: number
    source: {
      id: string
      type: SourceType
    }
    billing?: {
      name?: string
      email?: string
      phone?: string
      address?: {
        line1?: string
        line2?: string
        city?: string
        state?: string
        postal_code?: string
        country?: string
      }
    }
    metadata?: Record<string, any>
    paid_at?: number
    created_at: number
    updated_at: number
  }
}

export interface PayMongoWebhookEvent {
  id: string
  type: 'event'
  attributes: {
    type:
    | 'source.chargeable'
    | 'payment.paid'
    | 'payment.failed'
    | 'payment_intent.succeeded'
    | 'payment_intent.payment_failed'
    livemode: boolean
    data: PayMongoSource | PayMongoPayment | PayMongoPaymentIntent
    created_at: number
    updated_at: number
  }
}

export interface CreateSourceParams {
  amount: number // In centavos
  type: SourceType
  currency?: string
  redirect: {
    success: string
    failed: string
  }
  billing?: {
    name?: string
    email?: string
    phone?: string
  }
  metadata?: Record<string, any>
}

export interface CreatePaymentIntentParams {
  amount: number // In centavos
  currency?: string
  description?: string
  statement_descriptor?: string
  payment_method_allowed: PaymentMethodType[]
  metadata?: Record<string, any>
}

export interface CreatePaymentParams {
  amount: number // In centavos
  currency?: string
  description?: string
  statement_descriptor?: string
  source: {
    id: string
    type: 'source' // Always 'source' when creating payment from chargeable source
  }
  metadata?: Record<string, any>
}

export interface PayMongoError {
  errors: Array<{
    code: string
    detail: string
    source?: {
      pointer: string
      attribute: string
    }
  }>
}

export interface PayMongoResponse<T> {
  data: T
}

// =============================================
// REFUND TYPES
// =============================================

export type RefundReason =
  | 'requested_by_customer'
  | 'duplicate'
  | 'fraudulent'

export interface PayMongoRefund {
  id: string
  type: 'refund'
  attributes: {
    amount: number // In centavos
    currency: string
    payment_id: string
    reason: RefundReason
    status: 'pending' | 'succeeded' | 'failed'
    notes?: string
    metadata?: Record<string, any>
    livemode: boolean
    created_at: number
    updated_at: number
  }
}

export interface CreateRefundParams {
  amount: number // In centavos
  payment_id: string // PayMongo payment ID
  reason: RefundReason
  notes?: string
  metadata?: Record<string, any>
}

export interface PayMongoRefundWebhookEvent {
  id: string
  type: 'event'
  attributes: {
    type: 'refund.succeeded' | 'refund.failed' | 'refund.updated'
    livemode: boolean
    data: PayMongoRefund
    created_at: number
    updated_at: number
  }
}
