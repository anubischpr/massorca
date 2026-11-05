import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as OsModule from 'node:os'

const homeState = vi.hoisted(() => ({ home: '' }))
vi.mock('node:os', async (importOriginal) => ({
  ...(await importOriginal<typeof OsModule>()),
  homedir: () => homeState.home
}))

import {
  installAllAgents,
  installFakeSecretStore,
  makeTempHome,
  resetFakeSecretStore,
  testAgentPaths
} from './marketplace-apps-test-fixtures'
import { createMarketplaceAppsService } from './marketplace-apps-service'
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

describe('a profile added through the Marketplace', () => {
  const MAIN_TOKEN = 'fake-main-token-value'
  const PROFILE_TOKEN = 'fake-escritura-token-value'

  function filesUnder(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [join(dir, entry.name)]
    )
  }

  it('reaches the agents as an env var, and no token value is written to any file', async () => {
    installAllAgents(homeState.home)
    const vault = new MarketplaceVault(join(homeState.home, '.orca', 'marketplace'))
    const service = createMarketplaceAppsService({
      vault,
      paths: testAgentPaths(homeState.home),
      engramProgram: async () => ({ found: true, version: '1.2.3' }),
      githubAuthenticated: async () => true
    })
    await service.connect({
      id: 'openmetadata',
      url: 'https://om.example.test/mcp',
      token: MAIN_TOKEN
    })
    await service.addOpenMetadataProfile({
      name: 'escritura',
      url: 'https://escritura.example.test/mcp',
      token: PROFILE_TOKEN
    })

    for (const agent of ['claude', 'codex', 'antigravity', 'gentle-shell'] as const) {
      expect(vault.buildAgentEnv(agent)).toEqual({
        OPENMETADATA_TOKEN: MAIN_TOKEN,
        OPENMETADATA_TOKEN_ESCRITURA: PROFILE_TOKEN
      })
    }
    // Codex's config names the variable; the value stays in the vault.
    expect(readFileSync(testAgentPaths(homeState.home).mcpConfig('codex'), 'utf8')).toContain(
      'bearer_token_env_var = "OPENMETADATA_TOKEN_ESCRITURA"'
    )
    for (const file of filesUnder(homeState.home)) {
      const text = readFileSync(file).toString('latin1')
      expect(text, file).not.toContain(MAIN_TOKEN)
      expect(text, file).not.toContain(PROFILE_TOKEN)
    }
  })
})
