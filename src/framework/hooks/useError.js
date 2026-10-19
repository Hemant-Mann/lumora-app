import { InternalServerError, LumoError } from 'lumora/core/index.js'

/**
 * Lumora error boundary hook.
 * Catches downstream errors and normalizes them:
 * - LumoError subclasses (400/401/403/409/429...) are re-thrown as-is
 * - Everything else becomes an InternalServerError with the original error as cause
 * @returns {Function} Lumora hook function (func) => (props) => ...
 */
export const useError = () => (func) => async (props) => {
  try {
    return await func(props)
  } catch (error) {
    if (error instanceof LumoError) {
      throw error
    }
    console.error('Unhandled error:', error)
    throw new InternalServerError(error.message || 'Internal server error', { key: 'err.internal', cause: error })
  }
}
