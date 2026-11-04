import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
import {
  botRunOptions,
  deniedMarketplaceAppIdsForBot,
  resolveBotRunDenial
} from './marketplace-bot-run-denial'

// Why: the default vault keeps the first home it sees, so the home stays and only its vault is cleared.
beforeEach(() => {
  homeState.home ||= makeTempHome()
  installFakeSecretStore(true)
})
afterEach(() => {
  rmSync(join(homeState.home, '.orca'), { recursive: true, force: true })
  resetFakeSecretStore()
})
afterAll(() => {
  rmSync(homeState.home, { recursive: true, force: true })
})

function writeVaultState(text: string): void {
  const dir = join(homeState.home, '.orca', 'marketplace')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'state.json'), text)
}

const EVERYONE = {
  agents: { mode: 'everyone', ids: [] },
  bots: { mode: 'everyone', botIds: [], teamIds: [] }
}

function stateDenyingBobEngram(): Record<string, unknown> {
  return {
    version: 1,
    openMetadata: { url: null, profiles: [] },
    engram: { connected: false, serverUrl: null },
    github: { hidden: false },
    access: {
      engram: { ...EVERYONE, bots: { mode: 'except', botIds: ['bob'], teamIds: [] } },
      openmetadata: EVERYONE,
      github: EVERYONE
    },
    written: { engram: {}, openmetadata: {} }
  }
}

const DENY_ALL_SERVERS = ['engram', 'openmetadata']

describe('the default app source of a bot run', () => {
  it('denies nothing on a host that never connected an app, without reading any app', async () => {
    expect(await resolveBotRunDenial(botRunOptions({ botId: 'bob', teamId: 't1' }))).toBeNull()
    expect(await deniedMarketplaceAppIdsForBot({ botId: 'bob', teamId: 't1' })).toEqual([])
  })

  it('denies by the stored policy even when the app is not connected here', async () => {
    writeVaultState(JSON.stringify(stateDenyingBobEngram()))
    const denial = await resolveBotRunDenial(botRunOptions({ botId: 'bob', teamId: 't1' }))
    expect(denial?.mcpServers).toEqual(['engram'])
    expect(denial?.envNames).toEqual(['ENGRAM_CLOUD_TOKEN', 'ENGRAM_CLOUD_SERVER'])
    expect(await resolveBotRunDenial(botRunOptions({ botId: 'ann', teamId: 't1' }))).toBeNull()
    expect(await deniedMarketplaceAppIdsForBot({ botId: 'bob', teamId: 't1' })).toEqual(['engram'])
  })

  it.each([
    ['an unparseable state file', '{not json'],
    [
      'an unreadable access record',
      JSON.stringify({ ...stateDenyingBobEngram(), access: { engram: { bots: 'broken' } } })
    ]
  ])('denies every app on %s', async (_case, text) => {
    writeVaultState(text)
    const denial = await resolveBotRunDenial(botRunOptions({ botId: 'ann', teamId: 't1' }))
    expect(denial?.mcpServers).toEqual(DENY_ALL_SERVERS)
    expect(await deniedMarketplaceAppIdsForBot({ botId: 'ann', teamId: 't1' })).toEqual([
      'engram',
      'openmetadata',
      'github'
    ])
  })
})
