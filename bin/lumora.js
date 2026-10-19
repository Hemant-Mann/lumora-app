#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'

const TEMPLATE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SKIP = new Set(['node_modules', 'coverage', '.git', '.claude', '.env'])

const USAGE = `Usage:
  lumora new <dir>                            Bootstrap a new project (with the example users module)
  lumora make:module <name> [--parent <mod>] [--db mongo|mysql]
                                              Create src/modules/[<mod>/]<name> + its test, register model + routes
                                              (run from the project root, e.g. "npm run make:module -- products",
                                               "npm run make:module -- user-reviews --parent users",
                                               "npm run make:module -- orders --db mysql")`

const fail = (msg) => {
  console.error(msg)
  process.exit(1)
}

// "product-reviews" → ["product", "reviews"]
const words = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1 $2').split(/[^a-zA-Z0-9]+/).filter(Boolean).map(w => w.toLowerCase())
const camel = (ws) => ws.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join('')
const pascal = (ws) => ws.map(w => w[0].toUpperCase() + w.slice(1)).join('')
// ponytail: naive singular (drops a trailing "s"), rename the generated MODEL/service by hand for irregular nouns
const singular = (ws) => [...ws.slice(0, -1), ws.at(-1).replace(/s$/, '')]

const newProject = (dir) => {
  if (!dir) fail(USAGE)
  const target = path.resolve(dir)
  if (fs.existsSync(target) && fs.readdirSync(target).length) fail(`${target} is not empty`)

  fs.cpSync(TEMPLATE_ROOT, target, {
    recursive: true,
    filter: (src) => !SKIP.has(path.basename(src)),
  })

  const pkgPath = path.join(target, 'package.json')
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
  pkg.name = path.basename(target)
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')

  console.log(`Created ${target}\n\nNext:\n  cd ${dir}\n  npm install\n  cp .env.example .env\n  npm run dev`)
}

