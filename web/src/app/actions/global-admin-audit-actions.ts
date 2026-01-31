'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Verify user has global_admin role
 */
async function verifyGlobalAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { success: false, error: 'Not authenticated' }
  }

  const { data: roles } = await supabase
    .from('user_roles')
    .select('roles!inner (name)')
    .eq('user_id', user.id)

  const isGlobalAdmin = roles?.some((r: any) => r.roles?.name === 'global_admin')

  if (!isGlobalAdmin) {
    return { success: false, error: 'Requires global admin role' }
  }

  return { success: true, user }
}

export interface AuditLog {
  id: string
  admin_id: string
  action_type: string
  target_type: string | null
  target_id: string | null
  old_value: any
  new_value: any
  ip_address: string | null
  user_agent: string | null
  created_at: string
  admin: {
    id: string
    full_name: string
    email: string
  }
}

export interface GetAuditLogsParams {
  page?: number
  limit?: number
  actionType?: string
  adminId?: string
  targetType?: string
  startDate?: string
  endDate?: string
  searchTerm?: string
}

/**
 * Get audit logs with filters and pagination
 */
export async function getAuditLogs(params: GetAuditLogsParams = {}) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  const {
    page = 1,
    limit = 50,
    actionType,
    adminId,
    targetType,
    startDate,
    endDate,
    searchTerm,
  } = params

  try {
    let query = supabase
      .from('admin_audit_logs')
      .select(`
        *,
        admin:profiles!admin_id (
          id,
          full_name,
          email
        )
      `, { count: 'exact' })

    // Apply filters
    if (actionType) {
      query = query.eq('action_type', actionType)
    }

    if (adminId) {
      query = query.eq('admin_id', adminId)
    }

    if (targetType) {
      query = query.eq('target_type', targetType)
    }

    if (startDate) {
      query = query.gte('created_at', startDate)
    }

    if (endDate) {
      query = query.lte('created_at', endDate)
    }

    if (searchTerm) {
      query = query.or(`action_type.ilike.%${searchTerm}%,target_type.ilike.%${searchTerm}%`)
    }

    // Apply pagination
    const from = (page - 1) * limit
    const to = from + limit - 1

    const { data: logs, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) throw error

    return {
      success: true,
      logs: logs as AuditLog[],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      }
    }
  } catch (error: any) {
    console.error('[getAuditLogs] Error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get audit log statistics
 */
export async function getAuditStats() {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  try {
    // Total logs count
    const { count: totalLogs } = await supabase
      .from('admin_audit_logs')
      .select('*', { count: 'exact', head: true })

    // Logs in last 24 hours
    const twentyFourHoursAgo = new Date()
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

    const { count: logsLast24h } = await supabase
      .from('admin_audit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', twentyFourHoursAgo.toISOString())

    // Logs in last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    const { count: logsLast7d } = await supabase
      .from('admin_audit_logs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString())

    // Most active admins
    const { data: topAdmins } = await supabase
      .from('admin_audit_logs')
      .select('admin_id, admin:profiles!admin_id(full_name, email)')
      .gte('created_at', sevenDaysAgo.toISOString())

    const adminCounts = topAdmins?.reduce((acc: any, log: any) => {
      const adminId = log.admin_id
      if (!acc[adminId]) {
        acc[adminId] = {
          admin_id: adminId,
          full_name: log.admin?.full_name || 'Unknown',
          email: log.admin?.email || '',
          count: 0
        }
      }
      acc[adminId].count++
      return acc
    }, {})

    const topAdminsList = Object.values(adminCounts || {})
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 5)

    // Most common actions
    const { data: actionData } = await supabase
      .from('admin_audit_logs')
      .select('action_type')
      .gte('created_at', sevenDaysAgo.toISOString())

    const actionCounts = actionData?.reduce((acc: any, log: any) => {
      const action = log.action_type
      acc[action] = (acc[action] || 0) + 1
      return acc
    }, {})

    const topActions = Object.entries(actionCounts || {})
      .map(([action, count]) => ({ action, count }))
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 5)

    return {
      success: true,
      stats: {
        totalLogs: totalLogs || 0,
        logsLast24h: logsLast24h || 0,
        logsLast7d: logsLast7d || 0,
        topAdmins: topAdminsList,
        topActions,
      }
    }
  } catch (error: any) {
    console.error('[getAuditStats] Error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get unique action types for filter dropdown
 */
export async function getActionTypes() {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  try {
    const { data: logs } = await supabase
      .from('admin_audit_logs')
      .select('action_type')

    const uniqueActions = [...new Set(logs?.map(log => log.action_type))].sort()

    return {
      success: true,
      actionTypes: uniqueActions
    }
  } catch (error: any) {
    console.error('[getActionTypes] Error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get unique target types for filter dropdown
 */
export async function getTargetTypes() {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  try {
    const { data: logs } = await supabase
      .from('admin_audit_logs')
      .select('target_type')
      .not('target_type', 'is', null)

    const uniqueTargets = [...new Set(logs?.map(log => log.target_type))].sort()

    return {
      success: true,
      targetTypes: uniqueTargets
    }
  } catch (error: any) {
    console.error('[getTargetTypes] Error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get list of admins for filter dropdown
 */
export async function getAdminList() {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  try {
    const { data: admins } = await supabase
      .from('user_roles')
      .select(`
        user_id,
        profiles!inner (
          id,
          full_name,
          email
        )
      `)
      .eq('roles.name', 'global_admin')

    const adminList = admins?.map((a: any) => ({
      id: a.profiles.id,
      full_name: a.profiles.full_name,
      email: a.profiles.email,
    })) || []

    return {
      success: true,
      admins: adminList
    }
  } catch (error: any) {
    console.error('[getAdminList] Error:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Export audit logs as CSV
 */
export async function exportAuditLogs(params: GetAuditLogsParams = {}) {
  const auth = await verifyGlobalAdmin()
  if (!auth.success) return auth

  const supabase = await createClient()

  try {
    let query = supabase
      .from('admin_audit_logs')
      .select(`
        *,
        admin:profiles!admin_id (
          full_name,
          email
        )
      `)

    // Apply same filters as getAuditLogs
    if (params.actionType) query = query.eq('action_type', params.actionType)
    if (params.adminId) query = query.eq('admin_id', params.adminId)
    if (params.targetType) query = query.eq('target_type', params.targetType)
    if (params.startDate) query = query.gte('created_at', params.startDate)
    if (params.endDate) query = query.lte('created_at', params.endDate)

    const { data: logs, error } = await query
      .order('created_at', { ascending: false })
      .limit(10000) // Max 10k records for export

    if (error) throw error

    // Generate CSV
    const headers = ['Timestamp', 'Admin', 'Action', 'Target Type', 'Target ID', 'Details']
    const rows = logs?.map((log: any) => [
      new Date(log.created_at).toISOString(),
      log.admin?.full_name || 'Unknown',
      log.action_type,
      log.target_type || '-',
      log.target_id || '-',
      JSON.stringify({ old: log.old_value, new: log.new_value })
    ]) || []

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    return {
      success: true,
      csv,
      filename: `audit_logs_${new Date().toISOString().split('T')[0]}.csv`
    }
  } catch (error: any) {
    console.error('[exportAuditLogs] Error:', error)
    return { success: false, error: error.message }
  }
}
