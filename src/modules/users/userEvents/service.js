import { InternalServerError } from 'lumora/core/index.js'

const MODEL = 'UserEvent'

/**
 * Service hook for UserEvent operations (MongoDB-backed)
 * Demonstrates a sub-module using a different datastore (MongoDB) from its parent (MySQL)
 * @returns {Object} Service map containing userEventSrv
 */
export const useUserEventService = () => ({
  /**
   * UserEvent service — CRUD operations backed by MongoDB
   */
  userEventSrv: {
    /**
     * Create a new user event record in MongoDB
     * @param {Object} params
     * @param {Object} params.services - Injected services (db)
     * @param {Object} params.args - Event data
     * @param {string} params.args.user_id - ID of the user this event belongs to
     * @param {string} params.args.action - Action name (e.g. 'user_created', 'login')
     * @param {Object} [params.args.metadata={}] - Additional event metadata
     * @returns {Promise<Object>} Created event record
     */
    createRecord: async ({ services, args }) => {
      const { db } = services
      const data = {
        user_id: args.user_id,
        action: args.action,
        metadata: args.metadata || {},
        created_at: new Date(),
      }

      const [err, record] = await db.insertOne(MODEL, data)
      if (err) throw new InternalServerError(err.message)
      return record
    },

    /**
     * Find many user event records with pagination and filtering
     * Results are sorted by created_at descending (newest first)
     * @param {Object} params
     * @param {Object} params.services - Injected services (db)
     * @param {Object} params.args - Query args
     * @param {Object} [params.args.filter={}] - Query filter object
     * @param {number} [params.args.page_no=1] - Page number
     * @param {number} [params.args.per_page=10] - Records per page
     * @returns {Promise<[Object[], number]>} Tuple of [records, totalCount]
     */
    findRecords: async ({ services, args }) => {
      const { db } = services
      const { filter = {}, page_no = 1, per_page = 10 } = args

      const [err, records] = await db.selectMany(MODEL, filter, { page_no, per_page, sort: { created_at: -1 } })
      if (err) throw new InternalServerError(err.message)

      const [countErr, total] = await db.count(MODEL, filter)
      if (countErr) throw new InternalServerError(countErr.message)

      return [records, total]
    },

    /**
     * Find a single user event by its MongoDB ObjectId
     * @param {Object} params
     * @param {Object} params.services - Injected services (db)
     * @param {Object} params.args - Request args containing id
     * @param {string} params.args.id - Event _id (MongoDB ObjectId)
     * @returns {Promise<Object|null>} Event record or null
     */
    findById: async ({ services, args }) => {
      const { db } = services
      const [err, record] = await db.selectViaId(MODEL, args.id)
      if (err) throw new InternalServerError(err.message)
      return record
    },
  }
})
