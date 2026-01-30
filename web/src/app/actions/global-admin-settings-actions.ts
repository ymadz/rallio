'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { logAdminAction } from './global-admin-actions'

/**
 * Verify user is a global admin
 */
async function verifyGlobalAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role:roles(name)')
    .eq('user_id', user.id)
    .eq('role.name', 'global_admin')
    .single()

  if (!roles) {
    throw new Error('Unauthorized - Global admin access required')
  }

  return { user, supabase }
}

/**
 * Get all platform settings (admin only)
 */
export async function getAllPlatformSettings() {
  try {
    const { supabase } = await verifyGlobalAdmin()

    const { data, error } = await supabase
      .from('platform_settings')
      .select('*')
      .order('setting_key', { ascending: true })

    if (error) throw error

    // Transform array to object for easier access
    const settings = data.reduce((acc: any, setting: any) => {
      acc[setting.setting_key] = {
        ...setting.setting_value,
        _id: setting.id,
        _updated_at: setting.updated_at,
        _description: setting.description
      }
      return acc
    }, {})

    return { success: true, settings }
  } catch (error: any) {
    console.error('Error fetching platform settings:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Get public settings (no auth required - for T&C, refund policy display)
 */
export async function getPublicSettings(settingKey?: string) {
  try {
    const supabase = await createClient()

    if (settingKey) {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('setting_key, setting_value, updated_at')
        .eq('is_public', true)
        .eq('setting_key', settingKey)
        .single()

      if (error) throw error
      return { success: true, data }
    } else {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('setting_key, setting_value, updated_at')
        .eq('is_public', true)

      if (error) throw error
      return { success: true, data }
    }
  } catch (error: any) {
    console.error('Error fetching public settings:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update platform fee settings
 */
export async function updatePlatformFee(percentage: number, enabled: boolean, description?: string) {
  try {
    const { supabase, user } = await verifyGlobalAdmin()

    if (percentage < 0 || percentage > 100) {
      return { success: false, error: 'Fee percentage must be between 0 and 100' }
    }

    const { data: oldSetting } = await supabase
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'platform_fee')
      .single()

    const newValue = {
      percentage,
      enabled,
      description: description || `Platform service fee: ${percentage}%`
    }

    const { error } = await supabase
      .from('platform_settings')
      .update({
        setting_value: newValue,
        updated_by: user.id
      })
      .eq('setting_key', 'platform_fee')

    if (error) throw error

    await logAdminAction({
      actionType: 'SETTINGS_UPDATE',
      targetType: 'platform_settings',
      targetId: 'platform_fee',
      oldValue: oldSetting?.setting_value,
      newValue
    })

    revalidatePath('/admin/settings')
    return { success: true, message: 'Platform fee updated successfully' }
  } catch (error: any) {
    console.error('Error updating platform fee:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update terms and conditions
 */
export async function updateTermsAndConditions(content: string) {
  try {
    const { supabase, user } = await verifyGlobalAdmin()

    if (!content || content.trim().length === 0) {
      return { success: false, error: 'Content cannot be empty' }
    }

    const { data: oldSetting } = await supabase
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'terms_and_conditions')
      .single()

    const newValue = {
      content: content.trim(),
      last_updated: new Date().toISOString()
    }

    const { error } = await supabase
      .from('platform_settings')
      .update({
        setting_value: newValue,
        updated_by: user.id
      })
      .eq('setting_key', 'terms_and_conditions')

    if (error) throw error

    await logAdminAction({
      actionType: 'SETTINGS_UPDATE',
      targetType: 'platform_settings',
      targetId: 'terms_and_conditions',
      oldValue: { content_length: (oldSetting?.setting_value as any)?.content?.length || 0 },
      newValue: { content_length: content.length }
    })

    revalidatePath('/admin/settings')
    revalidatePath('/terms')
    return { success: true, message: 'Terms and conditions updated successfully' }
  } catch (error: any) {
    console.error('Error updating terms and conditions:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update refund policy
 */
export async function updateRefundPolicy(content: string) {
  try {
    const { supabase, user } = await verifyGlobalAdmin()

    if (!content || content.trim().length === 0) {
      return { success: false, error: 'Content cannot be empty' }
    }

    const { data: oldSetting } = await supabase
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'refund_policy')
      .single()

    const newValue = {
      content: content.trim(),
      last_updated: new Date().toISOString()
    }

    const { error } = await supabase
      .from('platform_settings')
      .update({
        setting_value: newValue,
        updated_by: user.id
      })
      .eq('setting_key', 'refund_policy')

    if (error) throw error

    await logAdminAction({
      actionType: 'SETTINGS_UPDATE',
      targetType: 'platform_settings',
      targetId: 'refund_policy',
      oldValue: { content_length: (oldSetting?.setting_value as any)?.content?.length || 0 },
      newValue: { content_length: content.length }
    })

    revalidatePath('/admin/settings')
    revalidatePath('/refund-policy')
    return { success: true, message: 'Refund policy updated successfully' }
  } catch (error: any) {
    console.error('Error updating refund policy:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update general settings
 */
export async function updateGeneralSettings(settings: {
  platform_name?: string
  tagline?: string
  maintenance_mode?: boolean
  contact_email?: string
  contact_phone?: string
}) {
  try {
    const { supabase, user } = await verifyGlobalAdmin()

    const { data: oldSetting } = await supabase
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'general_settings')
      .single()

    const newValue = {
      ...(oldSetting?.setting_value as any),
      ...settings
    }

    const { error } = await supabase
      .from('platform_settings')
      .update({
        setting_value: newValue,
        updated_by: user.id
      })
      .eq('setting_key', 'general_settings')

    if (error) throw error

    await logAdminAction({
      actionType: 'SETTINGS_UPDATE',
      targetType: 'platform_settings',
      targetId: 'general_settings',
      oldValue: oldSetting?.setting_value,
      newValue
    })

    revalidatePath('/admin/settings')
    return { success: true, message: 'General settings updated successfully' }
  } catch (error: any) {
    console.error('Error updating general settings:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update notification settings
 */
export async function updateNotificationSettings(settings: {
  email_notifications?: boolean
  sms_notifications?: boolean
  push_notifications?: boolean
  booking_confirmations?: boolean
  payment_receipts?: boolean
  admin_alerts?: boolean
}) {
  try {
    const { supabase, user } = await verifyGlobalAdmin()

    const { data: oldSetting } = await supabase
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'notification_settings')
      .single()

    const newValue = {
      ...(oldSetting?.setting_value as any),
      ...settings
    }

    const { error } = await supabase
      .from('platform_settings')
      .update({
        setting_value: newValue,
        updated_by: user.id
      })
      .eq('setting_key', 'notification_settings')

    if (error) throw error

    await logAdminAction({
      actionType: 'SETTINGS_UPDATE',
      targetType: 'platform_settings',
      targetId: 'notification_settings',
      oldValue: oldSetting?.setting_value,
      newValue
    })

    revalidatePath('/admin/settings')
    return { success: true, message: 'Notification settings updated successfully' }
  } catch (error: any) {
    console.error('Error updating notification settings:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Update payment settings
 */
export async function updatePaymentSettings(settings: {
  currency?: string
  currency_symbol?: string
  payment_methods?: string[]
  min_booking_amount?: number
  max_booking_amount?: number
}) {
  try {
    const { supabase, user } = await verifyGlobalAdmin()

    const { data: oldSetting } = await supabase
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'payment_settings')
      .single()

    const newValue = {
      ...(oldSetting?.setting_value as any),
      ...settings
    }

    const { error } = await supabase
      .from('platform_settings')
      .update({
        setting_value: newValue,
        updated_by: user.id
      })
      .eq('setting_key', 'payment_settings')

    if (error) throw error

    await logAdminAction({
      actionType: 'SETTINGS_UPDATE',
      targetType: 'platform_settings',
      targetId: 'payment_settings',
      oldValue: oldSetting?.setting_value,
      newValue
    })

    revalidatePath('/admin/settings')
    return { success: true, message: 'Payment settings updated successfully' }
  } catch (error: any) {
    console.error('Error updating payment settings:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Calculate platform fee for a given amount
 */
export async function calculatePlatformFee(amount: number) {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('platform_settings')
      .select('setting_value')
      .eq('setting_key', 'platform_fee')
      .single()

    if (error) throw error

    const feeSettings = data.setting_value as any

    if (!feeSettings.enabled) {
      return {
        success: true,
        platformFee: 0,
        subtotal: amount,
        total: amount,
        feePercentage: 0
      }
    }

    const platformFee = (amount * feeSettings.percentage) / 100
    const total = amount + platformFee

    return {
      success: true,
      platformFee: Math.round(platformFee * 100) / 100, // Round to 2 decimals
      subtotal: amount,
      total: Math.round(total * 100) / 100,
      feePercentage: feeSettings.percentage
    }
  } catch (error: any) {
    console.error('Error calculating platform fee:', error)
    return { success: false, error: error.message }
  }
}
