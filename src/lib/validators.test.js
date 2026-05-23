import {
  sanitizeText,
  validateEmail,
  validateSlug,
  validateAmount,
  sanitizeName,
  sanitizeDescription,
  validateUrl,
  validateFields,
  Validators
} from '../lib/validators'

describe('Validators', () => {
  describe('sanitizeText', () => {
    test('escapes HTML tags', () => {
      expect(sanitizeText('<script>alert("xss")</script>')).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;')
    })

    test('escapes single quotes', () => {
      expect(sanitizeText("O'Brien")).toBe('O&#39;Brien')
    })

    test('trims whitespace', () => {
      expect(sanitizeText('  hello  ')).toBe('hello')
    })

    test('respects max length', () => {
      expect(sanitizeText('hello world', 5)).toBe('hello')
    })

    test('handles empty strings', () => {
      expect(sanitizeText('')).toBe('')
      expect(sanitizeText(null)).toBe('')
    })
  })

  describe('sanitizeName', () => {
    test('sanitizes company names', () => {
      expect(sanitizeName("XYZ Corp & Co. <script>")).toBe('XYZ Corp &amp; Co. &lt;script&gt;')
    })

    test('respects maxLength of 100', () => {
      const long = 'a'.repeat(150)
      expect(sanitizeName(long).length).toBe(100)
    })
  })

  describe('sanitizeDescription', () => {
    test('allows more characters than sanitizeName', () => {
      const desc = 'Visit https://example.com for details (123)'
      const sanitized = sanitizeDescription(desc)
      expect(sanitized).toContain('https://example.com')
    })

    test('escapes HTML but preserves URLs', () => {
      expect(sanitizeDescription('Link: <a>test</a>')).toBe('Link: &lt;a&gt;test&lt;/a&gt;')
    })

    test('respects maxLength of 500', () => {
      const long = 'a'.repeat(600)
      expect(sanitizeDescription(long).length).toBe(500)
    })
  })

  describe('validateEmail', () => {
    test('accepts valid emails', () => {
      expect(validateEmail('user@example.com')).toBe('user@example.com')
      expect(validateEmail('john.doe@company.co.uk')).toBe('john.doe@company.co.uk')
    })

    test('rejects invalid emails', () => {
      expect(validateEmail('notanemail')).toBe('')
      expect(validateEmail('user@')).toBe('')
      expect(validateEmail('@example.com')).toBe('')
    })

    test('converts to lowercase', () => {
      expect(validateEmail('User@EXAMPLE.COM')).toBe('user@example.com')
    })

    test('handles empty input', () => {
      expect(validateEmail('')).toBe('')
      expect(validateEmail(null)).toBe('')
    })
  })

  describe('validateSlug', () => {
    test('accepts valid slugs', () => {
      expect(validateSlug('my-project')).toBe(true)
      expect(validateSlug('project123')).toBe(true)
      expect(validateSlug('a1b2c3')).toBe(true)
    })

    test('rejects invalid slugs', () => {
      expect(validateSlug('-start')).toBe(false) // starts with hyphen
      expect(validateSlug('end-')).toBe(false) // ends with hyphen
      expect(validateSlug('MY-PROJECT')).toBe(false) // uppercase
      expect(validateSlug('my project')).toBe(false) // space
      expect(validateSlug('ab')).toBe(false) // too short
    })

    test('requires minimum 3 characters', () => {
      expect(validateSlug('ab')).toBe(false)
      expect(validateSlug('abc')).toBe(true)
    })
  })

  describe('validateAmount', () => {
    test('accepts positive numbers', () => {
      expect(validateAmount('100')).toBe(100)
      expect(validateAmount('99.99')).toBe(99.99)
      expect(validateAmount(50)).toBe(50)
    })

    test('rejects negative or zero', () => {
      expect(validateAmount('-10')).toBe(0)
      expect(validateAmount('0')).toBe(0)
      expect(validateAmount('-0.01')).toBe(0)
    })

    test('rejects invalid numbers', () => {
      expect(validateAmount('abc')).toBe(0)
      expect(validateAmount('')).toBe(0)
      expect(validateAmount(null)).toBe(0)
    })

    test('handles commas in numbers', () => {
      expect(validateAmount('1,000')).toBe(1000)
      expect(validateAmount('9,999.99')).toBe(9999.99)
    })
  })

  describe('validateUrl', () => {
    test('accepts valid HTTP/HTTPS URLs', () => {
      expect(validateUrl('https://example.com')).toBe(true)
      expect(validateUrl('http://example.com/path')).toBe(true)
    })

    test('rejects invalid URLs', () => {
      expect(validateUrl('not-a-url')).toBe(false)
      expect(validateUrl('ftp://example.com')).toBe(false)
      expect(validateUrl('')).toBe(false)
    })
  })

  describe('Validators helpers', () => {
    test('Validators.required', () => {
      expect(Validators.required('')).toBeTruthy()
      expect(Validators.required('value')).toBeNull()
    })

    test('Validators.email', () => {
      expect(Validators.email('invalid')).toBeTruthy()
      expect(Validators.email('user@example.com')).toBeNull()
    })

    test('Validators.minLength', () => {
      const validator = Validators.minLength(5)
      expect(validator('ab')).toBeTruthy()
      expect(validator('abcde')).toBeNull()
    })

    test('Validators.slug', () => {
      expect(Validators.slug('-invalid')).toBeTruthy()
      expect(Validators.slug('valid-slug')).toBeNull()
    })

    test('Validators.positiveNumber', () => {
      expect(Validators.positiveNumber('0')).toBeTruthy()
      expect(Validators.positiveNumber('100')).toBeNull()
    })
  })

  describe('validateFields batch validator', () => {
    test('validates multiple fields', () => {
      const values = { email: 'invalid', amount: '-10' }
      const rules = {
        email: [Validators.email],
        amount: [Validators.positiveNumber]
      }
      const result = validateFields(values, rules)
      expect(result.isValid).toBe(false)
      expect(result.errors.email).toBeTruthy()
      expect(result.errors.amount).toBeTruthy()
    })

    test('returns valid when all checks pass', () => {
      const values = { email: 'user@example.com', amount: '100' }
      const rules = {
        email: [Validators.email],
        amount: [Validators.positiveNumber]
      }
      const result = validateFields(values, rules)
      expect(result.isValid).toBe(true)
      expect(Object.keys(result.errors).length).toBe(0)
    })
  })
})
