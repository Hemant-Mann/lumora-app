import { describe, it, expect, jest } from '@jest/globals'
import { BadRequestError, InternalServerError, NotAuthenticatedError, NotAuthorizedError } from 'lumora/core/index.js'
import { useError } from '../../framework/hooks/useError.js'

const run = (error) => useError()(async () => { throw error })({})

describe('useError', () => {
  it.each([
    ['400', new BadRequestError('bad', { key: 'k' }), 400],
    ['401', new NotAuthenticatedError('sign in', { key: 'k' }), 401],
    ['403', new NotAuthorizedError('forbidden', { key: 'k' }), 403],
  ])('keeps a %s LumoError as-is', async (_, error, status) => {
    await expect(run(error)).rejects.toBe(error)
    await expect(run(error)).rejects.toHaveProperty('status', status)
  })

  it('turns unknown errors into a 500 that keeps the cause', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const boom = new Error('db down')
    const err = await run(boom).catch((e) => e)
    expect(err).toBeInstanceOf(InternalServerError)
    expect(err.status).toBe(500)
    expect(err.cause).toBe(boom)
  })

  it('passes results through untouched', async () => {
    await expect(useError()(async () => ({ ok: true }))({})).resolves.toEqual({ ok: true })
  })
})
