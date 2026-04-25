import { makeCacheClient, makeMongo, MongoClient, MysqlClient, RedisClient } from 'lumora/services'
import config from '../config/index.js'

export { default as addRoutes } from './koa/router.js'
export { createWorkflow, executeWorkflow } from './workflow/index.js'

const REDIS_CLIENT_NAME = 'default'
const MYSQL_CLIENT_NAME = 'default'
const MONGO_CLIENT_NAME = 'default'

/**
 * Create the default Redis client
 * @returns {import('lumora/services').RedisClient}
 */
const makeRedis = () => RedisClient.makeRedisClient(REDIS_CLIENT_NAME, config.redisUrl)

/**
 * Disconnect the default Redis client
 * @returns {Promise<void>}
 */
const disconnectRedisClient = () => RedisClient.disconnectRedis(REDIS_CLIENT_NAME)

/**
 * Create the default MySQL client
 * @returns {import('lumora/services').MysqlClient}
 */
const makeMysqlClient = () => MysqlClient.makeMysql(MYSQL_CLIENT_NAME, { mysqlUri: config.mysqlUri })

/**
 * Disconnect the default MySQL client
 * @returns {Promise<void>}
 */
const disconnectMysqlClient = () => MysqlClient.disconnectMysql(MYSQL_CLIENT_NAME)

/**
 * Create the default MongoDB client
 * @returns {import('lumora/services').MongoClient}
 */
const makeDatabase = () => makeMongo(MONGO_CLIENT_NAME, { mongoUri: config.mongoUri, databaseName: config.databaseName })

/**
 * Disconnect the default MongoDB client
 * @returns {Promise<void>}
 */
const disconnectMongo = () => MongoClient.disconnectMongo(MONGO_CLIENT_NAME)

export {
  makeDatabase,
  disconnectMongo,
  makeMysqlClient,
  disconnectMysqlClient,
  disconnectRedisClient,
}

/**
 * Build the core services object injected into every request via useServices.
 * Returns connected clients for MySQL, MongoDB, Redis, and a cache-first wrapper.
 * @returns {Object} Core services map
 * @returns {import('lumora/services').MongoClient} return.db - MongoDB client
 * @returns {import('lumora/services').MysqlClient} return.mysql - MySQL client
 * @returns {import('lumora/services').RedisClient} return.redis - Redis client
 * @returns {import('lumora/services').RedisClient} return.cache - Alias for redis
 * @returns {import('lumora/services').CacheClient} return.dbCache - Cache-first DB client
 */
export const useCoreServices = () => {
  const db = makeDatabase()
  const mysql = makeMysqlClient()
  const redis = makeRedis()
  const dbCache = makeCacheClient(mysql, redis, config.cachePrefix)

  return {
    db,
    mysql,
    redis,
    cache: redis,
    dbCache,
  }
}
