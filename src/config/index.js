import { config } from 'dotenv'

config()

const getEnv = (key, defaultValue = '') => {
  return process.env[key] || defaultValue
}

export default {
  port: parseInt(getEnv('PORT', '4000'), 10),
  mysqlUri: getEnv('MYSQL_URI'),
  mongoUri: getEnv('MONGO_URI'),
  databaseName: getEnv('DB_NAME', 'lumora_app'),
  redisUrl: getEnv('REDIS_URL'),
  cachePrefix: getEnv('CACHE_PREFIX', '__lumora__'),
  jwtSecret: getEnv('JWT_SECRET', 'change-me-in-production'),
}
