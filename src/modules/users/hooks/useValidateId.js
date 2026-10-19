import { BadRequestError } from 'lumora/core/index.js'

/**
 * Load the user from the `id` path param and add it to args as `args.user`
 * Throws BadRequestError when the user does not exist
 * Requires `userSrv` in services and `usePathParams` (id) before it
 * @returns {Function} Lumora hook (func) => (props) => ...
 */
export const useValidateId = () => (func) => async (props) => {
  const { services, args } = props

  const user = await services.userSrv.findById({ services, args: { id: args.id } })
  if (!user) {
    throw new BadRequestError('User not found', { key: 'users.not-found' })
  }

  return await func({
    ...props,
    args: {
      ...props.args,
      user,
    }
  })
}
