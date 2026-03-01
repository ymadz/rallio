import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'

/**
 * Interface for Dev Settings record
 */
interface DevSetting {
    key: string
    value: any
    updated_at: string
}

/**
 * Get the current time offset from the database.
 * Cached per request to avoid multiple DB calls.
 */
// Using React cache to memoize the offset fetch within a single request lifecycle
const getTimeOffset = cache(async (): Promise<number> => {
    // Production safeguard - always return 0
    if (process.env.NODE_ENV !== 'development') {
        return 0
    }

    try {
        const supabase = await createClient()
        const { data, error } = await supabase
            .from('dev_settings')
            .select('value')
            .eq('key', 'time_offset_ms')
            .single()

        if (error || !data) {
            if (error?.code !== 'PGRST116') { // Ignore "no rows returned" errors
                console.warn('[TimeServer] Failed to fetch time offset:', error)
            }
            return 0
        }

        // Value is stored as JSONB, so we might need to parse it if it comes back as string
        // but supabase-js usually handles JSONB typing well.
        // Based on insertion, value is number.
        return Number(data.value) || 0
    } catch (err) {
        console.error('[TimeServer] Unexpected error fetching time offset:', err)
        return 0
    }
})

/**
 * Get the current server time, accounting for any dev simulation offset.
 */
export async function getServerNow(): Promise<Date> {
    const offset = await getTimeOffset()
    return new Date(Date.now() + offset)
}

/**
 * Set the server time offset (Dev Only).
 * @param offsetMs Number of milliseconds to offset from real time
 */
export async function setServerTimeOffset(offsetMs: number): Promise<boolean> {
    if (process.env.NODE_ENV !== 'development') {
        console.warn('[TimeServer] Cannot set time offset in production')
        return false
    }

    try {
        const supabase = await createClient()
        const { error } = await supabase
            .from('dev_settings')
            .upsert({
                key: 'time_offset_ms',
                value: offsetMs,
                updated_at: new Date().toISOString()
            })

        if (error) {
            console.error('[TimeServer] Failed to update time offset:', error)
            return false
        }

        return true
    } catch (err) {
        console.error('[TimeServer] Unexpected error setting time offset:', err)
        return false
    }
}
