/**
 * Build a user event document from args
 * @param {Object} args - Event data (user_id, action, metadata)
 * @returns {Object} Event document ready for insert
 */
export const buildEventData = (args) => ({
  user_id: args.user_id,
  action: args.action,
  metadata: args.metadata || {},
  created_at: new Date(),
})
