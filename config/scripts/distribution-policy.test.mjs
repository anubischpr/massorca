import { describe, expect, it } from 'vitest'
import policy from '../distribution-policy.cjs'

describe('distribution packaging metadata', () => {
  it('leaves official package metadata unmarked', () => {
    expect(policy.distributionMetadata({})).toEqual({})
  })
  it('embeds a persistent manual fork identity', () => {
    expect(policy.distributionMetadata({ ORCA_MANUAL_UPDATES: '1' })).toEqual({
      orcaDistribution: { repository: 'anubischpr/orca', updatePolicy: 'manual' }
    })
  })
  it('rejects ambiguous values instead of producing an unprotected fork build', () => {
    expect(() => policy.distributionMetadata({ ORCA_MANUAL_UPDATES: 'true' })).toThrow()
    expect(() => policy.distributionMetadata({ ORCA_MANUAL_UPDATES: '0' })).toThrow()
  })
})
