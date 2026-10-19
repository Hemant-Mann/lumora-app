/**
 * Map a user event record (DB) to the API response shape
 * @param {Object} event - UserEvent record from the database
 * @returns {Object|null} Event data for API response
 */
export const responseMapping = (event) => {
  if (!event) return null

  return {
    id: event._id,
    user_id: event.user_id,
    action: event.action,
    metadata: event.metadata,
    created_at: event.created_at,
  }
}
