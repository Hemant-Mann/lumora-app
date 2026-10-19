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
    const dir = path.join(project, 'src/modules/productReviews')
    for (const f of ['constants.js', 'schema.js', 'mapper.js', 'helper.js', 'service.js', 'hooks/useValidateId.js', 'routes/index.js', 'routes/create.js', 'routes/list.js', 'routes/findOne.js']) {
      expect(fs.existsSync(path.join(dir, f))).toBe(true)
    }

    // Load the generated code for real (with this repo's node_modules) to prove it wires up
    fs.symlinkSync(path.resolve('node_modules'), path.join(project, 'node_modules'))
    const out = execFileSync('node', ['--input-type=module', '-e', `
      const routes = (await import('./src/modules/routes.js')).default
      await import('./src/modules/models.js')
      console.log(routes.map(r => r.method + ' ' + r.path).join(','))
    `], { cwd: project, encoding: 'utf8' })
    expect(out.trim().split(',')).toEqual(expect.arrayContaining(['get /api/product-reviews', 'post /api/product-reviews', 'get /api/product-reviews/:id']))

    expect(fs.readFileSync(path.join(project, 'src/modules/models.js'), 'utf8'))
      .toContain('MongoClient.registerModel(MONGO_CLIENT_NAME, PRODUCT_REVIEW_MODEL, productReviewSchema)')

    expect(() => run(['make:module', 'product-reviews'], project)).toThrow()
  })
})
