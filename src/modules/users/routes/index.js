import { handler as userCreate } from './create.js'
import { handler as userList } from './list.js'
import { handler as userFindOne } from './findOne.js'
import { createWorkflow } from '../../../framework/index.js'

/**
 * @type {Array}
 */
export const endpoints = [
  createWorkflow(['GET', '/api/users'], [], userList()),
  createWorkflow(['POST', '/api/users'], [], userCreate()),
  createWorkflow(['GET', '/api/users/:id'], [], userFindOne()),
]

export default endpoints
