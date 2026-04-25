import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { makeUser, makeServices } from '../helpers/fixtures.js'
import { lumoraCoreMock } from '../helpers/mocks.js'

jest.unstable_mockModule('lumora/core/index.js', lumoraCoreMock)

jest.unstable_mockModule('../../modules/users/userEvents/service.js', () => ({
  useUserEventService: () => ({
    userEventSrv: {
      createRecord: jest.fn(),
    },
  }),
}))

const { useUserService } = await import('../../modules/users/service.js')

describe('Users Service', () => {
  const setup = () => useUserService()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should expose both userSrv and userEventSrv', () => {
    const services = setup()
    expect(services.userSrv).toBeDefined()
    expect(services.userEventSrv).toBeDefined()
  })

  describe('userSrv.createRecord', () => {
    it('should create a user and return the record', async () => {
      const { userSrv } = setup()
      const mockServices = makeServices()
      const user = makeUser()
      mockServices.mysql.insertOne.mockResolvedValue([null, user])

      const result = await userSrv.createRecord({
        services: mockServices,
        args: { body: { name: 'John Doe', email: 'john@example.com', status: 'active' } },
      })

      expect(result).toEqual(user)
      expect(mockServices.mysql.insertOne).toHaveBeenCalledWith(
        'User',
        expect.objectContaining({
          _id: 'user_abc123',
          name: 'John Doe',
          email: 'john@example.com',
          status: 'active',
          created_at: expect.any(Date),
          updated_at: expect.any(Date),
        }),
      )
    })

    it('should throw DuplicateEntryError on duplicate email', async () => {
      const { userSrv } = setup()
      const mockServices = makeServices()
      const dbError = new Error('Duplicate entry')
      mockServices.mysql.insertOne.mockResolvedValue([dbError, null])
      mockServices.mysql.isDuplicateError.mockReturnValue(true)

      await expect(
        userSrv.createRecord({
          services: mockServices,
          args: { body: { name: 'John', email: 'john@example.com' } },
        }),
      ).rejects.toThrow('User with this email already exists')
    })

    it('should throw InternalServerError on unexpected db error', async () => {
      const { userSrv } = setup()
      const mockServices = makeServices()
      mockServices.mysql.insertOne.mockResolvedValue([new Error('DB down'), null])
      mockServices.mysql.isDuplicateError.mockReturnValue(false)

      await expect(
        userSrv.createRecord({
          services: mockServices,
          args: { body: { name: 'John', email: 'john@example.com' } },
        }),
      ).rejects.toThrow('DB down')
    })
  })

  describe('userSrv.findRecords', () => {
    it('should return paginated users and total count', async () => {
      const { userSrv } = setup()
      const mockServices = makeServices()
      const users = [makeUser(), makeUser({ _id: 'user_def456', email: 'jane@example.com' })]
      mockServices.mysql.selectMany.mockResolvedValue([null, users])
      mockServices.mysql.count.mockResolvedValue([null, 2])

      const result = await userSrv.findRecords({
        services: mockServices,
        args: { filter: { status: 'active' }, page_no: 1, per_page: 10 },
      })

      expect(result).toEqual([users, 2])
      expect(mockServices.mysql.selectMany).toHaveBeenCalledWith(
        'User',
        { status: 'active' },
        { page_no: 1, per_page: 10 },
      )
      expect(mockServices.mysql.count).toHaveBeenCalledWith('User', { status: 'active' })
    })

    it('should throw InternalServerError on selectMany failure', async () => {
      const { userSrv } = setup()
      const mockServices = makeServices()
      mockServices.mysql.selectMany.mockResolvedValue([new Error('DB Error'), null])

      await expect(
        userSrv.findRecords({ services: mockServices, args: {} }),
      ).rejects.toThrow('DB Error')
    })

    it('should throw InternalServerError on count failure', async () => {
      const { userSrv } = setup()
      const mockServices = makeServices()
      mockServices.mysql.selectMany.mockResolvedValue([null, []])
      mockServices.mysql.count.mockResolvedValue([new Error('Count Error'), null])

      await expect(
        userSrv.findRecords({ services: mockServices, args: {} }),
      ).rejects.toThrow('Count Error')
    })
  })

  describe('userSrv.findById', () => {
    it('should return user via cache-first client', async () => {
      const { userSrv } = setup()
      const mockServices = makeServices()
      const user = makeUser()
      mockServices.dbCache.selectViaId.mockResolvedValue([null, user])

      const result = await userSrv.findById({
        services: mockServices,
        args: { id: 'user_abc123' },
      })

      expect(result).toEqual(user)
      expect(mockServices.dbCache.selectViaId).toHaveBeenCalledWith('User', 'user_abc123')
    })

    it('should throw on db cache error', async () => {
      const { userSrv } = setup()
      const mockServices = makeServices()
      mockServices.dbCache.selectViaId.mockResolvedValue([new Error('Cache miss'), null])

      await expect(
        userSrv.findById({ services: mockServices, args: { id: 'user_abc123' } }),
      ).rejects.toThrow('Cache miss')
    })
  })

  describe('userSrv.updateRecord', () => {
    it('should update a user by id', async () => {
      const { userSrv } = setup()
      const mockServices = makeServices()
      mockServices.mysql.updateOne.mockResolvedValue([null, true])

      const result = await userSrv.updateRecord({
        services: mockServices,
        args: { id: 'user_abc123', body: { name: 'Jane Doe' } },
      })

      expect(result).toBe(true)
      expect(mockServices.mysql.updateOne).toHaveBeenCalledWith(
        'User',
        { _id: 'user_abc123' },
        { set: expect.objectContaining({ name: 'Jane Doe', updated_at: expect.any(Date) }) },
      )
    })

    it('should throw on db error', async () => {
      const { userSrv } = setup()
      const mockServices = makeServices()
      mockServices.mysql.updateOne.mockResolvedValue([new Error('DB Error'), null])

      await expect(
        userSrv.updateRecord({
          services: mockServices,
          args: { id: 'user_abc123', body: { name: 'Jane' } },
        }),
      ).rejects.toThrow('DB Error')
    })
  })

  describe('userSrv.deleteRecord', () => {
    it('should delete user and clear cache', async () => {
      const { userSrv } = setup()
      const mockServices = makeServices()
      mockServices.mysql.deleteOne.mockResolvedValue([null, true])

      const result = await userSrv.deleteRecord({
        services: mockServices,
        args: { id: 'user_abc123' },
      })

      expect(result).toBe(true)
      expect(mockServices.mysql.deleteOne).toHaveBeenCalledWith('User', { _id: 'user_abc123' })
      expect(mockServices.dbCache.clearCacheForId).toHaveBeenCalledWith('User', 'user_abc123')
    })

    it('should throw on db error', async () => {
      const { userSrv } = setup()
      const mockServices = makeServices()
      mockServices.mysql.deleteOne.mockResolvedValue([new Error('DB Error'), null])

      await expect(
        userSrv.deleteRecord({ services: mockServices, args: { id: 'user_abc123' } }),
      ).rejects.toThrow('DB Error')
    })
  })

  describe('userSrv.logEvent', () => {
    it('should delegate to userEventSrv.createRecord', async () => {
      const { userSrv, userEventSrv } = setup()
      const event = { user_id: 'user_abc123', action: 'login' }
      userEventSrv.createRecord.mockResolvedValue(event)

      const result = await userSrv.logEvent({
        services: { ...makeServices(), userEventSrv },
        args: { user_id: 'user_abc123', action: 'login' },
      })

      expect(result).toEqual(event)
      expect(userEventSrv.createRecord).toHaveBeenCalledWith({
        services: expect.any(Object),
        args: { user_id: 'user_abc123', action: 'login' },
      })
    })
  })
})
