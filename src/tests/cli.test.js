import { describe, it, expect, afterAll } from '@jest/globals'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const CLI = path.resolve('bin/lumora.js')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lumora-cli-'))
const project = path.join(tmp, 'my-app')
const run = (args, cwd) => execFileSync('node', [CLI, ...args], { cwd, encoding: 'utf8' })

afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }))

describe('lumora CLI', () => {
  it('should bootstrap a project, then create and register a module', () => {
    run(['new', project], tmp)
    expect(JSON.parse(fs.readFileSync(path.join(project, 'package.json'), 'utf8')).name).toBe('my-app')
    expect(fs.existsSync(path.join(project, 'node_modules'))).toBe(false)

    run(['make:module', 'product-reviews'], project)
    run(['make:module', 'user-reviews', '--parent', 'users'], project)
    run(['make:module', 'order-lines', '--db', 'mysql'], project)
    const dir = path.join(project, 'src/modules/productReviews')
    for (const f of ['constants.js', 'schema.js', 'mapper.js', 'helper.js', 'service.js', 'hooks/useValidateId.js', 'routes/index.js', 'routes/create.js', 'routes/list.js', 'routes/findOne.js']) {
      expect(fs.existsSync(path.join(dir, f))).toBe(true)
    }
    expect(fs.existsSync(path.join(project, 'src/modules/users/userReviews/routes/index.js'))).toBe(true)

    // MySQL modules get a knex migration instead of a mongoose schema, and no models.js entry
    const mysqlDir = path.join(project, 'src/modules/orderLines')
    expect(fs.existsSync(path.join(mysqlDir, 'schema.js'))).toBe(false)
    expect(fs.readdirSync(path.join(mysqlDir, 'migrations'))).toEqual([expect.stringMatching(/^\d{14}_create_order_line\.js$/)])
    expect(fs.readFileSync(path.join(mysqlDir, 'service.js'), 'utf8')).toContain('mysql.insertOne(MODEL')

    // Load the generated code for real (with this repo's node_modules) to prove it wires up
    fs.symlinkSync(path.resolve('node_modules'), path.join(project, 'node_modules'))
    const out = execFileSync('node', ['--input-type=module', '-e', `
      const routes = (await import('./src/modules/routes.js')).default
      await import('./src/modules/models.js')
      const knexfile = (await import('./knexfile.js')).default
      if (!knexfile.migrations.directory.includes('src/modules/orderLines/migrations')) throw new Error('migration dir not picked up')
      const core = await import('./src/modules/core/services.js')
      for (const hook of ['useUserService', 'useProductReviewService', 'useUserReviewService', 'useOrderLineService']) {
        if (typeof core[hook] !== 'function') throw new Error(hook + ' not registered in core/services.js')
      }
      console.log(routes.map(r => r.method + ' ' + r.path).join(','))
    `], { cwd: project, encoding: 'utf8' })
    expect(out.trim().split(',')).toEqual(expect.arrayContaining(['get /api/product-reviews', 'post /api/product-reviews', 'get /api/product-reviews/:id', 'get /api/users/:userId/reviews', 'get /api/users/:userId/reviews/:id']))

    // The generated tests must pass as generated
    execFileSync('node', ['--experimental-vm-modules', 'node_modules/jest/bin/jest.js', 'src/tests/productReviews', 'src/tests/users/userReviews', 'src/tests/orderLines'], { cwd: project, stdio: 'pipe' })

    expect(fs.readFileSync(path.join(project, 'src/modules/models.js'), 'utf8'))
      .toContain('MongoClient.registerModel(MONGO_CLIENT_NAME, PRODUCT_REVIEW_MODEL, productReviewSchema)')
    expect(fs.readFileSync(path.join(project, 'src/modules/models.js'), 'utf8')).not.toContain('ORDER_LINE_MODEL')

    expect(() => run(['make:module', 'product-reviews'], project)).toThrow()
    expect(() => run(['make:module', 'reviews', '--parent', 'missing'], project)).toThrow()
    expect(() => run(['make:module', 'things', '--db', 'pg'], project)).toThrow()
  })
})