const moduleFiles = (n) => {
  // Emit `s` only for sub-modules (n.parent = { field: 'user_id', param: 'userId' })
  const p = (s) => (n.parent ? s : '')
  const parentParam = p(`
    ${n.parent?.param}: z.string().min(1),`)

  // Emit `s` only for MySQL modules
  const p2 = (s) => (n.db === 'mysql' ? s : '')

  const storage = n.db === 'mysql'
    ? {
      [`migrations/${n.migrationTs}_create_${n.table}.js`]: `/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = async (knex) => {
  await knex.schema.createTable('${n.table}', (t) => {
    t.string('_id', 20).primary()${p(`
    t.string('${n.parent?.field}', 20).notNullable().index()`)}
    t.string('name', 255).notNullable()
    t.enum('status', ['active', 'inactive']).defaultTo('active')
    // UTC, whatever the server's timezone (knex.fn.now() / CURRENT_TIMESTAMP follow it).
    // MySQL has no ON UPDATE UTC_TIMESTAMP: set updated_at: new Date() when updating (MYSQL_URI has ?timezone=Z)
    t.datetime('created_at').defaultTo(knex.raw('(UTC_TIMESTAMP())'))
    t.datetime('updated_at').defaultTo(knex.raw('(UTC_TIMESTAMP())'))
  })
}

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = async (knex) => {
  await knex.schema.dropTable('${n.table}')
}
`,
    }
    : {
      'schema.js': `import mongoose from 'mongoose'
import { STATUS, STATUS_ACTIVE } from './constants.js'

const ${n.model}Schema = new mongoose.Schema({${p(`
  ${n.parent?.field}: { type: String, required: true, index: true },`)}
  name: { type: String, required: true },
  status: { type: String, enum: STATUS, default: STATUS_ACTIVE },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
})

export default ${n.model}Schema
`,
    }

  return {
    ...storage,
    'constants.js': `export const MODEL = '${n.Model}'
export const RESOURCE = '${n.model}'

export const STATUS_ACTIVE = 'active'
export const STATUS_INACTIVE = 'inactive'
export const STATUS = [STATUS_ACTIVE, STATUS_INACTIVE]
`,

    'mapper.js': `/**
 * Map a ${n.model} record (DB) to the API response shape
 * @param {Object} record - ${n.Model} record from the database
 * @returns {Object|null} Data for API response
 */
export const responseMapping = (record) => {
  if (!record) return null

  return {
    id: record._id,${p(`
    ${n.parent?.field}: record.${n.parent?.field},`)}
    name: record.name,
    status: record.status,
    created_at: record.created_at,
    updated_at: record.updated_at,
  }
}

/**
 * Map validated request args to ${n.model} record fields (API → DB)
 * @param {Object} args - Validated request args
 * @returns {Object} Fields for the database
 */
export const bodyMapping = (args) => {
  const mapped = {}
${p(`
  if (args.${n.parent?.param} !== undefined) mapped.${n.parent?.field} = args.${n.parent?.param}`)}
  if (args.name !== undefined) mapped.name = args.name.trim()
  if (args.status !== undefined) mapped.status = args.status

  return mapped
}
`,

    'helper.js': `/**
 * Build the ${n.model} list filter from validated query args
 * @param {Object} args - Query args (status, search)
 * @returns {Object} Filter object for ${n.srv}.findRecords
 */
export const buildFilter = (args) => {
  const filter = {}
${p(`
  if (args.${n.parent?.param}) {
    filter.${n.parent?.field} = args.${n.parent?.param}
  }
`)}
  if (args.status) {
    filter.status = args.status
  }

  if (args.search) {
    filter.name = { operator: 'CONTAINS', value: args.search }
  }

  return filter
}
`,

    'service.js': `import { InternalServerError } from 'lumora/core/index.js'
import { MODEL } from './constants.js'

/**
 * Service hook for ${n.Model} operations (${n.db === 'mysql' ? 'MySQL' : 'MongoDB'}-backed)
 * @returns {Object} Service map containing ${n.srv}
 */
export const ${n.useService} = () => ({
  ${n.srv}: {
    /**
     * Create a new ${n.model} record
     * @param {Object} params
     * @param {Object} params.services - Injected services (${n.client})
     * @param {Object} params.args - Request args containing body
     * @returns {Promise<Object>} Created record
     */
    createRecord: async ({ services, args }) => {
      const { ${n.client} } = services
      const [err, record] = await ${n.client}.insertOne(MODEL, { ${p2(`_id: mysql.generateNewId(), `)}...args.body, created_at: new Date(), updated_at: new Date() })
      if (err) throw new InternalServerError(err.message, { key: '${n.folder}.create-failed' })
      return record
    },

    /**
     * Find many ${n.model} records with pagination and filtering
     * @param {Object} params
     * @param {Object} params.services - Injected services (${n.client})
     * @param {Object} params.args - Query args (filter, page_no, per_page)
     * @returns {Promise<[Object[], number]>} Tuple of [records, totalCount]
     */
    findRecords: async ({ services, args }) => {
      const { ${n.client} } = services
      const { filter = {}, page_no = 1, per_page = 10 } = args

      const [err, records] = await ${n.client}.selectMany(MODEL, filter, { page_no, per_page${n.db === 'mongo' ? ', sort: { created_at: -1 }' : ''} })
      if (err) throw new InternalServerError(err.message, { key: '${n.folder}.list-failed' })

      const [countErr, total] = await ${n.client}.count(MODEL, filter)
      if (countErr) throw new InternalServerError(countErr.message, { key: '${n.folder}.count-failed' })

      return [records, total]
    },

    /**
     * Find a single ${n.model} by ID
     * @param {Object} params
     * @param {Object} params.services - Injected services (${n.client})
     * @param {Object} params.args - Request args containing id
     * @returns {Promise<Object|null>} Record or null
     */
    findById: async ({ services, args }) => {
      const { ${n.client} } = services
      const [err, record] = await ${n.client}.selectViaId(MODEL, args.id)
      if (err) throw new InternalServerError(err.message, { key: '${n.folder}.find-failed' })
      return record
    },
  }
})
`,

    'hooks/useValidateId.js': `import { BadRequestError } from 'lumora/core/index.js'

/**
 * Load the ${n.model} from the \`id\` path param and add it to args as \`args.${n.model}\`
 * Throws BadRequestError when it does not exist${p(` or belongs to another ${n.parent?.param.slice(0, -2)}`)}
 * Requires \`${n.srv}\` in services and \`usePathParams\` (id) before it
 * @returns {Function} Lumora hook (func) => (props) => ...
 */
export const useValidateId = () => (func) => async (props) => {
  const { services, args } = props

  const ${n.model} = await services.${n.srv}.findById({ services, args: { id: args.id } })
  if (!${n.model}${p(` || ${n.model}.${n.parent?.field} !== args.${n.parent?.param}`)}) {
    throw new BadRequestError('${n.Model} not found', { key: '${n.folder}.not-found' })
  }

  return await func({
    ...props,
    args: {
      ...props.args,
      ${n.model},
    }
  })
}
`,

    'routes/index.js': `import { handler as ${n.model}Create } from './create.js'
import { handler as ${n.model}List } from './list.js'
import { handler as ${n.model}FindOne } from './findOne.js'
import { createWorkflow } from '../${n.toSrc}framework/index.js'

/**
 * @type {Array}
 */
export const endpoints = [
  createWorkflow(['GET', '${n.path}'], [], ${n.model}List()),
  createWorkflow(['POST', '${n.path}'], [], ${n.model}Create()),
  createWorkflow(['GET', '${n.path}/:id'], [], ${n.model}FindOne()),
]

export default endpoints
`,

    'routes/create.js': `import { useServices, ${p('usePathParams, ')}useJsonBody } from 'lumora/hooks/index.js'
import { ${n.useService} } from '${n.toSrc}core/services.js'
import { STATUS } from '../constants.js'
import { bodyMapping, responseMapping } from '../mapper.js'

export const ${n.model}Create = async ({ services, args }) => {
  const record = await services.${n.srv}.createRecord({ services, args: { body: bodyMapping(args) } })

  return {
    success: true,
    message: '${n.Model} created successfully',
    ${n.model}: responseMapping(record),
  }
}

export const handler = () => [
  useServices({
    ...${n.useService}()
  }),${p(`
  usePathParams(z => ({${parentParam}
  })),`)}
  useJsonBody(z => ({
    name: z.string().min(1).max(255),
    status: z.enum(STATUS).optional(),
  })),
  ${n.model}Create
]

export default handler
`,

    'routes/list.js': `import { useServices, ${p('usePathParams, ')}useQueryString } from 'lumora/hooks/index.js'
import { ${n.useService} } from '${n.toSrc}core/services.js'
import { STATUS } from '../constants.js'
import { buildFilter } from '../helper.js'
import { responseMapping } from '../mapper.js'

const hasValidFilters = () => (func) => async (props) => {
  return await func({
    ...props,
    args: {
      ...props.args,
      filter: buildFilter(props.args),
    }
  })
}

export const ${n.model}List = async ({ services, args }) => {
  const [records, total] = await services.${n.srv}.findRecords({ services, args })

  return {
    success: true,
    ${n.folder}: records.map(responseMapping),
    pagination: {
      page_no: args.page_no,
      per_page: args.per_page,
      total,
    }
  }
}

export const handler = () => [
  useServices({
    ...${n.useService}()
  }),${p(`
  usePathParams(z => ({${parentParam}
  })),`)}
  useQueryString(z => ({
    page_no: z.coerce.number().default(1),
    per_page: z.coerce.number().min(10).max(100).default(10),
    status: z.enum(STATUS).optional(),
    search: z.string().optional(),
  })),
  hasValidFilters(),
  ${n.model}List
]

export default handler
`,

    'routes/findOne.js': `import { useServices, usePathParams } from 'lumora/hooks/index.js'
import { ${n.useService} } from '${n.toSrc}core/services.js'
import { useValidateId } from '../hooks/useValidateId.js'
import { responseMapping } from '../mapper.js'

// useValidateId has already loaded the record into args.${n.model} (or thrown)
export const ${n.model}FindOne = async ({ args }) => {
  return {
    success: true,
    ${n.model}: responseMapping(args.${n.model}),
  }
}

export const handler = () => [
  useServices({
    ...${n.useService}()
  }),
  usePathParams(z => ({${parentParam}
    id: z.string().min(1),
  })),
  useValidateId(),
  ${n.model}FindOne
]

export default handler
`,
  }
}

