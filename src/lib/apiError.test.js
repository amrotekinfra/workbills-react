import { withApiError, handleApiMutation } from '../lib/apiError'

describe('withApiError', () => {
  test('returns success with data on successful call', async () => {
    const mockFn = jest.fn().mockResolvedValue({ data: { id: 1, name: 'Test' } })
    const result = await withApiError(mockFn, '[Test]')

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ id: 1, name: 'Test' })
    expect(result.error).toBeUndefined()
  })

  test('returns error when API returns error object', async () => {
    const mockError = { code: '23505', message: 'Unique constraint violated' }
    const mockFn = jest.fn().mockResolvedValue({ error: mockError })
    const result = await withApiError(mockFn, '[Test]')

    expect(result.success).toBe(false)
    expect(result.error.code).toBe('23505')
    expect(result.error.message).toContain('already exists')
  })

  test('maps error codes to user-friendly messages', async () => {
    const testCases = [
      { code: '23505', expectedMsg: 'already exists' },
      { code: '23503', expectedMsg: 'Invalid reference' },
      { code: '23502', expectedMsg: 'Required field' },
    ]

    for (const testCase of testCases) {
      const mockFn = jest.fn().mockResolvedValue({
        error: { code: testCase.code, message: 'DB Error' }
      })
      const result = await withApiError(mockFn, '[Test]')
      expect(result.error.message).toContain(testCase.expectedMsg)
    }
  })

  test('catches and handles exceptions', async () => {
    const mockError = new Error('Network error')
    const mockFn = jest.fn().mockRejectedValue(mockError)
    const result = await withApiError(mockFn, '[Test]')

    expect(result.success).toBe(false)
    expect(result.error.code).toBe('UNKNOWN')
    expect(result.error.message).toBeTruthy()
  })

  test('sanitizes sensitive data in errors', async () => {
    const mockError = {
      message: 'Failed for user@example.com with token Bearer abc123',
      code: 'TEST'
    }
    const mockFn = jest.fn().mockResolvedValue({ error: mockError })

    // Mock console.error to capture what's logged
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

    const result = await withApiError(mockFn, '[Test]')

    // Check that the logged error is sanitized
    const logged = consoleSpy.mock.calls[0][1]
    expect(logged.message).toContain('[email]')
    expect(logged.message).toContain('[token]')
    expect(logged.message).not.toContain('user@example.com')
    expect(logged.message).not.toContain('Bearer abc123')

    consoleSpy.mockRestore()
  })

  test('detects errors from message content', async () => {
    const mockFn = jest.fn().mockResolvedValue({
      error: { message: 'duplicate key value' }
    })
    const result = await withApiError(mockFn, '[Test]')

    expect(result.success).toBe(false)
    expect(result.error.message).toContain('already exists')
  })

  test('handles network errors', async () => {
    const mockFn = jest.fn().mockResolvedValue({
      error: { message: 'network timeout' }
    })
    const result = await withApiError(mockFn, '[Test]')

    expect(result.success).toBe(false)
    expect(result.error.message.toLowerCase()).toContain('connection')
  })
})

describe('handleApiMutation', () => {
  test('calls onError callback on failure', async () => {
    const mockFn = jest.fn().mockResolvedValue({
      error: { code: '23505', message: 'Duplicate' }
    })
    const onError = jest.fn()

    await handleApiMutation(mockFn, onError, '[Test]')

    expect(onError).toHaveBeenCalledWith(expect.stringContaining('already exists'))
  })

  test('does not call onError on success', async () => {
    const mockFn = jest.fn().mockResolvedValue({ data: { success: true } })
    const onError = jest.fn()

    await handleApiMutation(mockFn, onError, '[Test]')

    expect(onError).not.toHaveBeenCalled()
  })

  test('returns the full result object', async () => {
    const mockFn = jest.fn().mockResolvedValue({
      data: { id: 1, name: 'Item' }
    })

    const result = await handleApiMutation(mockFn, () => {}, '[Test]')

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ id: 1, name: 'Item' })
  })
})
