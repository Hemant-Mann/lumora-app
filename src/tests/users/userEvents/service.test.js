import { describe, it, expect, jest, beforeEach } from '@jest/globals'
import { makeUserEvent, makeServices } from '../../helpers/fixtures.js'
import { lumoraCoreMock } from '../../helpers/mocks.js'

jest.unstable_mockModule('lumora/core/index.js', lumoraCoreMock)

const { useUserEventService } = await import('../../../modules/users/userEvents/service.js')

describe('UserEvents Service', () => {
  const setup = () => useUserEventService()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('userEventSrv.createRecord', () => {
    it('should create a user event and return the record', async () => {
      const { userEventSrv } = setup()
      const mockServices = makeServices()
      const event = makeUserEvent()
      mockServices.db.insertOne.mockResolvedValue([null, event])

      const result = await userEventSrv.createRecord({
        services: mockServices,
        args: { user_id: 'user_abc123', action: 'login', metadata: { ip: '127.0.0.1' } },
      })

      expect(result).toEqual(event)
      expect(mockServices.db.insertOne).toHaveBeenCalledWith(
        'UserEvent',
        expect.objectContaining({
          user_id: 'user_abc123',
          action: 'login',
          metadata: { ip: '127.0.0.1' },
          created_at: expect.any(Date),
        }),
      )
    })

    it('should default metadata to empty object', async () => {
      const { userEventSrv } = setup()
      const mockServices = makeServices()
      const event = makeUserEvent()
      mockServices.db.insertOne.mockResolvedValue([null, event])

      await userEventSrv.createRecord({
        services: mockServices,
        args: { user_id: 'user_abc123', action: 'logout' },
      })

      expect(mockServices.db.insertOne).toHaveBeenCalledWith(
        'UserEvent',
        expect.objectContaining({ metadata: {} }),
      )
    })

    it('should throw InternalServerError on db error', async () => {
      const { userEventSrv } = setup()
      const mockServices = makeServices()
      mockServices.db.insertOne.mockResolvedValue([new Error('DB down'), null])

      await expect(
        userEventSrv.createRecord({
          services: mockServices,
          args: { user_id: 'user_abc123', action: 'login' },
        }),
      ).rejects.toThrow('DB down')
    })
  })

  describe('userEventSrv.findRecords', () => {
    it('should return paginated events sorted by created_at desc', async () => {
      const { userEventSrv } = setup()
      const mockServices = makeServices()
      const events = [makeUserEvent(), makeUserEvent({ _id: 'event_def456', action: 'logout' })]
      mockServices.db.selectMany.mockResolvedValue([null, events])
      mockServices.db.count.mockResolvedValue([null, 2])

      const result = await userEventSrv.findRecords({
        services: mockServices,
        args: { filter: { user_id: 'user_abc123' }, page_no: 1, per_page: 10 },
      })

      expect(result).toEqual([events, 2])
      expect(mockServices.db.selectMany).toHaveBeenCalledWith(
        'UserEvent',
        { user_id: 'user_abc123' },
        { page_no: 1, per_page: 10, sort: { created_at: -1 } },
      )
      expect(mockServices.db.count).toHaveBeenCalledWith('UserEvent', { user_id: 'user_abc123' })
    })

    it('should throw on selectMany failure', async () => {
      const { userEventSrv } = setup()
      const mockServices = makeServices()
      mockServices.db.selectMany.mockResolvedValue([new Error('DB Error'), null])

      await expect(
        userEventSrv.findRecords({ services: mockServices, args: {} }),
      ).rejects.toThrow('DB Error')
    })

    it('should throw on count failure', async () => {
      const { userEventSrv } = setup()
      const mockServices = makeServices()
      mockServices.db.selectMany.mockResolvedValue([null, []])
      mockServices.db.count.mockResolvedValue([new Error('Count Error'), null])

      await expect(
        userEventSrv.findRecords({ services: mockServices, args: {} }),
      ).rejects.toThrow('Count Error')
    })
  })

  describe('userEventSrv.findById', () => {
    it('should return event by id', async () => {
      const { userEventSrv } = setup()
      const mockServices = makeServices()
      const event = makeUserEvent()
      mockServices.db.selectViaId.mockResolvedValue([null, event])

      const result = await userEventSrv.findById({
        services: mockServices,
        args: { id: 'event_abc123' },
      })

      expect(result).toEqual(event)
      expect(mockServices.db.selectViaId).toHaveBeenCalledWith('UserEvent', 'event_abc123')
    })

    it('should throw on db error', async () => {
      const { userEventSrv } = setup()
      const mockServices = makeServices()
      mockServices.db.selectViaId.mockResolvedValue([new Error('DB Error'), null])

      await expect(
        userEventSrv.findById({ services: mockServices, args: { id: 'event_abc123' } }),
      ).rejects.toThrow('DB Error')
    })
  })
})
