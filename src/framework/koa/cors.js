import { buildAllowedHeaders, resolveOrigin } from '../cors-utils.js'

/**
 * Koa CORS middleware.
 * Handles preflight OPTIONS requests and sets CORS headers.
 * @param {Object} [config={}] - CORS configuration
 * @param {string|string[]} [config.origins] - Allowed origins (defaults to Referer header)
 * @param {string[]} [config.allowedMethods] - Allowed HTTP methods
 * @param {string[]} [config.headers] - Additional allowed headers
 * @param {boolean} [config.credentials] - Allow credentials
 * @param {boolean} [config.strict] - Strict header mode
 * @returns {Function} Koa middleware function (ctx, next)
 */
export const useCors = (config = {}) => {
  return async (ctx, next) => {
    // Handle preflight OPTIONS requests
    if (ctx.method === 'OPTIONS') {
      ctx.vary('Origin')
      ctx.set('Access-Control-Allow-Origin', resolveOrigin(ctx.get('Referer'), config))
      ctx.set('Access-Control-Allow-Methods', (config.allowedMethods || ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']).join(','))
      ctx.set('Access-Control-Allow-Headers', buildAllowedHeaders(config))
      if (config.credentials) {
        ctx.set('Access-Control-Allow-Credentials', 'true')
      }
      ctx.status = 204
      return
    }
    await next()
  }
}
