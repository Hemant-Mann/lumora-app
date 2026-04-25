import { tryit } from 'radash'
import { response } from 'lumora/core/index.js'
import { buildAllowedHeaders, resolveOrigin } from '../cors-utils.js'

/**
 * Wrap a Lumora endpoint with CORS headers.
 * Executes the endpoint, then merges CORS headers into the response.
 * @param {Function} func - Next function in the Lumora hook chain (the endpoint)
 * @param {import('lumora/core').Props} props - Lumora Props object
 * @param {Object} config - CORS configuration
 * @param {string|string[]} [config.origins] - Allowed origins
 * @param {boolean} [config.credentials] - Allow credentials
 * @returns {Promise<Object>} Response object with CORS headers merged
 */
const withCors = async(func, props, config) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': resolveOrigin(props.request.headers.referer, config),
    'Access-Control-Allow-Methods': 'GET, PUT, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': buildAllowedHeaders(config)
  }
  if (config.credentials) {
    corsHeaders['Access-Control-Allow-Credentials'] = 'true'
  }

  const [error, result] = await tryit(func)(props)
  if (error) {
    throw error
  }
  let finalResp = response(error, result)
  return {
    ...finalResp,
    headers: {
      ...(finalResp.headers || {}),
      ...corsHeaders
    }
  }
}

/**
 * Lumora hook that adds CORS headers to the response.
 * Wraps the downstream endpoint and injects Access-Control-Allow-* headers.
 * @param {Object} [config={}] - CORS configuration
 * @param {string|string[]} [config.origins] - Allowed origins (defaults to Referer header)
 * @param {string[]} [config.headers] - Additional allowed headers
 * @param {boolean} [config.credentials] - Allow credentials
 * @param {boolean} [config.strict] - Strict header mode
 * @returns {Function} Lumora hook function (func) => (props) => ...
 */
export const useCors = (config = {}) => (func) => (props) => {
  return withCors(func, props, config)
}
