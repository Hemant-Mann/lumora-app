/**
 * Map a user record (DB) to the API response shape
 * @param {Object} user - User record from the database
 * @returns {Object|null} User data for API response
 */
export const responseMapping = (user) => {
  if (!user) return null

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    status: user.status,
    created_at: user.created_at,
    updated_at: user.updated_at,
  }
}

/**
 * Map validated request args to user record fields (API → DB)
 * Only copies fields that were sent, so it works for create and partial update
 * @param {Object} args - Validated request args
 * @returns {Object} User fields for the database
 */
export const bodyMapping = (args) => {
  const mapped = {}

  if (args.name !== undefined) mapped.name = args.name.trim()
  if (args.email !== undefined) mapped.email = args.email
  if (args.status !== undefined) mapped.status = args.status

  return mapped
}
