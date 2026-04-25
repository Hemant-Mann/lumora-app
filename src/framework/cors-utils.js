import _ from 'lodash'

export const DEFAULT_HEADERS = [
  'X-CSRF-Token',
  'X-Requested-With',
  'Authorization',
  'Accept',
  'Accept-Version',
  'Content-Length',
  'Content-MD5',
  'Content-Type',
  'Date',
  'X-Api-Version',
  'Referer',
  'x-jwt',
  'sec-ch-ua-platform',
  'User-Agent',
  'sec-ch-ua',
  'sec-ch-ua-mobile'
]

/**
 * Build the Access-Control-Allow-Headers string from config
 * @param {Object} config
 * @param {string[]} [config.headers]
 * @param {boolean} [config.strict]
 * @returns {string}
 */
export const buildAllowedHeaders = (config) => {
  if (!config.headers) return DEFAULT_HEADERS.join(', ')
  if (config.headers === '*') return '*'
  return config.strict === true
    ? config.headers.join(', ')
    : _.uniq([...DEFAULT_HEADERS, ...config.headers]).join(', ')
}

/**
 * Resolve the allowed origin from config or referer
 * @param {string|undefined} referer
 * @param {Object} config
 * @param {string|string[]} [config.origins]
 * @returns {string}
 */
export const resolveOrigin = (referer, config) => {
  if (config.origins) {
    return config.origins
  }
  return _.trimEnd(referer || '*', '/')
}
