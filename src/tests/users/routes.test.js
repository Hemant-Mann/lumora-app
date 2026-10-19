import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { makeUser } from '../helpers/fixtures.js'
import { responseMapping } from '../../modules/users/mapper.js'

const mockCreateRecord = jest.fn()
const mockFindRecords = jest.fn()
const mockFindById = jest.fn()
const mockLogEvent = jest.fn()

jest.unstable_mockModule('../../modules/users/service.js', () => ({
  useUserService: () => ({
    userSrv: {
      createRecord: mockCreateRecord,
      findRecords: mockFindRecords,
      findById: mockFindById,
      logEvent: mockLogEvent,
    },
  }),
}))

const { userCreate } = await import('../../modules/users/routes/create.js')
const { userList } = await import('../../modules/users/routes/list.js')
const { userFindOne } = await import('../../modules/users/routes/findOne.js')

describe('Users Routes', () => {
  describe('userCreate', () => {
    beforeEach(() => {
      mockCreateRecord.mockReset()
      mockLogEvent.mockReset()
    })

    it('should create a user and log an event', async () => {
      const user = makeUser()
      mockCreateRecord.mockResolvedValue(user)
      mockLogEvent.mockResolvedValue({ user_id: user._id, action: 'user_created' })

      const result = await userCreate({
        services: { userSrv: { createRecord: mockCreateRecord, logEvent: mockLogEvent } },
        args: { name: 'John Doe', email: 'john@example.com', status: 'active' },
      })

      expect(result.success).toBe(true)
      expect(result.message).toBe('User created successfully')
      expect(result.user).toEqual(responseMapping(user))
      expect(mockCreateRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({
            body: expect.objectContaining({ name: 'John Doe', email: 'john@example.com' }),
          }),
        }),
      )
      expect(mockLogEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({ user_id: 'user_abc123', action: 'user_created' }),
        }),
      )
    })

    it('should propagate service errors', async () => {
      mockCreateRecord.mockRejectedValue(new Error('DB down'))

      await expect(
        userCreate({
          services: { userSrv: { createRecord: mockCreateRecord, logEvent: mockLogEvent } },
          args: { name: 'John', email: 'john@example.com' },
        }),
      ).rejects.toThrow('DB down')
    })
  })

  describe('userList', () => {
    beforeEach(() => mockFindRecords.mockReset())

    it('should return paginated list of users', async () => {
      const users = [makeUser(), makeUser({ _id: 'user_def456', email: 'jane@example.com' })]
      mockFindRecords.mockResolvedValue([users, 2])

      const result = await userList({
        services: { userSrv: { findRecords: mockFindRecords } },
        args: { page_no: 1, per_page: 10, filter: {} },
      })

      expect(result.success).toBe(true)
      expect(result.users).toHaveLength(2)
      expect(result.pagination).toEqual({ page_no: 1, per_page: 10, total: 2 })
      expect(mockFindRecords).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({ page_no: 1, per_page: 10, filter: {} }),
        }),
      )
    })

    it('should return empty list when no users found', async () => {
      mockFindRecords.mockResolvedValue([[], 0])

      const result = await userList({
        services: { userSrv: { findRecords: mockFindRecords } },
        args: { page_no: 1, per_page: 10, filter: {} },
      })

      expect(result.success).toBe(true)
      expect(result.users).toEqual([])
      expect(result.pagination.total).toBe(0)
    })

    it('should propagate service errors', async () => {
      mockFindRecords.mockRejectedValue(new Error('DB down'))

      await expect(
        userList({
          services: { userSrv: { findRecords: mockFindRecords } },
          args: { page_no: 1, per_page: 10, filter: {} },
        }),
      ).rejects.toThrow('DB down')
    })
  })

  describe('userFindOne', () => {
    it('should return the user loaded by useValidateId', async () => {
      const user = makeUser()

      const result = await userFindOne({ args: { id: 'user_abc123', user } })

      expect(result.success).toBe(true)
      expect(result.user).toEqual(responseMapping(user))
    })
  })
})
