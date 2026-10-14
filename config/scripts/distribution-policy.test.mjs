import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import policy from '../distribution-policy.cjs'

const require = createRequire(import.meta.url)
const builderConfigPath = require.resolve('../electron-builder.config.cjs')
const forkMetadata = {
  orcaDistribution: { repository: 'anubischpr/orca', updatePolicy: 'manual' }
}

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

  it.each([
    ['official default', {}, undefined],
    [
      'official local',
      { ORCA_LOCAL_BUILD_VERSION: '1.4.224-local.test' },
      { version: '1.4.224-local.test' }
    ],
    [
      'official release',
      { ORCA_MAC_RELEASE: '1', ORCA_LOCAL_BUILD_VERSION: '1.4.224-local.test' },
      undefined
    ],
    [
      'fork release',
      {
        ORCA_MANUAL_UPDATES: '1',
        ORCA_MAC_RELEASE: '1',
        ORCA_LOCAL_BUILD_VERSION: '1.4.224-local.test'
      },
      forkMetadata
    ],
    [
      'fork local',
      { ORCA_MANUAL_UPDATES: '1', ORCA_LOCAL_BUILD_VERSION: '1.4.224-local.test' },
      { version: '1.4.224-local.test', ...forkMetadata }
    ]
  ])('preserves builder metadata for %s', (_name, env, expected) => {
    const keys = [
      'ORCA_MANUAL_UPDATES',
      'ORCA_LOCAL_BUILD_VERSION',
      'ORCA_MAC_RELEASE',
      'ORCA_MAC_HOURLY',
      'ORCA_MAC_DAILY',
      'ORCA_MAC_ADHOC',
      'ORCA_WIN_HOURLY',
      'ORCA_WIN_DAILY',
      'ORCA_WIN_ADHOC'
    ]
    const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]))
    try {
      for (const key of keys) {
        delete process.env[key]
      }
      Object.assign(process.env, env)
      delete require.cache[builderConfigPath]
      expect(require(builderConfigPath).extraMetadata).toEqual(expected)
    } finally {
      for (const key of keys) {
        if (previous[key] === undefined) {
          delete process.env[key]
        } else {
          process.env[key] = previous[key]
        }
      }
      delete require.cache[builderConfigPath]
    }
  })
})
