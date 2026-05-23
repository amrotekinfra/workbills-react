/**
 * Sentry error monitoring initialization
 * Only initializes if VITE_SENTRY_DSN is configured
 */

let sentryInitialized = false

/**
 * Initialize Sentry for error tracking
 * Call this in main.jsx before ReactDOM.render()
 */
export const initSentry = () => {
  if (sentryInitialized) return
  if (!import.meta.env.VITE_SENTRY_DSN) return

  try {
    const Sentry = window.__SENTRY_IMPORT__
    if (!Sentry) {
      console.warn('[Sentry] Module not loaded. Install @sentry/react.')
      return
    }

    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: import.meta.env.MODE || 'development',
      tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,

      // Strip sensitive data before sending
      beforeSend(event, hint) {
        // Remove user emails from all fields
        const sanitize = (str) => {
          if (typeof str !== 'string') return str
          return str
            .replace(/[\w\.-]+@[\w\.-]+\.\w+/g, '[email]')
            .replace(/Bearer\s+[^\s]+/g, '[token]')
            .replace(/company[_-]?id[:\s"'=]+[\w-]+/gi, 'company_id=[redacted]')
        }

        // Sanitize message
        if (event.message) {
          event.message = sanitize(event.message)
        }

        // Sanitize exception
        if (event.exception?.values) {
          event.exception.values.forEach(ex => {
            if (ex.value) ex.value = sanitize(ex.value)
          })
        }

        // Sanitize breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs.forEach(crumb => {
            if (crumb.message) crumb.message = sanitize(crumb.message)
            if (crumb.data) {
              Object.keys(crumb.data).forEach(key => {
                crumb.data[key] = sanitize(String(crumb.data[key]))
              })
            }
          })
        }

        // Remove PII tags
        if (event.tags) {
          delete event.tags.email
          delete event.tags.user_email
          delete event.tags.user_id
        }

        return event
      },

      // Only track production and staging
      ignoreErrors: [
        // Random plugins/extensions
        'top.GLOBALS',
        // See: http://toolbar.netvibes.com/modules/facebook/app/index.html
        'fb_xd_fragment',
        // Network errors
        'NetworkError',
      ]
    })

    window.__SENTRY__ = Sentry
    sentryInitialized = true
  } catch (e) {
    console.error('[Sentry] Failed to initialize:', e)
  }
}

/**
 * Capture exception manually
 */
export const captureException = (error, context = {}) => {
  if (!window.__SENTRY__) return
  window.__SENTRY__.captureException(error, { tags: context })
}

/**
 * Capture message
 */
export const captureMessage = (message, level = 'info') => {
  if (!window.__SENTRY__) return
  window.__SENTRY__.captureMessage(message, level)
}
