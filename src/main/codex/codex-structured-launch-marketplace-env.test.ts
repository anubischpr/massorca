import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AgentSessionJournalIdentity } from '../../shared/agent-session-journal-types'
import { agentSessionRecordFixture } from '../native-chat/agent-session-record-test-fixture'
import {
  MarketplaceVault,
  emptyMarketplaceState,
  type MarketplaceState
} from '../marketplace/marketplace-vault'
import { openCodexAppServerConnection } from './codex-app-server-connection'
import { codexStructuredChildEnvironment } from './codex-structured-child-environment'
import { createCodexStructuredLaunchResolver } from './codex-structured-launch-resolution'

const vaultUnderTest = vi.hoisted((): { current: unknown } => ({ current: null }))
vi.mock('../marketplace/marketplace-vault', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getMarketplaceVault: () => vaultUnderTest.current
}))

const PROFILE_ENV = 'OPENMETADATA_TOKEN_ESCRITURA'
// Why: fake values only; the assertions below never print or compare a real credential.
const MAIN_TOKEN = 'fake-main-token-value'
const PROFILE_TOKEN = 'fake-escritura-token-value'

const RECORD = agentSessionRecordFixture({
  sessionId: 'codex-session-1',
  provider: 'codex',
  accountHome: { variable: 'CODEX_HOME', path: '/home/work/.codex' }
})
const IDENTITY: AgentSessionJournalIdentity = {
  sessionId: RECORD.sessionId,
  workspaceId: 'workspace-1',
  hostId: 'local',
  agent: 'codex',
  providerHandle: null
}

let home: string
let vault: MarketplaceVault

function state(overrides: Partial<MarketplaceState> = {}): MarketplaceState {
  return {
    ...emptyMarketplaceState(),
    openMetadata: {
      url: 'https://openmetadata.example.test',
      profiles: [{ name: 'escritura', url: 'https://escritura.example.test' }]
    },
    ...overrides
  }
}

function connectProfile(): void {
  vault.writeToken({ kind: 'openmetadata' }, MAIN_TOKEN)
  vault.writeToken({ kind: 'openmetadata-profile', name: 'escritura' }, PROFILE_TOKEN)
  vault.writeState(state())
}

function resolver() {
  return createCodexStructuredLaunchResolver({
    store: { getRecord: () => RECORD, pinLaunchDirectory: vi.fn() },
    resolveWorkspacePath: async (id) => `/repos/${id}`,
    resolveCommand: () => '/usr/local/bin/codex',
    resolveRollout: async () => null,
    resolveLaunchArgs: () => [],
    resolveEnvironment: async () => ({ PATH: '/usr/bin', HOME: '/host/home' })
  })
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'codex-marketplace-env-'))
  vault = new MarketplaceVault(join(home, 'marketplace'), { sealer: () => null })
  vaultUnderTest.current = vault
})
afterEach(() => {
  rmSync(home, { recursive: true, force: true })
})

describe('codex structured launch marketplace env', () => {
  it('gives the app-server every connected profile token under its own name', async () => {
    connectProfile()
    const launch = await resolver()({ identity: IDENTITY })
    expect(launch.env?.[PROFILE_ENV]).toBe(PROFILE_TOKEN)
    expect(launch.env?.OPENMETADATA_TOKEN).toBe(MAIN_TOKEN)
    expect(launch.env?.PATH).toBe('/usr/bin')
    expect(
      codexStructuredChildEnvironment(launch, 'spawn-token', RECORD.sessionId).env
    ).toMatchObject({ [PROFILE_ENV]: PROFILE_TOKEN })
  })

  it('reaches the spawned child process, not only the launch record', async () => {
    connectProfile()
    const launch = await resolver()({ identity: IDENTITY })
    // Why: the child reports only whether the variable exists, so no value is ever echoed.
    const probe = String.raw`
      const readline = require('node:readline')
      readline.createInterface({ input: process.stdin }).on('line', (line) => {
        const message = JSON.parse(line)
        const result = message.method === 'initialize' ? {} : { present: Boolean(process.env.${PROFILE_ENV}) }
        process.stdout.write(JSON.stringify({ id: message.id, result }) + '\n')
      })
    `
    const connection = await openCodexAppServerConnection({
      command: process.execPath,
      args: ['-e', probe],
      cwd: home,
      ...codexStructuredChildEnvironment(launch, 'spawn-token', RECORD.sessionId)
    })
    try {
      await expect(connection.request('test/env', {})).resolves.toEqual({ present: true })
    } finally {
      await connection.close()
    }
  })

  it('hands a session opened after a vault change the new profile, with no restart of older ones', async () => {
    vault.writeToken({ kind: 'openmetadata' }, MAIN_TOKEN)
    vault.writeState(
      state({ openMetadata: { url: 'https://openmetadata.example.test', profiles: [] } })
    )
    const resolve = resolver()
    const before = await resolve({ identity: IDENTITY })
    expect(before.env).not.toHaveProperty(PROFILE_ENV)

    connectProfile()
    const after = await resolve({ identity: IDENTITY })
    expect(after.env?.[PROFILE_ENV]).toBe(PROFILE_TOKEN)
    // The earlier launch is a plain object handed to a process already running; it never changes.
    expect(before.env).not.toHaveProperty(PROFILE_ENV)
  })

  it('sees a profile another process wrote to the same vault folder', async () => {
    vault.writeToken({ kind: 'openmetadata' }, MAIN_TOKEN)
    vault.writeState(
      state({ openMetadata: { url: 'https://openmetadata.example.test', profiles: [] } })
    )
    const resolve = resolver()
    expect((await resolve({ identity: IDENTITY })).env).not.toHaveProperty(PROFILE_ENV)

    const otherProcess = new MarketplaceVault(join(home, 'marketplace'), { sealer: () => null })
    otherProcess.writeToken({ kind: 'openmetadata-profile', name: 'escritura' }, PROFILE_TOKEN)
    otherProcess.writeState(state())
    expect((await resolve({ identity: IDENTITY })).env?.[PROFILE_ENV]).toBe(PROFILE_TOKEN)
  })

  it('keeps an app out when its access policy excludes Codex', async () => {
    connectProfile()
    const access = emptyMarketplaceState().access
    vault.writeState(
      state({
        access: {
          ...access,
          openmetadata: { ...access.openmetadata, agents: { mode: 'only', ids: ['claude'] } }
        }
      })
    )
    const launch = await resolver()({ identity: IDENTITY })
    expect(launch.env).not.toHaveProperty(PROFILE_ENV)
    expect(launch.env).not.toHaveProperty('OPENMETADATA_TOKEN')
  })

  it('leaves the launch without credentials when no app is connected', async () => {
    const launch = await resolver()({ identity: IDENTITY })
    expect(launch.env).toEqual({ PATH: '/usr/bin', HOME: '/host/home' })
  })
})
