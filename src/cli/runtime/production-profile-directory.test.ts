import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PRODUCTION_USER_DATA_DIR_NAME } from '../../shared/product-identity'
import { getPlatformUserDataPath } from './metadata'

// Why: the desktop app pins its production profile to this directory (configure-process.ts).
// The CLI must resolve the same directory, or `orca` and the app would read different state.
describe('production profile directory', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('is the same directory the CLI resolves on Linux and macOS', () => {
    vi.stubEnv('XDG_CONFIG_HOME', '')
    expect(PRODUCTION_USER_DATA_DIR_NAME).toBe('orca')
    expect(getPlatformUserDataPath('linux', '/home/user')).toBe(
      join('/home/user/.config', PRODUCTION_USER_DATA_DIR_NAME)
    )
    expect(getPlatformUserDataPath('darwin', '/Users/user')).toBe(
      join('/Users/user/Library/Application Support', PRODUCTION_USER_DATA_DIR_NAME)
    )
  })
})
