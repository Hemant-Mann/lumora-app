#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const TEMPLATE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SKIP = new Set(['node_modules', 'coverage', '.git', '.claude', '.env'])

const USAGE = `Usage:
  lumora new <dir>              Bootstrap a new project (with the example users module)
  lumora make:module <name>     Create src/modules/<name> and register its model + routes
                                (run from the project root, e.g. "npm run make:module -- products")`

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

const moduleFiles = (n) => ({
  'constants.js': `export const MODEL = '${n.Model}'
export const RESOURCE = '${n.model}'

export const STATUS_ACTIVE = 'active'
export const STATUS_INACTIVE = 'inactive'
export const STATUS = [STATUS_ACTIVE, STATUS_INACTIVE]
`,

  'schema.js': `import mongoose from 'mongoose'
import { STATUS, STATUS_ACTIVE } from './constants.js'

const ${n.model}Schema = new mongoose.Schema({
  name: { type: String, required: true },
  status: { type: String, enum: STATUS, default: STATUS_ACTIVE },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
})

export default ${n.model}Schema
`,

  'mapper.js': `/**
 * Map a ${n.model} record (DB) to the API response shape
 * @param {Object} record - ${n.Model} record from the database
 * @returns {Object|null} Data for API response
 */
export const responseMapping = (record) => {
  if (!record) return null

  return {
    id: record._id,
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
 * Service hook for ${n.Model} operations (MongoDB-backed)
 * @returns {Object} Service map containing ${n.srv}
 */
export const ${n.useService} = () => ({
  ${n.srv}: {
    /**
     * Create a new ${n.model} record
     * @param {Object} params
     * @param {Object} params.services - Injected services (db)
     * @param {Object} params.args - Request args containing body
     * @returns {Promise<Object>} Created record
     */
    createRecord: async ({ services, args }) => {
      const { db } = services
      const [err, record] = await db.insertOne(MODEL, { ...args.body, created_at: new Date(), updated_at: new Date() })
      if (err) throw new InternalServerError(err.message, { key: '${n.folder}.create-failed' })
      return record
    },

    /**
     * Find many ${n.model} records with pagination and filtering
     * @param {Object} params
     * @param {Object} params.services - Injected services (db)
     * @param {Object} params.args - Query args (filter, page_no, per_page)
     * @returns {Promise<[Object[], number]>} Tuple of [records, totalCount]
     */
    findRecords: async ({ services, args }) => {
      const { db } = services
      const { filter = {}, page_no = 1, per_page = 10 } = args

      const [err, records] = await db.selectMany(MODEL, filter, { page_no, per_page, sort: { created_at: -1 } })
      if (err) throw new InternalServerError(err.message, { key: '${n.folder}.list-failed' })

      const [countErr, total] = await db.count(MODEL, filter)
      if (countErr) throw new InternalServerError(countErr.message, { key: '${n.folder}.count-failed' })

      return [records, total]
    },

    /**
     * Find a single ${n.model} by ID
     * @param {Object} params
     * @param {Object} params.services - Injected services (db)
     * @param {Object} params.args - Request args containing id
     * @returns {Promise<Object|null>} Record or null
     */
    findById: async ({ services, args }) => {
      const { db } = services
      const [err, record] = await db.selectViaId(MODEL, args.id)
      if (err) throw new InternalServerError(err.message, { key: '${n.folder}.find-failed' })
      return record
    },
  }
})
`,

  'hooks/useValidateId.js': `import { BadRequestError } from 'lumora/core/index.js'

/**
 * Load the ${n.model} from the \`id\` path param and add it to args as \`args.${n.model}\`
 * Throws BadRequestError when it does not exist
 * Requires \`${n.srv}\` in services and \`usePathParams\` (id) before it
 * @returns {Function} Lumora hook (func) => (props) => ...
 */
export const useValidateId = () => (func) => async (props) => {
  const { services, args } = props

  const ${n.model} = await services.${n.srv}.findById({ services, args: { id: args.id } })
  if (!${n.model}) {
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
import { createWorkflow } from '../../../framework/index.js'

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

  'routes/create.js': `import { useServices, useJsonBody } from 'lumora/hooks/index.js'
import { ${n.useService} } from '../service.js'
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
  }),
  useJsonBody(z => ({
    name: z.string().min(1).max(255),
    status: z.enum(STATUS).optional(),
  })),
  ${n.model}Create
]

export default handler
`,

  'routes/list.js': `import { useServices, useQueryString } from 'lumora/hooks/index.js'
import { ${n.useService} } from '../service.js'
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
  }),
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
import { ${n.useService} } from '../service.js'
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
  usePathParams(z => ({
    id: z.string().min(1),
  })),
  useValidateId(),
  ${n.model}FindOne
]

export default handler
`,
})

// Add `line` after the last import, and `entry` after the last line matching `anchor`
const register = (file, imports, anchor, entry) => {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  const lastImport = lines.findLastIndex(l => l.startsWith('import '))
  lines.splice(lastImport + 1, 0, ...imports)
  const lastAnchor = lines.findLastIndex(l => anchor.test(l))
  if (lastAnchor === -1) fail(`Could not find where to register in ${file}, add "${entry.trim()}" by hand`)
  lines.splice(lastAnchor + 1, 0, entry)
  fs.writeFileSync(file, lines.join('\n'))
}

const makeModule = (name) => {
  if (!name) fail(USAGE)
  const modulesDir = path.resolve('src/modules')
  if (!fs.existsSync(modulesDir)) fail('src/modules not found, run this from the project root')

  const ws = words(name)
  const one = singular(ws)
  const n = {
    folder: camel(ws),
    path: `/api/${ws.join('-')}`,
    model: camel(one),
    Model: pascal(one),
    srv: `${camel(one)}Srv`,
    useService: `use${pascal(one)}Service`,
    MODEL_CONST: `${one.join('_').toUpperCase()}_MODEL`,
  }

  const dir = path.join(modulesDir, n.folder)
  if (fs.existsSync(dir)) fail(`${dir} already exists`)

  for (const [file, content] of Object.entries(moduleFiles(n))) {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
    fs.writeFileSync(path.join(dir, file), content)
  }

  register(path.join(modulesDir, 'models.js'), [
    `import ${n.model}Schema from './${n.folder}/schema.js'`,
    `import { MODEL as ${n.MODEL_CONST} } from './${n.folder}/constants.js'`,
  ], /registerModel\(/, `  MongoClient.registerModel(MONGO_CLIENT_NAME, ${n.MODEL_CONST}, ${n.model}Schema)`)

  register(path.join(modulesDir, 'routes.js'), [
    `import ${n.model}Endpoints from './${n.folder}/routes/index.js'`,
  ], /^\s*\.\.\.\w+Endpoints,/, `  ...${n.model}Endpoints,`)

  console.log(`Created src/modules/${n.folder} (${n.srv}, model ${n.Model})
Registered in src/modules/models.js and src/modules/routes.js
Routes: GET ${n.path}, POST ${n.path}, GET ${n.path}/:id`)
}

const [cmd, arg] = process.argv.slice(2)
if (cmd === 'new') newProject(arg)
else if (cmd === 'make:module') makeModule(arg)
else fail(USAGE)
