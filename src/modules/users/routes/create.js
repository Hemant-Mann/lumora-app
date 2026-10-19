import { useServices, useJsonBody } from 'lumora/hooks/index.js'
import { useUserService } from '../service.js'
import { STATUS } from '../constants.js'
import { ACTION_USER_CREATED } from '../userEvents/constants.js'
import { bodyMapping, responseMapping } from '../mapper.js'

export const userCreate = async ({ services, args }) => {
  // useJsonBody merges the validated fields straight into args
  const record = await services.userSrv.createRecord({ services, args: { body: bodyMapping(args) } })
  await services.userSrv.logEvent({ services, args: { user_id: record._id, action: ACTION_USER_CREATED } })

  return {
    success: true,
    message: 'User created successfully',
    user: responseMapping(record),
  }
}

export const handler = () => [
  useServices({
    ...useUserService()
  }),
  useJsonBody(z => ({
    name: z.string().min(1).max(255),
    email: z.string().email().toLowerCase(),
    status: z.enum(STATUS).optional(),
  })),
  userCreate
]

export default handler
