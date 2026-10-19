import { describe, it, expect, jest } from '@jest/globals'
import { useValidateId } from '../../modules/users/hooks/useValidateId.js'
import { makeUser } from '../helpers/fixtures.js'

describe('useValidateId', () => {
  it('should add the user to args and call the next hook', async () => {
    const user = makeUser()
    const findById = jest.fn().mockResolvedValue(user)
    const next = jest.fn().mockResolvedValue('ok')

    const result = await useValidateId()(next)({ services: { userSrv: { findById } }, args: { id: user._id } })

    expect(result).toBe('ok')
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ args: expect.objectContaining({ user }) }))
  })

  it('should throw when the user does not exist', async () => {
    const findById = jest.fn().mockResolvedValue(null)
    const next = jest.fn()

    await expect(
      useValidateId()(next)({ services: { userSrv: { findById } }, args: { id: 'user_missing' } }),
    ).rejects.toThrow('User not found')
    expect(next).not.toHaveBeenCalled()
  })
})
