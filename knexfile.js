import fs from 'node:fs'
import path from 'node:path'
import config from './src/config/index.js'

// Each MySQL module keeps its own migrations/ folder; knex runs them all in timestamp order
const migrationDirs = fs.readdirSync('src/modules', { recursive: true })
  .map(p => path.join('src/modules', p))
  .filter(p => path.basename(p) === 'migrations' && fs.statSync(p).isDirectory())

export default {
  client: 'mysql2',
  connection: config.mysqlUri,
  migrations: {
    directory: migrationDirs,
    extension: 'js',
    stub: 'node_modules/knex/lib/migrations/migrate/stub/mjs.stub',
  },
}
