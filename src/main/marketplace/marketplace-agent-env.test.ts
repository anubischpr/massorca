import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as OsModule from 'node:os'

const homeState = vi.hoisted(() => ({ home: '' }))
vi.mock('node:os', async (importOriginal) => ({
  ...(await importOriginal<typeof OsModule>()),
  homedir: () => homeState.home
}))

import {
  installFakeSecretStore,
  makeTempHome,
  resetFakeSecretStore
} from './marketplace-apps-test-fixtures'
import { buildMarketplaceAgentEnv } from './marketplace-agent-env'
import { MarketplaceVault, emptyMarketplaceState } from './marketplace-vault'

beforeEach(() => {
  homeState.home = makeTempHome()
  installFakeSecretStore(true)
})
afterEach(() => {
  rmSync(homeState.home, { recursive: true, force: true })
  resetFakeSecretStore()
})

describe('buildMarketplaceAgentEnv', () => {
  it('adds nothing when no app was ever connected', () => {
    expect(buildMarketplaceAgentEnv()).toEqual({})
  })

  it('returns the stored credentials as names and values', () => {
    const dir = join(homeState.home, '.orca', 'marketplace')
    const vault = new MarketplaceVault(dir)
    vault.writeToken({ kind: 'openmetadata' }, 'main-token')
    vault.writeState(emptyMarketplaceState())
    // Why: the default vault caches, so a fresh vault proves the files and not a previous test.
    expect(new MarketplaceVault(dir).buildAgentEnv()).toEqual({ OPENMETADATA_TOKEN: 'main-token' })
  })

  it('never throws when the vault cannot be read', () => {
    const dir = join(homeState.home, '.orca', 'marketplace')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'state.json'), 'not json')
    resetFakeSecretStore()
    expect(buildMarketplaceAgentEnv()).toEqual({})
  })
})
