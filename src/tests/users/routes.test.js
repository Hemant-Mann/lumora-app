import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { makeUser } from '../helpers/fixtures.js'

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
        args: { body: { name: 'John Doe', email: 'john@example.com', status: 'active' } },
      })

      expect(result.success).toBe(true)
      expect(result.message).toBe('User created successfully')
      expect(result.user).toEqual(user)
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
          args: { body: { name: 'John', email: 'john@example.com' } },
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
    beforeEach(() => mockFindById.mockReset())

    it('should return user when found', async () => {
      const user = makeUser()
      mockFindById.mockResolvedValue(user)

      const result = await userFindOne({
        services: { userSrv: { findById: mockFindById } },
        args: { id: 'user_abc123' },
      })

      expect(result.success).toBe(true)
      expect(result.user).toEqual(user)
      expect(mockFindById).toHaveBeenCalledWith(
        expect.objectContaining({ args: expect.objectContaining({ id: 'user_abc123' }) }),
      )
    })

    it('should return not found message when user does not exist', async () => {
      mockFindById.mockResolvedValue(null)

      const result = await userFindOne({
        services: { userSrv: { findById: mockFindById } },
        args: { id: 'user_missing' },
      })

      expect(result.success).toBe(false)
      expect(result.message).toBe('User not found')
    })

    it('should propagate service errors', async () => {
      mockFindById.mockRejectedValue(new Error('DB down'))

      await expect(
        userFindOne({
          services: { userSrv: { findById: mockFindById } },
          args: { id: 'user_abc123' },
        }),
      ).rejects.toThrow('DB down')
    })
  })
})
