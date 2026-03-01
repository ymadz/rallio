import { createServiceClient } from '@/lib/supabase/service'

export type AuditAction =
    | 'reservation.created'
    | 'reservation.cancelled'
    | 'reservation.rescheduled'
    | 'reservation.admin_cancelled'
    | 'reservation.approved'
    | 'reservation.payment_confirmed'
    | 'refund.requested'
    | 'refund.approved'
    | 'refund.rejected'
    | 'queue.joined'
    | 'queue.left'
    | 'queue.session_created'
    | 'queue.session_cancelled'
    | 'queue.session_closed'

export type AuditResourceType =
    | 'reservation'
    | 'refund'
    | 'queue_session'
    | 'queue_participant'

export interface AuditLogParams {
    userId: string
    action: AuditAction
    resourceType: AuditResourceType
    resourceId: string
    oldValues?: Record<string, any>
    newValues?: Record<string, any>
}

/**
 * Write an audit log entry using the service client (bypasses RLS).
 * This is a fire-and-forget — failures are logged to console but never
 * allowed to break the calling action.
 */
export async function writeAuditLog(params: AuditLogParams): Promise<void> {
    try {
        const supabase = createServiceClient()
        const { error } = await supabase.from('audit_logs').insert({
            user_id: params.userId,
            action: params.action,
            resource_type: params.resourceType,
            resource_id: params.resourceId,
            old_values: params.oldValues ?? null,
            new_values: params.newValues ?? null,
        })
        if (error) {
            console.error('[AuditLog] Failed to write audit log:', error.message, params)
        }
    } catch (err) {
        console.error('[AuditLog] Unexpected error writing audit log:', err)
    }
}
