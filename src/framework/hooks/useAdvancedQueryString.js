import { z as zod } from 'zod'
import { withQueryString } from 'lumora/use-query-string/useQueryString.js'
import { isFunction } from 'radash'

/**
 * Lumora hook that validates query string parameters with a Zod schema.
 * Wraps lumora's withQueryString to support both a static schema
 * and a dynamic schema builder function.
 * @param {Function|import('zod').ZodObject} shapeMaker - Zod schema builder function (receives zod, args)
 *   or a pre-built ZodObject
 * @returns {Function} Lumora hook function (func) => (props) => ...
 */
export const useAdvancedQueryString = (shapeMaker) => (func) => {
  return (props) => {
    const model = isFunction(shapeMaker)
      ? zod.object(shapeMaker(zod, props.args))
      : shapeMaker
    return withQueryString(func, model, props)
  }
}
