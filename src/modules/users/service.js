import { InternalServerError, DuplicateEntryError } from 'lumora/core/index.js'
import { useUserEventService } from './userEvents/service.js'
import { MODEL } from './constants.js'

/**
 * Service hook for User operations (MySQL-backed)
 * Also injects the UserEvent sub-module service for MongoDB event logging
 * @returns {Object} Service map containing userSrv and userEventSrv
 */
export const useUserService = () => ({
  /**
   * User service — CRUD operations backed by MySQL
   */
  userSrv: {
    /**
     * Create a new user record in MySQL
     * Auto-generates a 20-char _id and timestamps
     * Throws DuplicateEntryError on unique constraint violations
     * @param {Object} params
     * @param {Object} params.services - Injected services (mysql)
     * @param {Object} params.args - Request args containing body
     * @param {Object} params.args.body - User data (name, email, status)
     * @returns {Promise<Object>} Created user record
     */
    createRecord: async ({ services, args }) => {
      const { mysql } = services
      const data = {
        _id: mysql.generateNewId(),
        ...args.body,
        created_at: new Date(),
        updated_at: new Date(),
      }

      const [err, record] = await mysql.insertOne(MODEL, data)
      if (err) {
        if (mysql.isDuplicateError(err)) {
          throw new DuplicateEntryError('User with this email already exists')
        }
        throw new InternalServerError(err.message)
      }
      return record
    },

    /**
     * Find many user records with pagination and filtering
     * @param {Object} params
     * @param {Object} params.services - Injected services (mysql)
     * @param {Object} params.args - Request args containing filter, page_no, per_page
     * @param {Object} [params.args.filter={}] - Query filter object
     * @param {number} [params.args.page_no=1] - Page number
     * @param {number} [params.args.per_page=10] - Records per page
     * @returns {Promise<[Object[], number]>} Tuple of [records, totalCount]
     */
    findRecords: async ({ services, args }) => {
      const { mysql } = services
      const { filter = {}, page_no = 1, per_page = 10 } = args

      const [err, records] = await mysql.selectMany(MODEL, filter, { page_no, per_page })
      if (err) throw new InternalServerError(err.message)

      const [countErr, total] = await mysql.count(MODEL, filter)
      if (countErr) throw new InternalServerError(countErr.message)

      return [records, total]
    },

    /**
     * Find a single user by ID using the cache-first client
     * @param {Object} params
     * @param {Object} params.services - Injected services (dbCache)
     * @param {Object} params.args - Request args containing id
     * @param {string} params.args.id - User _id
     * @returns {Promise<Object|null>} User record or null
     */
    findById: async ({ services, args }) => {
      const { dbCache } = services
      const [err, record] = await dbCache.selectViaId(MODEL, args.id)
      if (err) throw new InternalServerError(err.message)
      return record
    },

    /**
     * Update a user record by ID
     * @param {Object} params
     * @param {Object} params.services - Injected services (mysql)
     * @param {Object} params.args - Request args containing id and body
     * @param {string} params.args.id - User _id
     * @param {Object} params.args.body - Fields to update
     * @returns {Promise<boolean>} True if updated
     */
    updateRecord: async ({ services, args }) => {
      const { mysql } = services
      const [err, result] = await mysql.updateOne(MODEL, { _id: args.id }, { set: { ...args.body, updated_at: new Date() } })
      if (err) throw new InternalServerError(err.message)
      return result
    },

    /**
     * Delete a user record by ID and clear its cache
     * @param {Object} params
     * @param {Object} params.services - Injected services (mysql, dbCache)
     * @param {Object} params.args - Request args containing id
     * @param {string} params.args.id - User _id
     * @returns {Promise<boolean>} True if deleted
     */
    deleteRecord: async ({ services, args }) => {
      const { mysql, dbCache } = services
      const [err, result] = await mysql.deleteOne(MODEL, { _id: args.id })
      if (err) throw new InternalServerError(err.message)
      await dbCache.clearCacheForId(MODEL, args.id)
      return result
    },

    /**
     * Log a user event by delegating to the UserEvent sub-module service (MongoDB)
     * @param {Object} params
     * @param {Object} params.services - Injected services (userEventSrv)
     * @param {Object} params.args - Event data (user_id, action, metadata)
     * @returns {Promise<Object>} Created event record
     */
    logEvent: async ({ services, args }) => {
      return services.userEventSrv.createRecord({ services, args })
    },
  },

  /**
   * Spread the UserEvent sub-module service so routes can access userEventSrv directly
   */
  ...useUserEventService(),
})
