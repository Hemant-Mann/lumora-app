import jwt from 'jsonwebtoken'
import config from '../../config/index.js'

/**
 * Lumora session hook.
 * Decodes the Bearer JWT from the Authorization header and injects
 * the decoded token into props.auth.
 * If the token is missing or invalid, auth remains empty (unauthenticated).
 * @returns {Function} Lumora hook function (func) => (props) => ...
 */
export const useSession = () => (func) => async (props) => {
  const authHeader = props.request.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  let auth = {}
  if (token) {
    try {
      const decoded = jwt.verify(token, config.jwtSecret)
      auth = { token: decoded, user: decoded }
    } catch (e) {
      // Invalid token — continue as unauthenticated
    }
  }

  return await func({
    ...props,
    auth
  })
}
