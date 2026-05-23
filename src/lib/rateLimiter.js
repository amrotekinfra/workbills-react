/**
 * Rate limiting utility to prevent brute force attacks.
 * Tracks failed attempts per email using sessionStorage (cleared on browser close).
 */

const RATE_LIMIT_KEY = 'wb_rate_limit'
const MAX_ATTEMPTS = 5
const LOCK_DURATION_MINUTES = 15
const LOCK_DURATION_MS = LOCK_DURATION_MINUTES * 60 * 1000

/**
 * Get rate limit data for an email
 * @returns {{attempts: number, lockedUntil: number?}}
 */
const getRateLimitData = (email) => {
  try {
    const data = sessionStorage.getItem(RATE_LIMIT_KEY)
    const store = data ? JSON.parse(data) : {}
    return store[email] || { attempts: 0 }
  } catch {
    return { attempts: 0 }
  }
}

/**
 * Save rate limit data
 */
const setRateLimitData = (email, data) => {
  try {
    const store = JSON.parse(sessionStorage.getItem(RATE_LIMIT_KEY) || '{}')
    store[email] = data
    sessionStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(store))
  } catch (e) {
    console.error('[RateLimiter] Failed to save data')
  }
}

/**
 * Check if email is rate limited
 * @returns {{limited: boolean, attemptsRemaining: number, minutesRemaining?: number}}
 */
export const checkRateLimit = (email) => {
  if (!email) return { limited: false, attemptsRemaining: MAX_ATTEMPTS }

  const data = getRateLimitData(email)
  const now = Date.now()

  // Check if lock has expired
  if (data.lockedUntil && data.lockedUntil < now) {
    setRateLimitData(email, { attempts: 0 })
    return { limited: false, attemptsRemaining: MAX_ATTEMPTS }
  }

  // Check if currently locked
  if (data.lockedUntil) {
    const minutesRemaining = Math.ceil((data.lockedUntil - now) / 60000)
    return {
      limited: true,
      attemptsRemaining: 0,
      minutesRemaining
    }
  }

  const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - data.attempts)
  return {
    limited: false,
    attemptsRemaining
  }
}

/**
 * Record a failed attempt
 * Locks after MAX_ATTEMPTS failures
 */
export const recordFailedAttempt = (email) => {
  if (!email) return

  const data = getRateLimitData(email)
  data.attempts = (data.attempts || 0) + 1

  // Lock if max attempts reached
  if (data.attempts >= MAX_ATTEMPTS) {
    data.lockedUntil = Date.now() + LOCK_DURATION_MS
  }

  setRateLimitData(email, data)
}

/**
 * Reset rate limit for email (call on successful login/registration)
 */
export const resetRateLimit = (email) => {
  if (!email) return
  setRateLimitData(email, { attempts: 0 })
}

/**
 * Clear all rate limit data (for testing or manual reset)
 */
export const clearAllRateLimits = () => {
  try {
    sessionStorage.removeItem(RATE_LIMIT_KEY)
  } catch (e) {
    console.error('[RateLimiter] Failed to clear data')
  }
}

/**
 * Get formatted countdown string for display
 * @param {number} minutesRemaining
 * @returns {string} e.g., "14:32"
 */
export const getCountdownString = (minutesRemaining) => {
  if (!minutesRemaining || minutesRemaining <= 0) return '0:00'
  const mins = Math.floor(minutesRemaining)
  const secs = Math.round((minutesRemaining - mins) * 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}
