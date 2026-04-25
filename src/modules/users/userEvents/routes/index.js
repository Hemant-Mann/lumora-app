import { handler as userEventCreate } from './create.js'
import { handler as userEventList } from './list.js'
import { createWorkflow } from '../../../../framework/index.js'

/**
 * @type {Array}
 */
export const endpoints = [
  createWorkflow(['GET', '/api/users/:id/events'], [], userEventList()),
  createWorkflow(['POST', '/api/users/:id/events'], [], userEventCreate()),
]

export default endpoints
