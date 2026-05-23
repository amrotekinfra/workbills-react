/**
 * Input validation and sanitization utilities.
 * Prevents XSS attacks and validates data format.
 */

/**
 * Sanitize text by escaping HTML and removing dangerous characters
 */
export const sanitizeText = (text, maxLength = 255) => {
  if (!text) return ''
  return String(text)
    .trim()
    .slice(0, maxLength)
    .replace(/[<>\"']/g, char => {
      const map = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
      return map[char]
    })
}

/**
 * Validate and sanitize email
 * @returns {string} Sanitized email or empty if invalid
 */
export const validateEmail = (email) => {
  if (!email) return ''
  const trimmed = String(email).trim().toLowerCase()
  // RFC 5322 simplified
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(trimmed) ? trimmed : ''
}

/**
 * Validate company/project slug
 * @returns {boolean}
 */
export const validateSlug = (slug) => {
  if (!slug || slug.length < 3) return false
  // Lowercase letters, numbers, hyphens only. Cannot start/end with hyphen
  return /^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)
}

/**
 * Validate amount (positive number)
 * @returns {number} Valid amount or 0 if invalid
 */
export const validateAmount = (amount) => {
  const num = parseFloat(amount)
  return isNaN(num) || num <= 0 ? 0 : num
}

/**
 * Sanitize text field (company name, person name, etc.)
 * Allows basic characters, trims, removes HTML
 * @returns {string}
 */
export const sanitizeName = (name, maxLength = 100) => {
  return sanitizeText(name, maxLength)
}

/**
 * Sanitize description/notes
 * Allows more characters than name (URLs, numbers, punctuation)
 * @returns {string}
 */
export const sanitizeDescription = (desc, maxLength = 500) => {
  if (!desc) return ''
  return String(desc)
    .trim()
    .slice(0, maxLength)
    .replace(/[<>"]/g, char => {
      const map = { '<': '&lt;', '>': '&gt;', '"': '&quot;' }
      return map[char]
    })
}

/**
 * Validate URL (for photo uploads)
 * @returns {boolean}
 */
export const validateUrl = (url) => {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Batch validation helper
 * @param {object} values - {fieldName: value, ...}
 * @param {object} rules - {fieldName: [validator, ...], ...}
 * @returns {object} {isValid: bool, errors: {fieldName: message, ...}}
 */
export const validateFields = (values, rules) => {
  const errors = {}

  Object.entries(rules).forEach(([field, validators]) => {
    if (!Array.isArray(validators)) validators = [validators]

    for (const validator of validators) {
      const error = validator(values[field], field)
      if (error) {
        errors[field] = error
        break
      }
    }
  })

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  }
}

/**
 * Predefined validators for common fields
 */
export const Validators = {
  required: (value, fieldName = 'Field') => {
    return !value || String(value).trim() === '' ? `${fieldName} is required` : null
  },

  email: (value) => {
    return value && !validateEmail(value) ? 'Enter a valid email' : null
  },

  minLength: (len) => (value) => {
    return value && String(value).trim().length < len ? `Minimum ${len} characters required` : null
  },

  maxLength: (len) => (value) => {
    return value && String(value).length > len ? `Maximum ${len} characters allowed` : null
  },

  slug: (value) => {
    return value && !validateSlug(value) ? 'Use lowercase letters, numbers, and hyphens only' : null
  },

  positiveNumber: (value) => {
    const num = parseFloat(value)
    return isNaN(num) || num <= 0 ? 'Enter a positive number' : null
  },
}
