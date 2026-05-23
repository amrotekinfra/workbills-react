/**
 * Standardized API error handling for Supabase calls.
 * Converts Supabase errors to user-friendly messages.
 */

const ERROR_MESSAGES = {
  // Database errors
  '23505': 'This already exists. Try a different name or ID.',
  '23503': 'Invalid reference. Item may have been deleted.',
  '23502': 'Required field is missing.',
  '42703': 'Server error: invalid data format.',
  'PGRST116': 'Invalid query parameters.',

  // Auth errors
  'AuthApiError': 'Authentication failed. Try signing in again.',
  'invalid_grant': 'Invalid credentials.',
  'user_not_found': 'User not found.',

  // Network errors
  'fetch_error': 'Network error. Check your connection.',
  'network': 'No internet connection.',

  // Generic
  'default': 'Something went wrong. Please try again.',
}

/**
 * Map Supabase error code to user-friendly message
 */
const getUserMessage = (error) => {
  if (!error) return ERROR_MESSAGES.default

  // Check error code (23505 = unique violation, etc.)
  if (error.code) {
    return ERROR_MESSAGES[error.code] || ERROR_MESSAGES.default
  }

  // Check error message
  const message = error.message || ''
  if (message.includes('duplicate') || message.includes('unique')) {
    return ERROR_MESSAGES['23505']
  }
  if (message.includes('not found')) {
    return ERROR_MESSAGES.user_not_found
  }
  if (message.includes('network') || message.includes('offline')) {
    return ERROR_MESSAGES.network
  }

  return ERROR_MESSAGES.default
}

/**
 * Strip sensitive data from error before logging
 */
const sanitizeErrorForLogging = (error) => {
  if (!error) return null

  const sanitized = {
    code: error.code,
    message: error.message,
    status: error.status,
  }

  // Remove user emails, tokens, etc.
  if (sanitized.message) {
    sanitized.message = sanitized.message
      .replace(/[\w\.-]+@[\w\.-]+\.\w+/g, '[email]')
      .replace(/Bearer\s+[^\s]+/g, '[token]')
  }

  return sanitized
}

/**
 * Wrap async API calls with standardized error handling
 * @param {Function} fn - Async function that makes Supabase call
 * @param {string} context - Context for logging (e.g., '[AddEntry] save')
 * @returns {Promise<{success: boolean, data?: any, error?: {code, message}}>}
 */
export const withApiError = async (fn, context = 'API call') => {
  try {
    const result = await fn()

    // Check for Supabase error in response
    if (result?.error) {
      const sanitized = sanitizeErrorForLogging(result.error)
      console.error(`[withApiError] ${context}:`, sanitized)

      if (window.__SENTRY__) {
        window.__SENTRY__.captureException(result.error, {
          level: 'warning',
          tags: { context },
          contexts: { supabase: { error: sanitized } }
        })
      }

      return {
        success: false,
        error: {
          code: result.error.code,
          message: getUserMessage(result.error),
          details: result.error.details
        }
      }
    }

    return {
      success: true,
      data: result.data || result
    }
  } catch (err) {
    const sanitized = sanitizeErrorForLogging(err)
    console.error(`[withApiError] ${context} (exception):`, sanitized)

    if (window.__SENTRY__) {
      window.__SENTRY__.captureException(err, {
        level: 'error',
        tags: { context, type: 'exception' }
      })
    }

    return {
      success: false,
      error: {
        code: 'UNKNOWN',
        message: getUserMessage(err)
      }
    }
  }
}

/**
 * Helper for mutations that just need to know success/failure
 * @param {Function} fn - Async function
 * @param {Function} onError - Toast callback
 * @param {string} context - For logging
 */
export const handleApiMutation = async (fn, onError, context) => {
  const result = await withApiError(fn, context)
  if (!result.success) {
    onError?.(result.error.message)
  }
  return result
}
