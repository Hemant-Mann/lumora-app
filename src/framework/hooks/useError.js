import { BadRequestError, InternalServerError } from 'lumora/core/index.js'

/**
 * Lumora error boundary hook.
 * Catches downstream errors and normalizes them:
 * - BadRequestError is re-thrown as-is (expected validation errors)
 * - Everything else becomes an InternalServerError with the original error as cause
 * @returns {Function} Lumora hook function (func) => (props) => ...
 */
export const useError = () => (func) => async (props) => {
  try {
    return await func(props)
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error
    }
    console.error('Unhandled error:', error)
    throw new InternalServerError(error.message || 'Internal server error', { cause: error })
  }
}
