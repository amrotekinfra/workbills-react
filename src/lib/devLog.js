/**
 * Development-only logger that only outputs in dev mode.
 * Never logs sensitive user data or auth tokens.
 *
 * Usage:
 *   devLog.info('[ComponentName] Something happened')
 *   devLog.error('[ComponentName] Error occurred')
 */

const isDev = import.meta.env.DEV

const createDevLogger = (namespace) => {
  return {
    info: (msg) => {
      if (isDev) console.log(`[${namespace}] ${msg}`)
    },
    error: (msg) => {
      if (isDev) console.error(`[${namespace}] ${msg}`)
    },
    warn: (msg) => {
      if (isDev) console.warn(`[${namespace}] ${msg}`)
    },
  }
}

export const devLog = createDevLogger('WorkBills')
