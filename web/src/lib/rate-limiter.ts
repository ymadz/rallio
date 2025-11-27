/**
 * Rate Limiting System
 *
 * Provides in-memory rate limiting for server actions to prevent abuse.
 * In production, consider using Redis for distributed rate limiting.
 */

export interface RateLimitConfig {
  maxAttempts: number  // Maximum number of attempts allowed
  windowMs: number     // Time window in milliseconds
  identifier: string   // Unique identifier (userId, IP, sessionId)
  action: string       // Action name (e.g., 'join_queue', 'leave_queue')
}

export interface RateLimitResult {
  allowed: boolean     // Whether the action is allowed
  remaining: number    // Remaining attempts in current window
  resetAt: Date        // When the rate limit window resets
  retryAfter?: number  // Seconds to wait before retry (if blocked)
}

interface RateLimitEntry {
  count: number
  resetAt: number
}

/**
 * In-memory store for rate limit tracking
 * Key format: "action:identifier"
 *
 * PRODUCTION NOTE: Replace with Redis for distributed systems:
 * - Use Redis INCR with EXPIRE for atomic operations
 * - Use Redis TTL for automatic cleanup
 * - Enable cross-server rate limiting
 */
const rateLimitStore = new Map<string, RateLimitEntry>()

/**
 * Track rate limit violations for monitoring and alerting
 */
interface ViolationLog {
  timestamp: Date
  action: string
  identifier: string
  attemptCount: number
}

const violationLogs: ViolationLog[] = []
const MAX_VIOLATION_LOGS = 1000 // Keep last 1000 violations

/**
 * Check if an action is rate limited
 *
 * @param config - Rate limit configuration
 * @returns Result indicating if action is allowed and rate limit status
 */
export async function checkRateLimit(config: RateLimitConfig): Promise<RateLimitResult> {
  const key = `${config.action}:${config.identifier}`
  const now = Date.now()

  // Clean up expired entry if exists
  const existing = rateLimitStore.get(key)
  if (existing && existing.resetAt < now) {
    rateLimitStore.delete(key)
  }

  const current = rateLimitStore.get(key)

  if (!current) {
    // First attempt in window - create new entry
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    })

    console.log(`✅ [RateLimit] ${config.action} allowed for ${config.identifier.slice(0, 8)}... (1/${config.maxAttempts})`)

    return {
      allowed: true,
      remaining: config.maxAttempts - 1,
      resetAt: new Date(now + config.windowMs),
    }
  }

  if (current.count >= config.maxAttempts) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((current.resetAt - now) / 1000)

    // Log violation for monitoring
    logViolation({
      timestamp: new Date(),
      action: config.action,
      identifier: config.identifier,
      attemptCount: current.count,
    })

    console.warn(`❌ [RateLimit] ${config.action} BLOCKED for ${config.identifier.slice(0, 8)}... (${current.count}/${config.maxAttempts}). Retry after ${retryAfter}s`)

    return {
      allowed: false,
      remaining: 0,
      resetAt: new Date(current.resetAt),
      retryAfter,
    }
  }

  // Increment count
  current.count++
  rateLimitStore.set(key, current)

  console.log(`✅ [RateLimit] ${config.action} allowed for ${config.identifier.slice(0, 8)}... (${current.count}/${config.maxAttempts})`)

  return {
    allowed: true,
    remaining: config.maxAttempts - current.count,
    resetAt: new Date(current.resetAt),
  }
}

/**
 * Log a rate limit violation for monitoring
 */
function logViolation(violation: ViolationLog) {
  violationLogs.push(violation)

  // Keep only last MAX_VIOLATION_LOGS entries
  if (violationLogs.length > MAX_VIOLATION_LOGS) {
    violationLogs.shift()
  }
}

/**
 * Get recent rate limit violations (for admin monitoring)
 *
 * @param limit - Maximum number of violations to return
 * @returns Array of recent violations
 */
export function getRecentViolations(limit: number = 100): ViolationLog[] {
  return violationLogs.slice(-limit)
}

/**
 * Get rate limit status for a specific action/identifier without incrementing
 *
 * @param action - Action name
 * @param identifier - Unique identifier
 * @returns Current rate limit status or null if no entry exists
 */
export function getRateLimitStatus(
  action: string,
  identifier: string
): { count: number; resetAt: Date; remaining: number } | null {
  const key = `${action}:${identifier}`
  const now = Date.now()

  const entry = rateLimitStore.get(key)

  if (!entry) {
    return null
  }

  // Entry expired
  if (entry.resetAt < now) {
    rateLimitStore.delete(key)
    return null
  }

  return {
    count: entry.count,
    resetAt: new Date(entry.resetAt),
    remaining: Math.max(0, 10 - entry.count), // Assume max 10 for display
  }
}

/**
 * Manually reset rate limit for a specific action/identifier
 * Useful for testing or admin overrides
 *
 * @param action - Action name
 * @param identifier - Unique identifier
 */
export function resetRateLimit(action: string, identifier: string): void {
  const key = `${action}:${identifier}`
  rateLimitStore.delete(key)
  console.log(`🔄 [RateLimit] Reset for ${action}:${identifier.slice(0, 8)}...`)
}

/**
 * Clear all expired rate limit entries
 * Called automatically via interval
 */
function cleanupExpiredEntries() {
  const now = Date.now()
  let cleanedCount = 0

  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key)
      cleanedCount++
    }
  }

  if (cleanedCount > 0) {
    console.log(`🧹 [RateLimit] Cleaned up ${cleanedCount} expired entries`)
  }
}

/**
 * Periodic cleanup of expired entries
 * Runs every minute to prevent memory leaks
 */
setInterval(() => {
  cleanupExpiredEntries()
}, 60000) // Every 60 seconds

/**
 * Pre-configured rate limit configs for common actions
 */
export const RATE_LIMITS = {
  // Queue actions
  JOIN_QUEUE: { maxAttempts: 5, windowMs: 60000 }, // 5 joins per minute
  LEAVE_QUEUE: { maxAttempts: 3, windowMs: 60000 }, // 3 leaves per minute

  // Match actions
  ASSIGN_MATCH: { maxAttempts: 2, windowMs: 60000 }, // 2 assignments per minute
  START_MATCH: { maxAttempts: 5, windowMs: 60000 }, // 5 starts per minute
  RECORD_SCORE: { maxAttempts: 10, windowMs: 60000 }, // 10 score records per minute

  // Queue Master actions
  CREATE_SESSION: { maxAttempts: 3, windowMs: 300000 }, // 3 creates per 5 minutes
  UPDATE_SESSION: { maxAttempts: 10, windowMs: 60000 }, // 10 updates per minute
  REMOVE_PARTICIPANT: { maxAttempts: 5, windowMs: 60000 }, // 5 removals per minute

  // Payment actions
  INITIATE_PAYMENT: { maxAttempts: 5, windowMs: 300000 }, // 5 initiations per 5 minutes

  // Default fallback
  DEFAULT: { maxAttempts: 10, windowMs: 60000 }, // 10 actions per minute
} as const

/**
 * Helper function to create rate limit config with action name
 */
export function createRateLimitConfig(
  action: keyof typeof RATE_LIMITS,
  identifier: string
): RateLimitConfig {
  const limits = RATE_LIMITS[action]

  return {
    action,
    identifier,
    maxAttempts: limits.maxAttempts,
    windowMs: limits.windowMs,
  }
}

/**
 * Export store size for monitoring
 */
export function getRateLimitStats() {
  return {
    storeSize: rateLimitStore.size,
    violationCount: violationLogs.length,
  }
}
