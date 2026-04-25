import { executeKoaWorkflow } from '../workflow/index.js'

/**
 * Register all workflows (routes) onto a Koa router.
 * Each workflow is registered via executeKoaWorkflow with the provided core services.
 * @param {import('@koa/router').Router} router - Koa router instance
 * @param {Array} workflows - Array of workflow objects from createWorkflow
 * @param {Object} coreServices - Services to inject into every route (db, mysql, redis, dbCache)
 * @returns {import('@koa/router').Router} The same router with routes attached
 */
const addRoutes = (router, workflows, coreServices) => {
  for (const workflow of workflows) {
    executeKoaWorkflow(router, workflow, coreServices)
  }
  return router
}

export default addRoutes
