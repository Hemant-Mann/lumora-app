import { useServices, usePathParams, useJsonBody } from 'lumora/hooks/index.js'
import { useUserEventService } from '../service.js'

export const userEventCreate = async ({ services, args }) => {
  const record = await services.userEventSrv.createRecord({
    services,
    args: {
      user_id: args.id,
      action: args.body.action,
      metadata: args.body.metadata,
    }
  })

  return {
    success: true,
    message: 'User event created successfully',
    event: record,
  }
}

export const handler = () => [
  useServices({
    ...useUserEventService()
  }),
  usePathParams(z => ({
    id: z.string().min(1),
  })),
  useJsonBody(z => ({
    action: z.string().min(1).max(255),
    metadata: z.record(z.any()).optional(),
  })),
  userEventCreate
]

export default handler
