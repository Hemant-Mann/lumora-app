import { describe, it, expect } from '@jest/globals'
import { buildUserFilter } from '../../modules/users/helper.js'

describe('buildUserFilter', () => {
  it('should return empty filter when no args', () => {
    expect(buildUserFilter({})).toEqual({})
  })

  it('should map status and search', () => {
    expect(buildUserFilter({ status: 'active', search: 'jo' })).toEqual({
      status: 'active',
      name: { operator: 'CONTAINS', value: 'jo' },
    })
  })
})
