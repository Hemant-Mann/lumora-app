import { useServices, usePathParams } from 'lumora/hooks/index.js'
import { useUserService } from '../service.js'
import { useValidateId } from '../hooks/useValidateId.js'
import { responseMapping } from '../mapper.js'

// useValidateId has already loaded the user into args.user (or thrown)
export const userFindOne = async ({ args }) => {
  return {
    success: true,
    user: responseMapping(args.user),
  }
}

export const handler = () => [
  useServices({
    ...useUserService()
  }),
  usePathParams(z => ({
    id: z.string().min(1),
  })),
  useValidateId(),
  userFindOne
]

export default handler
