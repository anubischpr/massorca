import { rmSync } from 'node:fs'
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
import {
  botRunOptions,
  deniedMarketplaceAppIdsForBot,
  resolveBotRunDenial
} from './marketplace-bot-run-denial'

beforeEach(() => {
  homeState.home = makeTempHome()
  installFakeSecretStore(true)
})
afterEach(() => {
  rmSync(homeState.home, { recursive: true, force: true })
  resetFakeSecretStore()
})

describe('the default app source of a bot run', () => {
  it('denies nothing on a host that never connected an app, without reading any app', async () => {
    expect(await resolveBotRunDenial(botRunOptions({ botId: 'bob', teamId: 't1' }))).toBeNull()
    expect(await deniedMarketplaceAppIdsForBot({ botId: 'bob', teamId: 't1' })).toEqual([])
  })
})
