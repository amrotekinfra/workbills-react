import {
  checkRateLimit,
  recordFailedAttempt,
  resetRateLimit,
  clearAllRateLimits,
  getCountdownString
} from '../lib/rateLimiter'

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value },
    removeItem: (key) => { delete store[key] },
    clear: () => { store = {} }
  }
})()
Object.defineProperty(window, 'sessionStorage', { value: sessionStorageMock })

describe('Rate Limiter', () => {
  beforeEach(() => {
    clearAllRateLimits()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('initializes with no limit for new email', () => {
    const result = checkRateLimit('new@example.com')

    expect(result.limited).toBe(false)
    expect(result.attemptsRemaining).toBe(5)
    expect(result.minutesRemaining).toBeUndefined()
  })

  test('tracks failed attempts', () => {
    const email = 'user@example.com'

    recordFailedAttempt(email)
    let result = checkRateLimit(email)
    expect(result.attemptsRemaining).toBe(4)

    recordFailedAttempt(email)
    result = checkRateLimit(email)
    expect(result.attemptsRemaining).toBe(3)
  })

  test('locks after 5 failed attempts', () => {
    const email = 'attacker@example.com'

    // Make 5 attempts
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(email)
    }

    const result = checkRateLimit(email)
    expect(result.limited).toBe(true)
    expect(result.attemptsRemaining).toBe(0)
    expect(result.minutesRemaining).toBeGreaterThan(0)
  })

  test('resets rate limit on success', () => {
    const email = 'user@example.com'

    recordFailedAttempt(email)
    recordFailedAttempt(email)

    let result = checkRateLimit(email)
    expect(result.attemptsRemaining).toBe(3)

    resetRateLimit(email)
    result = checkRateLimit(email)
    expect(result.attemptsRemaining).toBe(5)
  })

  test('unlocks after time expires', () => {
    const email = 'user@example.com'

    // Make 5 failed attempts to lock
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(email)
    }

    let result = checkRateLimit(email)
    expect(result.limited).toBe(true)

    // Fast forward 15+ minutes
    jest.advanceTimersByTime(15 * 60 * 1000 + 1000)

    result = checkRateLimit(email)
    expect(result.limited).toBe(false)
    expect(result.attemptsRemaining).toBe(5)
  })

  test('countdown string formatting', () => {
    expect(getCountdownString(14.5)).toBe('14:30')
    expect(getCountdownString(1.25)).toBe('1:15')
    expect(getCountdownString(0.5)).toBe('0:30')
    expect(getCountdownString(0)).toBe('0:00')
  })

  test('handles multiple users independently', () => {
    const user1 = 'user1@example.com'
    const user2 = 'user2@example.com'

    recordFailedAttempt(user1)
    recordFailedAttempt(user1)

    let result1 = checkRateLimit(user1)
    let result2 = checkRateLimit(user2)

    expect(result1.attemptsRemaining).toBe(3)
    expect(result2.attemptsRemaining).toBe(5) // Unaffected
  })

  test('clear all rate limits', () => {
    const user1 = 'user1@example.com'
    const user2 = 'user2@example.com'

    recordFailedAttempt(user1)
    recordFailedAttempt(user2)

    clearAllRateLimits()

    let result1 = checkRateLimit(user1)
    let result2 = checkRateLimit(user2)

    expect(result1.attemptsRemaining).toBe(5)
    expect(result2.attemptsRemaining).toBe(5)
  })

  test('handles missing email gracefully', () => {
    const result1 = checkRateLimit('')
    const result2 = checkRateLimit(null)

    expect(result1.limited).toBe(false)
    expect(result2.limited).toBe(false)

    // Should not crash
    recordFailedAttempt('')
    recordFailedAttempt(null)
  })

  test('lock duration is 15 minutes', () => {
    const email = 'user@example.com'

    // Make 5 failed attempts
    for (let i = 0; i < 5; i++) {
      recordFailedAttempt(email)
    }

    const result = checkRateLimit(email)
    const minutesRemaining = result.minutesRemaining

    // Should be approximately 15 minutes
    expect(minutesRemaining).toBeGreaterThan(14)
    expect(minutesRemaining).toBeLessThanOrEqual(15)
  })
})
