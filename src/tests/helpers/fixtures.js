import { jest } from '@jest/globals'

export const makeUser = (overrides = {}) => ({
  _id: 'user_abc123',
  name: 'John Doe',
  email: 'john@example.com',
  status: 'active',
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-06-01T00:00:00.000Z',
  ...overrides,
})

export const makeUserEvent = (overrides = {}) => ({
  _id: 'event_abc123',
  user_id: 'user_abc123',
  action: 'user_created',
  metadata: {},
  created_at: '2024-01-01T00:00:00.000Z',
  ...overrides,
})

export const makeServices = (overrides = {}) => ({
  mysql: {
    generateNewId: jest.fn().mockReturnValue('user_abc123'),
    insertOne: jest.fn(),
    selectMany: jest.fn(),
    selectOne: jest.fn(),
    selectViaId: jest.fn(),
    updateOne: jest.fn().mockResolvedValue([null, true]),
    deleteOne: jest.fn().mockResolvedValue([null, true]),
    count: jest.fn(),
    isDuplicateError: jest.fn().mockReturnValue(false),
  },
  dbCache: {
    selectViaId: jest.fn(),
    clearCacheForId: jest.fn().mockResolvedValue(),
  },
  db: {
    insertOne: jest.fn(),
    selectMany: jest.fn(),
    selectOne: jest.fn(),
    selectViaId: jest.fn(),
    updateOne: jest.fn().mockResolvedValue([null, true]),
    deleteOne: jest.fn().mockResolvedValue([null, true]),
    count: jest.fn(),
    isDuplicateError: jest.fn().mockReturnValue(false),
  },
  ...overrides,
})
