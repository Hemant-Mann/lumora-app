import { useServices, useJsonBody } from 'lumora/hooks/index.js'
import { useUserService } from '../service.js'

export const userCreate = async ({ services, args }) => {
  const record = await services.userSrv.createRecord({ services, args })
  await services.userSrv.logEvent({ services, args: { user_id: record._id, action: 'user_created' } })

  return {
    success: true,
    message: 'User created successfully',
    user: record,
  }
}

export const handler = () => [
  useServices({
    ...useUserService()
  }),
  useJsonBody(z => ({
    name: z.string().min(1).max(255),
    email: z.string().email().toLowerCase(),
    status: z.enum(['active', 'inactive']).optional(),
  })),
  userCreate
]

export default handler
