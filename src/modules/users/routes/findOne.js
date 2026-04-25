import { useServices, usePathParams } from 'lumora/hooks/index.js'
import { useUserService } from '../service.js'

export const userFindOne = async ({ services, args }) => {
  const record = await services.userSrv.findById({ services, args })

  if (!record) {
    return {
      success: false,
      message: 'User not found',
    }
  }

  return {
    success: true,
    user: record,
  }
}

export const handler = () => [
  useServices({
    ...useUserService()
  }),
  usePathParams(z => ({
    id: z.string().min(1),
  })),
  userFindOne
]

export default handler
