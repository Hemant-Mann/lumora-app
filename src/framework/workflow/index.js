import { compose } from 'radash'
import { useKoa, useLogging, useServices } from 'lumora/hooks/index.js'
import { useSession, useError, useCors } from '../hooks/index.js'

/**
 * Create a workflow definition from a route configuration.
 * A workflow is a declarative route object consumed by executeKoaWorkflow.
 * @param {string[]} routeConfig - [method, path] tuple, e.g. ['GET', '/api/users']
 * @param {Function[]} preHooks - Route-specific pre-hooks (auth guards, etc.)
 * @param {Function[]} routeSpecificHooks - Endpoint hooks + validation + business logic
 * @returns {Object} Workflow object with method, path, preHooks, handler
 * @returns {string} return.method - Lowercase HTTP method
 * @returns {string} return.path - Route path
 * @returns {Function[]} return.preHooks - Pre-hooks array
 * @returns {Function[]} return.handler - Handler hooks array
 */
export const createWorkflow = (routeConfig, preHooks, routeSpecificHooks) => {
  const [method, path] = routeConfig
  const m = method.toLowerCase()
  return {
    method: m,
    path,
    preHooks,
    handler: routeSpecificHooks,
  }
}

/**
 * Execute a workflow on a generic router.
 * Composes preHooks + handler hooks and registers them on the router.
 * @param {Object} router - Router instance with method-based registration (e.g. router.get)
 * @param {Object} workflow - Workflow object from createWorkflow
 */
export const executeWorkflow = (router, workflow) => {
  const { method, path, preHooks, handler } = workflow
  const hooks = [...preHooks, ...handler]
  router[method](path, compose(...hooks))
}

/**
 * Execute a workflow on a Koa router with the standard Lumora pre-hook stack.
 * Fixed pre-hooks are automatically applied to every route:
 * 1. useKoa() — bridges Koa ctx to Lumora Props
 * 2. useCors() — CORS headers
 * 3. useLogging() — request/response logging
 * 4. useServices() — inject core services (db, mysql, redis, dbCache)
 * 5. useSession() — JWT token decoding
 * 6. useError() — error boundary
 * @param {import('@koa/router').Router} router - Koa router instance
 * @param {Object} workflow - Workflow object from createWorkflow
 * @param {Object} coreServices - Core services map from useCoreServices()
 */
export const executeKoaWorkflow = (router, workflow, coreServices) => {
  const { method, path, preHooks, handler } = workflow
  const fixedPreHooks = [
    useKoa(),
    useCors({ credentials: true }),
    useLogging('[:method] :domain :fullpath at :date(iso) -> :status in :elapsed(ms)'),
    useServices({ ...coreServices }),
    useSession(),
    useError(),
  ]
  router[method](path, compose(...fixedPreHooks, ...preHooks, ...handler))
}