const testFile = (n) => {
  const m = `${n.testToModules}${n.rel}`
  const parentField = n.parent ? `\n  ${n.parent.field}: 'parent_abc123',` : ''
  const parentArg = n.parent ? `${n.parent.param}: 'parent_abc123', ` : ''

  // Same test for both runners: only describe/it come from the runner, checks use node:assert
  return `import { describe, it } from '${n.runner === 'jest' ? '@jest/globals' : 'node:test'}'
import assert from 'node:assert/strict'
import { ${n.model}Create } from '${m}/routes/create.js'
import { ${n.model}List } from '${m}/routes/list.js'
import { ${n.model}FindOne } from '${m}/routes/findOne.js'
import { useValidateId } from '${m}/hooks/useValidateId.js'
import { buildFilter } from '${m}/helper.js'
import { responseMapping } from '${m}/mapper.js'

const make${n.Model} = (overrides = {}) => ({
  _id: '${n.model}_abc123',${parentField}
  name: 'Example',
  status: 'active',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

// Async stand-in for a service method or the next hook: resolves to \`result\`, records each call's first argument
const fake = (result) => {
  const f = async (props) => {
    f.calls.push(props)
    return result
  }
  f.calls = []
  return f
}

describe('${n.folder}', () => {
  describe('${n.model}Create', () => {
    it('should create the record and return it mapped', async () => {
      const record = make${n.Model}()
      const createRecord = fake(record)

      const result = await ${n.model}Create({
        services: { ${n.srv}: { createRecord } },
        args: { ${parentArg}name: '  Example  ' },
      })

      assert.equal(result.success, true)
      assert.deepEqual(result.${n.model}, responseMapping(record))
      assert.deepEqual(createRecord.calls[0].args, { body: { ${n.parent ? `${n.parent.field}: 'parent_abc123', ` : ''}name: 'Example' } })
    })
  })

  describe('${n.model}List', () => {
    it('should return mapped records with pagination', async () => {
      const record = make${n.Model}()
      const findRecords = fake([[record], 1])

      const result = await ${n.model}List({
        services: { ${n.srv}: { findRecords } },
        args: { page_no: 1, per_page: 10, filter: {} },
      })

      assert.equal(result.success, true)
      assert.deepEqual(result.${n.folder}, [responseMapping(record)])
      assert.deepEqual(result.pagination, { page_no: 1, per_page: 10, total: 1 })
    })
  })

  describe('${n.model}FindOne', () => {
    it('should return the record loaded by useValidateId', async () => {
      const record = make${n.Model}()

      const result = await ${n.model}FindOne({ args: { ${n.model}: record } })

      assert.deepEqual(result, { success: true, ${n.model}: responseMapping(record) })
    })
  })

  describe('useValidateId', () => {
    it('should add the record to args and call the next hook', async () => {
      const record = make${n.Model}()
      const next = fake('ok')

      const result = await useValidateId()(next)({
        services: { ${n.srv}: { findById: fake(record) } },
        args: { ${parentArg}id: record._id },
      })

      assert.equal(result, 'ok')
      assert.deepEqual(next.calls[0].args.${n.model}, record)
    })

    it('should throw when the record does not exist', async () => {
      const next = fake()

      await assert.rejects(
        useValidateId()(next)({ services: { ${n.srv}: { findById: fake(null) } }, args: { ${parentArg}id: 'missing' } }),
        { message: '${n.Model} not found' },
      )
      assert.equal(next.calls.length, 0)
    })
${n.parent ? `
    it('should throw when the record belongs to another parent', async () => {
      const next = fake()

      await assert.rejects(
        useValidateId()(next)({
          services: { ${n.srv}: { findById: fake(make${n.Model}({ ${n.parent.field}: 'someone_else' })) } },
          args: { ${parentArg}id: '${n.model}_abc123' },
        }),
        { message: '${n.Model} not found' },
      )
      assert.equal(next.calls.length, 0)
    })
` : ''}  })

  describe('buildFilter', () => {
    it('should map query args to a filter', () => {
      assert.deepEqual(buildFilter({ ${parentArg}status: 'active', search: 'ex' }), {${n.parent ? `
        ${n.parent.field}: 'parent_abc123',` : ''}
        status: 'active',
        name: { operator: 'CONTAINS', value: 'ex' },
      })
    })
  })
})
`
}

// Add `imports` after the last import, and `entry` after the last line matching `anchor`
const register = (file, imports, anchor, entry) => {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  const lastImport = lines.findLastIndex(l => l.startsWith('import '))
  lines.splice(lastImport + 1, 0, ...imports)
  const lastAnchor = lines.findLastIndex(l => anchor.test(l))
  if (lastAnchor === -1) fail(`Could not find where to register in ${file}, add "${entry.trim()}" by hand`)
  lines.splice(lastAnchor + 1, 0, entry)
  fs.writeFileSync(file, lines.join('\n'))
}

const makeModule = (name, parentName, dbName) => {
  if (!name) fail(USAGE)
  if (!['mongo', 'mysql'].includes(dbName)) fail(`--db must be mongo or mysql, got ${dbName}`)
  const modulesDir = path.resolve('src/modules')
  if (!fs.existsSync(modulesDir)) fail('src/modules not found, run this from the project root')
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))

  const ws = words(name)
  const one = singular(ws)
  let parent = null
  let base = `/api/${ws.join('-')}`

  if (parentName) {
    const pws = words(parentName)
    if (!fs.existsSync(path.join(modulesDir, camel(pws)))) fail(`Parent module src/modules/${camel(pws)} not found`)
    const pOne = singular(pws)
    parent = { folder: camel(pws), field: `${pOne.join('_')}_id`, param: `${camel(pOne)}Id` }
    // "user-reviews" under "users" → /api/users/:userId/reviews
    const seg = ws.slice(0, pOne.length).join() === pOne.join() && ws.length > pOne.length ? ws.slice(pOne.length) : ws
    base = `/api/${pws.join('-')}/:${parent.param}/${seg.join('-')}`
  }

  const rel = parent ? `${parent.folder}/${camel(ws)}` : camel(ws)
  const depth = rel.split('/').length
  const n = {
    folder: camel(ws),
    rel,
    path: base,
    parent,
    model: camel(one),
    Model: pascal(one),
    srv: `${camel(one)}Srv`,
    useService: `use${pascal(one)}Service`,
    MODEL_CONST: `${one.join('_').toUpperCase()}_MODEL`,
    db: dbName,
    client: dbName === 'mysql' ? 'mysql' : 'db',
    // Must match lumora's getTableName(Model): UserReview → user_review
    table: one.join('_'),
    migrationTs: new Date().toISOString().replace(/\D/g, '').slice(0, 14),
    // jest if the project depends on it, else node's built-in runner (node --test)
    runner: Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).includes('jest') ? 'jest' : 'node',
    toSrc: '../'.repeat(depth + 1),
    testToModules: `${'../'.repeat(depth + 1)}modules/`,
  }

  const dir = path.join(modulesDir, rel)
  const testPath = path.resolve('src/tests', rel, 'routes.test.js')
  if (fs.existsSync(dir)) fail(`${dir} already exists`)
  if (fs.existsSync(testPath)) fail(`${testPath} already exists`)

  for (const [file, content] of Object.entries(moduleFiles(n))) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
    fs.writeFileSync(path.join(dir, file), content)
  }
  fs.mkdirSync(path.dirname(testPath), { recursive: true })
  fs.writeFileSync(testPath, testFile(n))

  if (n.db === 'mongo') register(path.join(modulesDir, 'models.js'), [
    `import ${n.model}Schema from './${rel}/schema.js'`,
    `import { MODEL as ${n.MODEL_CONST} } from './${rel}/constants.js'`,
  ], /registerModel\(/, `  MongoClient.registerModel(MONGO_CLIENT_NAME, ${n.MODEL_CONST}, ${n.model}Schema)`)

  register(path.join(modulesDir, 'routes.js'), [
    `import ${n.model}Endpoints from './${rel}/routes/index.js'`,
  ], /^\s*\.\.\.\w+Endpoints,/, `  ...${n.model}Endpoints,`)

  fs.mkdirSync(path.join(modulesDir, 'core'), { recursive: true })
  fs.appendFileSync(path.join(modulesDir, 'core/services.js'), `export { ${n.useService} } from '../${rel}/service.js'\n`)

  console.log(`Created src/modules/${rel} (${n.srv}, model ${n.Model}, ${n.db}) and src/tests/${rel}/routes.test.js
Registered in ${n.db === 'mongo' ? 'src/modules/models.js, ' : ''}src/modules/routes.js and src/modules/core/services.js
Routes: GET ${n.path}, POST ${n.path}, GET ${n.path}/:id${n.db === 'mysql' ? `\nNext: npm run migrate:latest (creates table ${n.table})` : ''}`)
}

const { positionals, values } = parseArgs({ allowPositionals: true, options: { parent: { type: 'string' }, db: { type: 'string', default: 'mongo' } } })
const [cmd, arg] = positionals
if (cmd === 'new') newProject(arg)
else if (cmd === 'make:module') makeModule(arg, values.parent, values.db)
else fail(USAGE)
